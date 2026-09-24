// aidlc-live-status.ts — a STANDALONE conductor-side reader for AIDLC v2 engine
// visibility. It reads only the engine's OWN on-disk artifacts (audit log +
// aidlc-state.md + .aidlc-engine/active-directive.json) by their documented
// grammar; it imports no engine-core module and never writes to the ledger.
//
// It answers two questions during the long silent waits a human faces while
// driving the engine:
//
//   A. LIVE STATUS  — where is the workflow right now: intent / phase / stage
//      (X of N), lead + mode, next gate, and — mid-stream — which next/continue
//      part is in flight.
//   B. STALL DETECTOR — is the engine BUSY or WEDGED? A wedge is the audit
//      signature of a hung PreToolUse hook chain (hook #4, the plan-approval
//      guard, blocking on I/O): only bare HUMAN_TURN events accrue, with no
//      engine-activity event between them, for longer than a threshold.
//
// Ground truth (all verified against a live workshop workflow, 2026-09-24):
//   audit shard(s): <record>/audit/*.md          (per-intent, per-clone shards)
//   state file:     <record>/aidlc-state.md
//   directive:      <record>/.aidlc-engine/active-directive.json
//   where <record> = aidlc/spaces/<space>/intents/<slug-id8>/ (active-intent
//   pointer names the live one), or the bare space root when no intent resolves.
//
// Audit block grammar: markdown blocks separated by "\n---\n"; each block has a
// "## <heading>", a "**Timestamp**: <iso>" line (ISO seconds precision, ...Z)
// and a "**Event**: <EVENT_TYPE>" line, then "**Key**: value" fields. First
// line of the file is "# AI-DLC Audit Log". This mirrors aidlc-audit.ts
// renderAuditBlock / auditBlockField exactly.
//
// Usage:
//   bun aidlc-live-status.ts status  [--project-dir <path>] [--json]
//   bun aidlc-live-status.ts stall   [--project-dir <path>] [--threshold-secs N] [--json]
//   bun aidlc-live-status.ts watch   [--project-dir <path>] [--interval-secs N] [--threshold-secs N]
//
// Runs under bun (engine toolchain) or plain node (>=18). No dependencies.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Default seconds of "only HUMAN_TURN, no engine activity" before WEDGED. */
export const DEFAULT_STALL_THRESHOLD_SECS = 90;

/**
 * Engine-activity events: any of these appearing AFTER the last HUMAN_TURN
 * proves the engine did real work, so the session is BUSY, not wedged. This is
 * the complement of "bare HUMAN_TURN" — deliberately broad and fail-toward-BUSY
 * is NOT the default: we treat "no engine activity" as the wedge signal, so a
 * quiet audit log with only human turns is what fires. The one event that is
 * NEVER engine activity is HUMAN_TURN itself.
 */
const HUMAN_PRESENCE_EVENT = "HUMAN_TURN";

// The guard whose hang produces the wedge signature, and its documented escape.
const WEDGE_HOOK = "plan-approval-guard (PreToolUse hook #4)";
const WEDGE_REMEDY =
	"set AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1 in the harness env and start a fresh session " +
	"(documented deterministic off-switch; re-enable once past the wedge)";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEvent {
	event: string;
	timestamp: string; // ISO string as written by the engine
	epochMs: number; // parsed; NaN if unparseable
	fields: Record<string, string>;
	shard: string;
	pos: number; // append position within its shard
}

export interface StatusView {
	ok: boolean;
	reason?: string;
	intent: string | null;
	space: string;
	recordDir: string | null;
	phase: string | null;
	stage: string | null;
	stageIndex: number | null; // 1-based, executable stages only
	stageTotal: number | null;
	stagesCompleted: number | null;
	lead: string | null;
	mode: string | null;
	nextStage: string | null;
	nextGate: boolean | null;
	status: string | null; // aidlc-state.md "Status" line
	directiveKind: string | null; // active-directive.json "kind"
	streaming: StreamingView | null; // set when mid next/continue stream
	lastEventAt: string | null;
	lastEvent: string | null;
}

export interface StreamingView {
	part: number | null;
	parts: number | null;
	continueToken: string | null;
	delivery: string | null; // active-directive delivery field
}

export type StallState = "BUSY" | "WEDGED" | "IDLE" | "NO_WORKFLOW";

