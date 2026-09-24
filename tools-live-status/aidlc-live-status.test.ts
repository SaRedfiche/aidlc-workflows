// aidlc-live-status.test.ts — bun test suite for the standalone reader.
// Run: bun test aidlc-live-status.test.ts   (from tools-live-status/)
//
// Covers the two behaviours that matter and are fragile:
//   1. audit-grammar parsing + status assembly against the engine's real block
//      grammar (built here as bytes, matching aidlc-audit.ts renderAuditBlock);
//   2. the BUSY / WEDGED / IDLE decision with a DETERMINISTIC injected clock, so
//      the wedge threshold is tested without real waits.

import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	auditBlockField,
	buildStall,
	buildStatus,
	DEFAULT_STALL_THRESHOLD_SECS,
	readAuditEvents,
	resolveRecord,
} from "./aidlc-live-status.ts";

let root: string;
const REC = "aidlc/spaces/default/intents/250101-demo";

function auditBlock(
	event: string,
	ts: string,
	fields: Record<string, string> = {},
): string {
	let b = `\n## ${event}\n**Timestamp**: ${ts}\n**Event**: ${event}\n`;
	for (const [k, v] of Object.entries(fields)) b += `**${k}**: ${v}\n`;
	return `${b}\n---\n`;
}

function writeAudit(blocks: string[]): void {
	const dir = join(root, REC, "audit");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "shard-a.md"),
		`# AI-DLC Audit Log${blocks.join("")}`,
	);
}

function writeState(body: string): void {
	const dir = join(root, REC);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "aidlc-state.md"), body);
}

const STATE = `# AI-DLC State Tracking

## Project Information
- **Active Agent**: aidlc-developer-agent

## Execution Plan Summary
- **Total Stages**: 25
- **Completed**: 3

## Stage Progress
- [x] workspace-scaffold — EXECUTE
- [x] workspace-detection — EXECUTE
- [x] state-init — EXECUTE
- [-] practices-discovery — EXECUTE
- [ ] requirements-analysis — EXECUTE
- [ ] intent-capture — SKIP

## Current Status
- **Lifecycle Phase**: INCEPTION
- **Current Stage**: practices-discovery
- **Next Stage**: requirements-analysis
- **Status**: Running
`;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "aidlc-live-status-test-"));
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

test("auditBlockField reads a field and tolerates a leading list marker", () => {
	const block =
		"## Human Turn\n**Timestamp**: 2025-01-01T00:00:00Z\n**Event**: HUMAN_TURN\n- **Session**: s1\n";
	expect(auditBlockField(block, "Event")).toBe("HUMAN_TURN");
	expect(auditBlockField(block, "Session")).toBe("s1");
	expect(auditBlockField(block, "Absent")).toBeNull();
});

test("readAuditEvents parses the engine block grammar in order", () => {
	writeAudit([
		auditBlock("WORKFLOW_STARTED", "2025-01-01T00:00:00Z", {
			Scope: "workshop",
		}),
		auditBlock("STAGE_STARTED", "2025-01-01T00:00:01Z", {
			Stage: "practices-discovery",
		}),
	]);
	const events = readAuditEvents(resolveRecord(root));
	expect(events.map((e) => e.event)).toEqual([
		"WORKFLOW_STARTED",
		"STAGE_STARTED",
	]);
	expect(events[1].fields.Stage).toBe("practices-discovery");
});

test("buildStatus reports stage X of N, phase, lead, next+gate", () => {
	writeState(STATE);
	writeAudit([
		auditBlock("STAGE_STARTED", "2025-01-01T00:00:01Z", {
			Stage: "practices-discovery",
		}),
	]);
	const s = buildStatus(root);
	expect(s.ok).toBe(true);
	expect(s.phase).toBe("INCEPTION");
	expect(s.stage).toBe("practices-discovery");
	// executable stages exclude the SKIP row → 5, current [-] at index 4
	expect(s.stageTotal).toBe(5);
	expect(s.stageIndex).toBe(4);
	expect(s.stagesCompleted).toBe(3);
	expect(s.lead).toBe("aidlc-developer-agent");
	expect(s.nextStage).toBe("requirements-analysis");
	expect(s.status).toBe("Running");
});

test("buildStatus is honest when no workflow state exists", () => {
	const s = buildStatus(root);
	expect(s.ok).toBe(false);
	expect(s.reason).toContain("No active workflow");
});

test("stall: engine activity in the tail is BUSY, not wedged", () => {
	const now = Date.parse("2025-01-01T00:10:00Z");
	writeAudit([
		auditBlock("HUMAN_TURN", "2025-01-01T00:00:00Z"),
		auditBlock("STAGE_STARTED", "2025-01-01T00:09:59Z", { Stage: "x" }),
	]);
	const v = buildStall(root, DEFAULT_STALL_THRESHOLD_SECS, now);
	expect(v.state).toBe("BUSY");
});

test("stall: bare HUMAN_TURN tail past threshold is WEDGED with the hook + remedy", () => {
	const now = Date.parse("2025-01-01T00:10:00Z");
	writeAudit([
		auditBlock("STAGE_STARTED", "2025-01-01T00:05:00Z", {
			Stage: "code-generation",
		}),
		auditBlock("HUMAN_TURN", "2025-01-01T00:06:00Z"),
		auditBlock("HUMAN_TURN", "2025-01-01T00:08:00Z"),
		auditBlock("HUMAN_TURN", "2025-01-01T00:09:30Z"),
	]);
	const v = buildStall(root, 90, now);
	expect(v.state).toBe("WEDGED");
	expect(v.humanTurnsSinceEngineActivity).toBe(3);
	expect(v.likelyHook).toContain("plan-approval-guard");
	expect(v.remedy).toContain("AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1");
});

test("stall: bare HUMAN_TURN tail UNDER threshold is still BUSY", () => {
	const now = Date.parse("2025-01-01T00:06:30Z"); // 90s after the last engine event
	writeAudit([
		auditBlock("STAGE_STARTED", "2025-01-01T00:05:00Z", {
			Stage: "code-generation",
		}),
		auditBlock("HUMAN_TURN", "2025-01-01T00:05:30Z"),
	]);
	// 90s exactly meets threshold → wedged; test just under with threshold 120.
	const v = buildStall(root, 120, now);
	expect(v.state).toBe("BUSY");
	expect(v.humanTurnsSinceEngineActivity).toBe(1);
});

test("stall: empty project is NO_WORKFLOW", () => {
	const v = buildStall(root, 90, Date.now());
	expect(v.state).toBe("NO_WORKFLOW");
});

test("stall: fail-toward-signalling — bare HUMAN_TURN tail with unparseable turn timestamps still WEDGES", () => {
	const now = Date.parse("2025-01-01T00:10:00Z");
	// Datable engine event long ago, then bare human turns whose OWN timestamps
	// are unparseable. The tail is a HUMAN_TURN (lexically after the ISO engine
	// stamp), the engine has been quiet for 5 minutes, so the quiet interval is
	// measured from the engine event and the wedge fires — the detector never
	// reads the ungradable human stamp as "fresh engine activity".
	writeAudit([
		auditBlock("STAGE_STARTED", "2025-01-01T00:05:00Z", {
			Stage: "code-generation",
		}),
		auditBlock("HUMAN_TURN", "zzz-unparseable-1"),
		auditBlock("HUMAN_TURN", "zzz-unparseable-2"),
	]);
	const v = buildStall(root, 90, now);
	expect(v.state).toBe("WEDGED");
	expect(v.humanTurnsSinceEngineActivity).toBe(2);
});