export interface StallView {
	state: StallState;
	reason: string;
	elapsedSecs: number | null; // since the most recent engine activity (or last human turn if wedged)
	thresholdSecs: number;
	lastEvent: string | null;
	lastEventAt: string | null;
	humanTurnsSinceEngineActivity: number;
	likelyHook?: string;
	remedy?: string;
}

// ---------------------------------------------------------------------------
// Path resolution (mirrors aidlc-lib.ts resolveRecordDir, read-only)
// ---------------------------------------------------------------------------

const ACTIVE_INTENT_POINTER = "active-intent";
const ACTIVE_SPACE_POINTER = "active-space";
const ENGINE_DIR = ".aidlc-engine";
const ACTIVE_DIRECTIVE = "active-directive.json";
const STATE_FILE = "aidlc-state.md";

function workspaceRoot(projectDir: string): string {
	return join(projectDir, "aidlc");
}

function activeSpace(projectDir: string): string {
	const ptr = join(workspaceRoot(projectDir), "spaces", ACTIVE_SPACE_POINTER);
	try {
		const raw = readFileSync(ptr, "utf-8").trim();
		if (raw.length > 0) return raw;
	} catch {
		// no cursor
	}
	return "default";
}

function intentsDir(projectDir: string, space: string): string {
	return join(workspaceRoot(projectDir), "spaces", space, "intents");
}

/**
 * A record dir is "live" if it carries an aidlc-state.md OR an audit/ dir. The
 * engine always writes both for a running workflow, but the stall detector must
 * still resolve a record from its audit log alone (a wedge can leave the log
 * present while the state read is what is blocked), so we do not require the
 * state file to exist here.
 */
function looksLikeRecord(dir: string, name: string): boolean {
	return (
		existsSync(join(dir, name, STATE_FILE)) ||
		existsSync(join(dir, name, "audit"))
	);
}

/** Resolve the live intent record-dir name, or null for the bare space root. */
function activeIntent(projectDir: string, space: string): string | null {
	const dir = intentsDir(projectDir, space);
	try {
		const raw = readFileSync(join(dir, ACTIVE_INTENT_POINTER), "utf-8").trim();
		if (raw.length > 0 && looksLikeRecord(dir, raw)) return raw;
	} catch {
		// no cursor → lone-intent fallback
	}
	let dirs: string[];
	try {
		dirs = readdirSync(dir, { withFileTypes: true })
			.filter((e) => e.isDirectory() && looksLikeRecord(dir, e.name))
			.map((e) => e.name);
	} catch {
		return null;
	}
	return dirs.length === 1 ? dirs[0] : null;
}

export interface ResolvedRecord {
	space: string;
	intent: string | null;
	recordDir: string | null; // absolute; null → bare space root
	spaceRoot: string; // absolute
}

export function resolveRecord(projectDir: string): ResolvedRecord {
	const space = activeSpace(projectDir);
	const intent = activeIntent(projectDir, space);
	const spaceRoot = join(workspaceRoot(projectDir), "spaces", space);
	const recordDir =
		intent === null ? null : join(intentsDir(projectDir, space), intent);
	return { space, intent, recordDir, spaceRoot };
}

function auditDir(rec: ResolvedRecord): string {
	return rec.recordDir === null
		? join(rec.spaceRoot, "audit")
		: join(rec.recordDir, "audit");
}

function stateFilePath(rec: ResolvedRecord): string {
	return rec.recordDir === null
		? join(rec.spaceRoot, STATE_FILE)
		: join(rec.recordDir, STATE_FILE);
}

function activeDirectivePath(rec: ResolvedRecord): string | null {
	return rec.recordDir === null
		? null
		: join(rec.recordDir, ENGINE_DIR, ACTIVE_DIRECTIVE);
}

// ---------------------------------------------------------------------------
// Audit parsing (mirrors aidlc-audit.ts / auditBlockField grammar)
// ---------------------------------------------------------------------------

/** One "**Key**: value" lookup, tolerating a leading "- " list marker. */
export function auditBlockField(
	block: string,
	fieldName: string,
): string | null {
	const prefix = `**${fieldName}**:`;
	for (const raw of block.split("\n")) {
		const line = raw.startsWith("- ") ? raw.slice(2) : raw;
		if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
	}
	return null;
}

/** All "**Key**: value" fields in a block (Event/Timestamp excluded). */
function auditBlockFields(block: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /^(?:-\s*)?\*\*([^*]+)\*\*:\s*(.*)$/;
	for (const raw of block.split("\n")) {
		const m = re.exec(raw);
		if (!m) continue;
		const key = m[1].trim();
		if (key === "Event" || key === "Timestamp") continue;
		out[key] = m[2].trim();
	}
	return out;
}

function parseEpochMs(iso: string): number {
	const t = Date.parse(iso);
	return Number.isNaN(t) ? Number.NaN : t;
}

/** Read + parse every audit shard for the resolved record, in causal order. */
export function readAuditEvents(rec: ResolvedRecord): AuditEvent[] {
	const dir = auditDir(rec);
	let files: string[];
	try {
		files = readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.sort(); // filename order — the engine's own shard ordering
	} catch {
		return [];
	}
	const events: AuditEvent[] = [];
	for (const file of files) {
		let content: string;
		try {
			content = readFileSync(join(dir, file), "utf-8");
		} catch {
			continue; // vanished/racing shard — skip, never fail the read
		}
		const blocks = content.replace(/\r\n/g, "\n").split(/\n---\n/);
		for (let pos = 0; pos < blocks.length; pos++) {
			const block = blocks[pos];
			const event = auditBlockField(block, "Event");
			const timestamp = auditBlockField(block, "Timestamp");
			if (!event || !timestamp) continue;
			events.push({
				event,
				timestamp,
				epochMs: parseEpochMs(timestamp),
				fields: auditBlockFields(block),
				shard: file,
				pos,
			});
		}
	}
	return events;
}

/**
 * Chronological order: Timestamp first, then per-shard append position as the
 * same-shard tiebreak (equal cross-shard timestamps are causally unordered, so
 * we keep them stable by shard index then pos). Mirrors the engine's ordering
 * intent in aidlc-lib.ts.
 */
function chronological(events: AuditEvent[]): AuditEvent[] {
	return [...events].sort((a, b) => {
		if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
		if (a.shard !== b.shard) return a.shard < b.shard ? -1 : 1;
		return a.pos - b.pos;
	});
}

// ---------------------------------------------------------------------------
// State + directive parsing
// ---------------------------------------------------------------------------

/** Value after a "- **Key**: value" or "**Key**: value" markdown line. */
function stateField(content: string, key: string): string | null {
	const re = new RegExp(
		`^\\s*(?:-\\s*)?\\*\\*${escapeRe(key)}\\*\\*:\\s*(.*)$`,
		"m",
	);
	const m = re.exec(content);
	return m ? m[1].trim() : null;
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface StageProgress {
	total: number; // executable stages (not SKIP)
	completed: number; // [x]
	currentIndex: number | null; // 1-based within executable stages, for [-]/[?]/[R]
}

/**
 * Parse the "## Stage Progress" checkboxes.
 * States: [ ] not started, [-] in progress, [?] awaiting approval, [R] revising,
 * [x] completed, [S] skipped. "X of N" counts executable stages (skips excluded).
 */
function parseStageProgress(content: string): StageProgress {
	const lines = content.split("\n");
	const rowRe = /^\s*-\s*\[( |-|\?|R|x|S)\]\s+(\S+)/;
	const executable: { state: string; slug: string }[] = [];
	for (const line of lines) {
		const m = rowRe.exec(line);
		if (!m) continue;
		const state = m[1];
		// A SKIP row is not part of the executable count.
		if (/—\s*SKIP\b/.test(line) || state === "S") continue;
		executable.push({ state, slug: m[2] });
	}
	const total = executable.length;
	const completed = executable.filter((r) => r.state === "x").length;
	const activeIdx = executable.findIndex(
		(r) => r.state === "-" || r.state === "?" || r.state === "R",
	);
	return {
		total,
		completed,
		currentIndex: activeIdx === -1 ? null : activeIdx + 1,
	};
}

interface ActiveDirective {
	kind: string | null;
	stage: string | null;
	delivery: string | null;
	part: number | null;
	parts: number | null;
	continueToken: string | null;
	nextStage: string | null;
	gate: boolean | null;
}

function readActiveDirective(rec: ResolvedRecord): ActiveDirective | null {
	const path = activeDirectivePath(rec);
	if (!path || !existsSync(path)) return null;
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
	} catch {
		return null;
	}
	const sp = (parsed.steering_payload ?? {}) as Record<string, unknown>;
	// steering_payload keys (verified): i=part index, g=gate, n=next stage label,
	// s=stage, c=scope. On a load-steering marker `parts` and `continue_token`
	// are the streaming fields; on a run-stage marker only `i` (part) is present.
	const num = (v: unknown): number | null =>
		typeof v === "number" && Number.isFinite(v) ? v : null;
	const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
	const bool = (v: unknown): boolean | null =>
		typeof v === "boolean" ? v : null;
	return {
		kind: str(parsed.kind),
		stage: str(parsed.stage),
		delivery: str(parsed.delivery),
		part: num(parsed.part) ?? num(sp.i),
		parts: num(parsed.parts) ?? num(sp.parts),
		continueToken:
			str(parsed.continue_token) ?? str(parsed.steering_payload_receipt),
		nextStage: str(sp.n) ?? null,
		gate: bool(sp.g),
	};
}

// ---------------------------------------------------------------------------
// A. LIVE STATUS
// ---------------------------------------------------------------------------

export function buildStatus(projectDir: string): StatusView {
	const rec = resolveRecord(projectDir);
	const events = chronological(readAuditEvents(rec));
	const last = events.length > 0 ? events[events.length - 1] : null;

	const statePath = stateFilePath(rec);
	if (!existsSync(statePath)) {
		return {
			ok: false,
			reason:
				"No active workflow state found. Start one with `aidlc engine intent create` " +
				"then `aidlc engine orchestrate next`.",
			intent: rec.intent,
			space: rec.space,
			recordDir: rec.recordDir,
			phase: null,
			stage: null,
			stageIndex: null,
			stageTotal: null,
			stagesCompleted: null,
			lead: null,
			mode: null,
			nextStage: null,
			nextGate: null,
			status: null,
			directiveKind: null,
			streaming: null,
			lastEventAt: last?.timestamp ?? null,
			lastEvent: last?.event ?? null,
		};
	}

	const content = readFileSync(statePath, "utf-8");
	const progress = parseStageProgress(content);
	const directive = readActiveDirective(rec);

	// Lead + mode come from the most recent STAGE_STARTED / run-stage directive.
	// The directive JSON does not persist lead/mode, so read them from the audit
	// STAGE_STARTED (Agent) plus the state Active Agent.
	const lead = stateField(content, "Active Agent");

	// Streaming: only surface when a load-steering stream is genuinely mid-flight
	// (delivery not fully issued, or a continue token with parts>1).
	let streaming: StreamingView | null = null;
	if (directive) {
		const midStream =
			(directive.parts !== null && directive.parts > 1) ||
			(directive.delivery !== null && directive.delivery !== "issued") ||
			directive.kind === "load-steering";
		if (midStream) {
			streaming = {
				part: directive.part,
				parts: directive.parts,
				continueToken: directive.continueToken,
				delivery: directive.delivery,
			};
		}
	}

	return {
		ok: true,
		intent: rec.intent,
		space: rec.space,
		recordDir: rec.recordDir,
		phase: stateField(content, "Lifecycle Phase"),
		stage: stateField(content, "Current Stage"),
		stageIndex: progress.currentIndex ?? progress.completed + 1,
		stageTotal: progress.total || stateFieldNum(content, "Total Stages"),
		stagesCompleted: progress.completed,
		lead,
		mode:
			directive?.kind === "run-stage" ? "run-stage" : (directive?.kind ?? null),
		nextStage:
			stateField(content, "Next Stage") ?? directive?.nextStage ?? null,
		nextGate: directive?.gate ?? null,
		status: stateField(content, "Status"),
		directiveKind: directive?.kind ?? null,
		streaming,
		lastEventAt: last?.timestamp ?? null,
		lastEvent: last?.event ?? null,
	};
}

function stateFieldNum(content: string, key: string): number | null {
	const v = stateField(content, key);
	if (v === null) return null;
	const n = Number.parseInt(v, 10);
	return Number.isNaN(n) ? null : n;
}

export function renderStatusLine(s: StatusView): string {
	if (!s.ok) return `AIDLC — ${s.reason}`;
	const xofn =
		s.stageIndex !== null && s.stageTotal !== null
			? ` (${s.stageIndex} of ${s.stageTotal})`
			: "";
	const parts = [
		`AIDLC ${s.intent ?? "(space root)"}`,
		`${s.phase ?? "?"} › ${s.stage ?? "?"}${xofn}`,
	];
	if (s.lead) parts.push(`lead=${s.lead}`);
	if (s.mode) parts.push(`mode=${s.mode}`);
	if (s.nextStage)
		parts.push(`next=${s.nextStage}${s.nextGate ? " [gate]" : ""}`);
	if (s.streaming) {
		const p =
			s.streaming.part !== null
				? `part ${s.streaming.part}${s.streaming.parts ? `/${s.streaming.parts}` : ""}`
				: "streaming";
		parts.push(
			`⇢ ${p}${s.streaming.continueToken ? ` tok=${s.streaming.continueToken}` : ""}`,
		);
	}
	if (s.status) parts.push(`status=${s.status}`);
	return parts.join(" | ");
}

// ---------------------------------------------------------------------------
// B. STALL DETECTOR
// ---------------------------------------------------------------------------

export function buildStall(
	projectDir: string,
	thresholdSecs: number = DEFAULT_STALL_THRESHOLD_SECS,
	now: number = Date.now(),
): StallView {
	const rec = resolveRecord(projectDir);
	const events = chronological(readAuditEvents(rec));

	if (events.length === 0) {
		return {
			state: "NO_WORKFLOW",
			reason: "No audit events found — no workflow is running in this project.",
			elapsedSecs: null,
			thresholdSecs,
			lastEvent: null,
			lastEventAt: null,
			humanTurnsSinceEngineActivity: 0,
		};
	}

	const last = events[events.length - 1];

	// Find the most recent ENGINE-ACTIVITY event (anything that is not a bare
	// HUMAN_TURN). Everything after it, up to the tail, that is a HUMAN_TURN is a
	// "bare human turn" — the wedge signature when the tail is one of them.
	let lastEngineIdx = -1;
	for (let i = events.length - 1; i >= 0; i--) {
		if (events[i].event !== HUMAN_PRESENCE_EVENT) {
			lastEngineIdx = i;
			break;
		}
	}
	const bareHumanTurns = events
		.slice(lastEngineIdx + 1)
		.filter((e) => e.event === HUMAN_PRESENCE_EVENT).length;

	const lastEngine = lastEngineIdx >= 0 ? events[lastEngineIdx] : null;

	// The reference time for elapsed is the newest audit event's timestamp; a
	// wedge shows time passing with only human turns after the last engine event.
	const refEpoch = last.epochMs;
	const elapsedSecs = Number.isNaN(refEpoch)
		? null
		: Math.max(0, Math.round((now - refEpoch) / 1000));

	// WEDGED iff: the tail is a bare HUMAN_TURN (no engine activity after the last
	// engine event) AND enough wall-clock time has elapsed since that last engine
	// event. Fail TOWARD signalling: an unparseable/absent last-engine timestamp
	// with bare human turns present still fires (we cannot prove it is busy).
	const tailIsBareHuman =
		last.event === HUMAN_PRESENCE_EVENT && bareHumanTurns > 0;

	if (tailIsBareHuman) {
		const engineEpoch = lastEngine ? lastEngine.epochMs : Number.NaN;
		const quietSecs = Number.isNaN(engineEpoch)
			? Number.POSITIVE_INFINITY // no datable engine activity → cannot prove busy → fire
			: Math.max(0, Math.round((now - engineEpoch) / 1000));
		if (quietSecs >= thresholdSecs) {
			return {
				state: "WEDGED",
				reason:
					`Only ${bareHumanTurns} bare ${HUMAN_PRESENCE_EVENT} event(s) since the last engine ` +
					`activity (${lastEngine?.event ?? "none"} at ${lastEngine?.timestamp ?? "unknown"}); ` +
					`no engine activity for ${Number.isFinite(quietSecs) ? `${quietSecs}s` : "an unmeasurable interval"} ` +
					`(threshold ${thresholdSecs}s). This is the hung-hook signature.`,
				elapsedSecs: Number.isFinite(quietSecs) ? quietSecs : elapsedSecs,
				thresholdSecs,
				lastEvent: last.event,
				lastEventAt: last.timestamp,
				humanTurnsSinceEngineActivity: bareHumanTurns,
				likelyHook: WEDGE_HOOK,
				remedy: WEDGE_REMEDY,
			};
		}
	}

	// Not wedged. BUSY if recent, IDLE if the log is simply old and settled.
	const busy =
		elapsedSecs === null ? true : elapsedSecs < Math.max(thresholdSecs, 1);
	return {
		state: busy ? "BUSY" : "IDLE",
		reason: busy
			? `Engine active — last event ${last.event}` +
				(elapsedSecs !== null ? ` ${formatElapsed(elapsedSecs)} ago` : "") +
				(bareHumanTurns > 0
					? `; ${bareHumanTurns} human turn(s) since last engine activity but under threshold`
					: "")
			: `Idle — last event ${last.event} ${elapsedSecs !== null ? formatElapsed(elapsedSecs) : ""} ago, ` +
				`no bare-human-turn wedge signature.`,
		elapsedSecs,
		thresholdSecs,
		lastEvent: last.event,
		lastEventAt: last.timestamp,
		humanTurnsSinceEngineActivity: bareHumanTurns,
	};
}

function formatElapsed(secs: number): string {
	if (secs < 60) return `${secs}s`;
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	return s === 0 ? `${m}m` : `${m}m${s}s`;
}

export function renderStallLine(v: StallView): string {
	const badge =
		v.state === "WEDGED"
			? "⛔ WEDGED"
			: v.state === "BUSY"
				? "⏳ BUSY"
				: v.state === "IDLE"
					? "· IDLE"
					: "○ NO WORKFLOW";
	let line = `${badge} — ${v.reason}`;
	if (v.state === "WEDGED") {
		line += `\n  likely: ${v.likelyHook}\n  remedy: ${v.remedy}`;
	}
	return line;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Cli {
	cmd: string;
	projectDir: string;
	json: boolean;
	thresholdSecs: number;
	intervalSecs: number;
}

function parseCli(argv: string[]): Cli {
	const cmd = argv[0] ?? "status";
	let projectDir = process.cwd();
	let json = false;
	let thresholdSecs = DEFAULT_STALL_THRESHOLD_SECS;
	let intervalSecs = 5;
	for (let i = 1; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--project-dir" && i + 1 < argv.length) projectDir = argv[++i];
		else if (a === "--json") json = true;
		else if (a === "--threshold-secs" && i + 1 < argv.length)
			thresholdSecs = Number(argv[++i]);
		else if (a === "--interval-secs" && i + 1 < argv.length)
			intervalSecs = Number(argv[++i]);
	}
	return { cmd, projectDir, json, thresholdSecs, intervalSecs };
}

function runOnce(cli: Cli): void {
	if (cli.cmd === "status") {
		const s = buildStatus(cli.projectDir);
		if (cli.json) console.log(JSON.stringify(s));
		else console.log(renderStatusLine(s));
		return;
	}
	if (cli.cmd === "stall") {
		const v = buildStall(cli.projectDir, cli.thresholdSecs);
		if (cli.json) console.log(JSON.stringify(v));
		else console.log(renderStallLine(v));
		if (v.state === "WEDGED") process.exitCode = 3;
		return;
	}
	if (cli.cmd === "both") {
		const s = buildStatus(cli.projectDir);
		const v = buildStall(cli.projectDir, cli.thresholdSecs);
		if (cli.json) console.log(JSON.stringify({ status: s, stall: v }));
		else {
			console.log(renderStatusLine(s));
			console.log(renderStallLine(v));
		}
		return;
	}
	console.error(
		`Usage: aidlc-live-status.ts <status|stall|both|watch> [--project-dir <path>] ` +
			`[--json] [--threshold-secs N] [--interval-secs N]`,
	);
	process.exitCode = 2;
}

async function runWatch(cli: Cli): Promise<void> {
	// A conductor could poll buildStatus()/buildStall() directly; `watch` is the
	// human-facing rolling line. Ctrl-C to stop.
	const tick = (): void => {
		const s = buildStatus(cli.projectDir);
		const v = buildStall(cli.projectDir, cli.thresholdSecs);
		const stamp = new Date().toISOString();
		process.stdout.write(
			`\n[${stamp}] ${renderStatusLine(s)}\n           ${renderStallLine(v)}\n`,
		);
	};
	tick();
	await new Promise<void>(() => {
		setInterval(tick, Math.max(1, cli.intervalSecs) * 1000);
	});
}

// Entry: run under bun. `import.meta.main` is true only when this file is the
// program entry, so importing it as a library (the tests) never fires the CLI.
if (import.meta.main) {
	const cli = parseCli(process.argv.slice(2));
	if (cli.cmd === "watch") {
		void runWatch(cli);
	} else {
		runOnce(cli);
	}
}
