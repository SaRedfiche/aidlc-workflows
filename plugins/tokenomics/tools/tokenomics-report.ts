#!/usr/bin/env bun
// tokenomics-report.ts — the tokenomics plugin's runtime tool.
//
// READ-ONLY. It answers "what did AI cost to build this feature?" by rendering
// the usage ledger core ALREADY keeps (aidlc-usage.ts): per-stage, per-model,
// per-agent token + list-price cost, scoped to one intent (= one feature). This
// tool adds NO capture and NO transcript I/O — it loads the ledger and formats.
//
// The one piece of genuinely new aggregation here is phaseRollup: the ledger
// keys usage by STAGE slug but not by PHASE, so this folds stages into phase
// buckets using a stage→phase map (resolved at the CLI edge from the composed
// stage files; the pure functions take the map as input so they stay testable).
//
// HARNESS SCOPE. Capture is Claude-transcript-specific — only the Claude harness
// wires a ledger producer. On Kiro/Codex/opencode the ledger is empty, so the
// report renders an honest empty state, never a fabricated zero. Likewise the
// cost is a LIST-PRICE ESTIMATE (DEFAULT_RATES / $AIDLC_MODEL_RATES), not a
// billed figure — every headline says so.
//
// This tool composes INTO the harness tools dir alongside core, so it imports
// core helpers as siblings (./aidlc-usage.ts, ./aidlc-lib.ts) — the same way the
// core tools import each other post-compose.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Core dependency note: this tool composes INTO the harness tools dir alongside
// core, so at RUNTIME it loads core's usage ledger as a sibling module
// (./aidlc-usage.ts) via a lazy require inside main(). The pure functions below
// take plain data and are free of any core import, so they compile and test in
// the authored repo (where the sibling does not exist) and run post-compose
// (where it does). The structural types core exposes are mirrored locally.

// --- structural mirrors of core's aidlc-usage.ts shapes ---------------------
export type TokenCounts = {
  input: number;
  output: number;
  cacheCreate5m: number;
  cacheCreate1h: number;
  cacheRead: number;
};
export type Totals = { tokens: TokenCounts; usd: number };
export type StageBucket = {
  totals: Totals;
  byModel: Record<string, Totals>;
  byAgent: Record<string, Totals>;
};
export type UsageAggregate = {
  totals: Totals;
  byStage: Record<string, StageBucket>;
  byModel: Record<string, Totals>;
  byAgent: Record<string, Totals>;
};
// The subset of core's usage API this tool calls at runtime.
type UsageCore = {
  intentUsageKey: (projectDir: string, sessionId?: string) => string;
  loadLedger: (projectDir: string) => {
    workflows: Record<
      string,
      UsageAggregate & { sessions: Record<string, unknown> }
    >;
  };
  loadRates: () => Record<string, unknown>;
};

// ===========================================================================
// Phase model
// ===========================================================================

// The five AI-DLC phases, in workflow order (mirrors aidlc-stage-schema.ts
// VALID_PHASES). A stage whose phase is unknown/unmapped is bucketed under
// "unattributed" so its cost is never silently dropped.
export const PHASE_ORDER = [
  "initialization",
  "ideation",
  "inception",
  "construction",
  "operation",
] as const;
export type Phase = (typeof PHASE_ORDER)[number];
export const UNATTRIBUTED_PHASE = "unattributed";

// A stage→phase lookup: stage slug → phase string. Built from stage-file
// frontmatter at the CLI edge; injected into the pure rollup so tests supply
// their own map.
export type StagePhaseMap = Record<string, string>;

// ===========================================================================
// Pure aggregation + formatting (no I/O — the testable core)
// ===========================================================================

function emptyTokenCounts() {
  return { input: 0, output: 0, cacheCreate5m: 0, cacheCreate1h: 0, cacheRead: 0 };
}
function emptyTotals(): Totals {
  return { tokens: emptyTokenCounts(), usd: 0 };
}

// Fold one Totals into an accumulator (mutates + returns it).
function addTotals(acc: Totals, t: Totals): Totals {
  acc.tokens.input += t.tokens.input;
  acc.tokens.output += t.tokens.output;
  acc.tokens.cacheCreate5m += t.tokens.cacheCreate5m;
  acc.tokens.cacheCreate1h += t.tokens.cacheCreate1h;
  acc.tokens.cacheRead += t.tokens.cacheRead;
  acc.usd += t.usd;
  return acc;
}

export type PhaseRow = {
  phase: string;
  totals: Totals;
  stages: { slug: string; totals: Totals }[];
};

// Fold an aggregate's byStage buckets into per-phase rows, ordered by
// PHASE_ORDER (then "unattributed" last). A stage missing from the map lands in
// "unattributed" so its cost stays visible. Pure.
export function phaseRollup(
  aggregate: Pick<UsageAggregate, "byStage">,
  stagePhase: StagePhaseMap,
): PhaseRow[] {
  const byPhase = new Map<string, PhaseRow>();
  for (const [slug, bucket] of Object.entries(aggregate.byStage)) {
    const phase = stagePhase[slug] ?? UNATTRIBUTED_PHASE;
    const row =
      byPhase.get(phase) ?? { phase, totals: emptyTotals(), stages: [] };
    addTotals(row.totals, bucket.totals);
    row.stages.push({ slug, totals: bucket.totals });
    byPhase.set(phase, row);
  }
  const order = (p: string): number => {
    const i = (PHASE_ORDER as readonly string[]).indexOf(p);
    return i < 0 ? PHASE_ORDER.length : i; // unattributed sorts last
  };
  return [...byPhase.values()].sort((a, b) => order(a.phase) - order(b.phase));
}

// Sum every model/agent sub-bucket's USD, keyed. Preserves a null-cost (unknown
// model) slice as the sentinel key so it stays visible. Pure.
export function costByKey(buckets: Record<string, Totals>): { key: string; usd: number }[] {
  return Object.entries(buckets)
    .map(([key, t]) => ({ key, usd: t.usd }))
    .sort((a, b) => b.usd - a.usd);
}

// Whether an aggregate recorded any tokens at all.
export function hasAnyTokens(t: Totals): boolean {
  const c = t.tokens;
  return c.input + c.output + c.cacheCreate5m + c.cacheCreate1h + c.cacheRead > 0;
}

// Compact token count: 1234 → "1.2k", 3_400_000 → "3.4M". Mirrors
// aidlc-usage.ts fmtTokensCompact. Pure.
export function fmtTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const trim = (s: string): string => s.replace(/\.0$/, "");
  if (n >= 1e6) return `${trim((n / 1e6).toFixed(1))}M`;
  if (n >= 1e3) return `${trim((n / 1e3).toFixed(1))}k`;
  return String(Math.round(n));
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export type ReportModel = {
  // Whether any usage was recorded for this feature at all.
  hasData: boolean;
  // Whether usage tracking is disabled (no ledger will ever exist).
  trackingDisabled: boolean;
  feature: string;
  totals: Totals;
  phases: PhaseRow[];
  byModel: { key: string; usd: number }[];
  byAgent: { key: string; usd: number }[];
  sessionCount: number;
  // Known rate-table keys, so the renderer can flag an unknown-model slice.
  knownModels: Set<string>;
  // True when the usage-ledger module could not be loaded for an UNEXPECTED
  // reason (not a plain pre-compose absence). Surfaced in the report body AND
  // via a non-zero exit code so a "no usage" artifact is never mistaken for a
  // silent load failure.
  loadError: boolean;
};

// Build the report model from a feature aggregate. Pure given its inputs.
export function buildReportModel(args: {
  feature: string;
  aggregate: UsageAggregate | null;
  sessionCount: number;
  stagePhase: StagePhaseMap;
  knownModels: Set<string>;
  trackingDisabled: boolean;
  loadError?: boolean;
}): ReportModel {
  const { feature, aggregate, sessionCount, stagePhase, knownModels, trackingDisabled } = args;
  const loadError = args.loadError ?? false;
  if (!aggregate || !hasAnyTokens(aggregate.totals)) {
    return {
      hasData: false,
      trackingDisabled,
      feature,
      totals: emptyTotals(),
      phases: [],
      byModel: [],
      byAgent: [],
      sessionCount,
      knownModels,
      loadError,
    };
  }
  return {
    hasData: true,
    trackingDisabled,
    feature,
    totals: aggregate.totals,
    phases: phaseRollup(aggregate, stagePhase),
    byModel: costByKey(aggregate.byModel),
    byAgent: costByKey(aggregate.byAgent),
    sessionCount,
    knownModels,
    loadError,
  };
}

// A model bucket's displayed cost: a known model shows its USD; an unknown
// model (not in the rate table) shows "—" because its cost is withheld, never
// fabricated.
function modelCostCell(key: string, usd: number, known: Set<string>): string {
  return known.has(key) ? fmtUsd(usd) : "— (unpriced)";
}

// Render the report as Markdown. Pure.
export function renderMarkdown(m: ReportModel): string {
  const L: string[] = [];
  L.push(`# AI tokenomics — ${m.feature}`);
  L.push("");
  if (m.loadError) {
    L.push(
      "> ⚠ **Could not load the usage ledger module** — this report could not read usage. This is a load failure, NOT an absence of usage: if a workshop recorded cost, it is not reflected below. Fix the install (re-run the plugin compose / `plugin-sync`) and re-run.",
    );
    L.push("");
  }
  if (!m.hasData) {
    L.push(
      m.trackingDisabled
        ? "Usage tracking is disabled (`AIDLC_DISABLE_USAGE_TRACKING=1`), so no cost was recorded for this feature."
        : m.loadError
          ? "No cost is shown because the ledger could not be read (see the warning above)."
          : "No usage was recorded for this feature. Token/cost capture is wired only in the Claude harness; on other harnesses the ledger is empty.",
    );
    return `${L.join("\n")}\n`;
  }
  const t = m.totals;
  const cacheWrite = t.tokens.cacheCreate5m + t.tokens.cacheCreate1h;
  L.push(
    `**Estimated cost: ${fmtUsd(t.usd)}** · ${fmtTokens(t.tokens.input + t.tokens.output + t.tokens.cacheRead + cacheWrite)} tokens · ${m.sessionCount} session(s)`,
  );
  L.push("");
  L.push("> List-price estimate, not a billed figure — priced from AI-DLC's default/overridable rate table, not from provisioned-throughput or negotiated AWS pricing.");
  L.push("");
  L.push("## By phase");
  L.push("");
  L.push("| Phase | Cost | Tokens (in/out/cacheR/cacheW) |");
  L.push("| --- | --- | --- |");
  for (const p of m.phases) {
    const pt = p.totals.tokens;
    L.push(
      `| ${p.phase} | ${fmtUsd(p.totals.usd)} | ${fmtTokens(pt.input)}/${fmtTokens(pt.output)}/${fmtTokens(pt.cacheRead)}/${fmtTokens(pt.cacheCreate5m + pt.cacheCreate1h)} |`,
    );
  }
  L.push("");
  L.push("## By stage");
  L.push("");
  L.push("| Phase | Stage | Cost |");
  L.push("| --- | --- | --- |");
  for (const p of m.phases) {
    for (const s of p.stages) {
      L.push(`| ${p.phase} | ${s.slug} | ${fmtUsd(s.totals.usd)} |`);
    }
  }
  L.push("");
  L.push("## By model");
  L.push("");
  L.push("| Model | Cost |");
  L.push("| --- | --- |");
  for (const r of m.byModel) {
    L.push(`| ${r.key} | ${modelCostCell(r.key, r.usd, m.knownModels)} |`);
  }
  L.push("");
  L.push("## By agent (main vs swarm)");
  L.push("");
  L.push("| Agent | Cost |");
  L.push("| --- | --- |");
  for (const r of m.byAgent) {
    L.push(`| ${r.key} | ${fmtUsd(r.usd)} |`);
  }
  L.push("");
  L.push("## Cache economics");
  L.push("");
  L.push(
    `Cache reads: ${fmtTokens(t.tokens.cacheRead)} tokens · cache writes: ${fmtTokens(cacheWrite)} tokens. Cache reads are priced at a fraction of input (0.025–0.2×), so a high read:write ratio is cost AI-DLC's caching already saved you.`,
  );
  return `${L.join("\n")}\n`;
}

// Render a compact terminal summary. Pure.
export function renderTable(m: ReportModel): string {
  if (!m.hasData) {
    if (m.loadError) {
      return `tokenomics — ${m.feature}: ⚠ could not load the usage ledger module — load failure, not an absence of usage. Fix the install and re-run.\n`;
    }
    return m.trackingDisabled
      ? `tokenomics — ${m.feature}: usage tracking disabled, nothing recorded.\n`
      : `tokenomics — ${m.feature}: no usage recorded (Claude-harness-only capture).\n`;
  }
  const t = m.totals;
  const lines = [
    `tokenomics — ${m.feature}`,
    `  estimated cost : ${fmtUsd(t.usd)}  (list-price estimate)`,
    `  sessions       : ${m.sessionCount}`,
    `  by phase       :`,
    ...m.phases.map((p) => `    ${p.phase.padEnd(14)} ${fmtUsd(p.totals.usd)}`),
    `  by model       :`,
    ...m.byModel.map((r) => `    ${r.key.padEnd(14)} ${modelCostCell(r.key, r.usd, m.knownModels)}`),
    `  by agent       :`,
    ...m.byAgent.map((r) => `    ${r.key.padEnd(14)} ${fmtUsd(r.usd)}`),
  ];
  return `${lines.join("\n")}\n`;
}

// A JSON-safe view of the report. An unknown model (absent from the rate table)
// has its cost rendered as `null`, NOT its raw 0 — matching the "unpriced"
// discipline of the Markdown/table renderers, so a `--json` consumer never
// reads a fabricated zero-dollar price for an unpriceable model. Pure.
export function toJsonView(m: ReportModel): Record<string, unknown> {
  return {
    hasData: m.hasData,
    trackingDisabled: m.trackingDisabled,
    loadError: m.loadError,
    feature: m.feature,
    totals: m.totals,
    phases: m.phases,
    byModel: m.byModel.map((r) => ({
      key: r.key,
      usd: m.knownModels.has(r.key) ? r.usd : null,
    })),
    byAgent: m.byAgent,
    sessionCount: m.sessionCount,
    knownModels: [...m.knownModels],
  };
}

// ===========================================================================
// I/O edge — resolve the stage→phase map from composed stage files
// ===========================================================================

// Parse a stage markdown file's `slug:` and `phase:` frontmatter. Returns null
// when either is absent. Never throws.
export function stagePhaseFromFile(path: string): { slug: string; phase: string } | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return null;
  }
  // Capture the whole trimmed value, not just the first token: `\S+` would stop
  // at the first space and silently misroute a multi-word or quoted `phase:`
  // value to "unattributed" with no diagnostic. A quoted value is unquoted so
  // `phase: "operation"` and `phase: operation` resolve identically.
  const slug = raw.match(/^slug:\s*(\S+)\s*$/m)?.[1];
  const phaseRaw = raw.match(/^phase:\s*(.+?)\s*$/m)?.[1];
  const phase = phaseRaw?.replace(/^["']|["']$/g, "");
  return slug && phase ? { slug, phase } : null;
}

// Recursively collect every stage→phase pair under the given stage roots.
export function resolveStagePhaseMap(stageDirs: string[]): StagePhaseMap {
  const map: StagePhaseMap = {};
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) walk(full);
      else if (name.endsWith(".md")) {
        const parsed = stagePhaseFromFile(full);
        if (parsed) map[parsed.slug] = parsed.phase;
      }
    }
  };
  for (const d of stageDirs) walk(d);
  return map;
}

// The stage roots a composed harness exposes: core common stages plus any
// plugin stages, under the harness dir. Best-effort — a missing dir contributes
// nothing (its stages fall to "unattributed").
function harnessStageDirs(projectDir: string, harnessDir: string): string[] {
  const root = join(projectDir, harnessDir);
  const candidates = [
    join(root, "aidlc-common", "stages"),
    join(root, "stages"),
  ];
  return candidates.filter((d) => existsSync(d));
}

// ===========================================================================
// CLI entry — read-only
// ===========================================================================

export function main(argv: string[]): number {
  const projectDir = process.env.AIDLC_PROJECT_DIR ?? process.cwd();
  const harnessDir = process.env.AIDLC_HARNESS_DIR ?? ".claude";
  const sessionId = process.env.AIDLC_SESSION_ID || undefined;
  const asJson = argv.includes("--json");
  const asTable = argv.includes("--table");

  const trackingDisabled = process.env.AIDLC_DISABLE_USAGE_TRACKING === "1";

  // Load core's usage API as a sibling at runtime (post-compose this tool lives
  // next to aidlc-usage.ts in the harness tools dir). Kept out of the module's
  // top-level imports so the pure logic compiles/tests without the sibling. If
  // the sibling cannot be loaded we DO NOT crash — but we DO emit a stderr
  // diagnostic so the two cases are distinguishable: a genuinely-absent sibling
  // (pre-compose / a harness with no producer) is the expected empty-state path
  // and prints nothing extra, whereas an UNEXPECTED load failure (a corrupt or
  // wrong-shape module) warns on stderr before degrading, so an operator is
  // never left reading "no usage recorded" when the ledger actually failed to
  // load. stdout (the report contract) is unchanged either way.
  let core: UsageCore | null = null;
  let loadError = false;
  try {
    core = require("./aidlc-usage.ts") as UsageCore;
  } catch (err) {
    core = null;
    const msg = err instanceof Error ? err.message : String(err);
    // The ONLY expected failure is the sibling itself being absent (pre-compose
    // / a harness with no producer): that is the honest empty-state path. A
    // module-not-found for ANY OTHER module (a missing TRANSITIVE dependency of
    // a present aidlc-usage.ts), or any other error shape, is an UNEXPECTED load
    // failure — flag it so stdout/exit surface it, never silently "no usage".
    //
    // Classify on the QUOTED missing-module name only. The runtime error reads
    // `Cannot find module '<missing>' imported from '<importer>'`, and the
    // importer tail is always .../aidlc-usage.ts here — so matching the whole
    // message would wrongly treat a transitive miss (missing <missing>, importer
    // aidlc-usage.ts) as the expected case. Pull out `<missing>` and check only
    // that it names aidlc-usage.
    const missingModule = msg.match(/cannot find module ['"]([^'"]+)['"]/i)?.[1];
    const expectedMissing =
      missingModule !== undefined && /aidlc-usage(\.ts)?$/i.test(missingModule);
    if (!expectedMissing) {
      loadError = true;
      process.stderr.write(
        `tokenomics-report: could not load the usage ledger module (${msg}); reporting a load-failure state, not an absence of usage.\n`,
      );
    }
  }

  let model: ReportModel;
  if (!core) {
    model = buildReportModel({
      feature: "this feature",
      aggregate: null,
      sessionCount: 0,
      stagePhase: {},
      knownModels: new Set(),
      trackingDisabled,
      loadError,
    });
  } else {
    const workflowKey = core.intentUsageKey(projectDir, sessionId);
    const feature = workflowKey.replace(/^(intent|record):/, "");
    const ledger = core.loadLedger(projectDir);
    const workflow = ledger.workflows[workflowKey] ?? null;
    const aggregate: UsageAggregate | null = workflow
      ? { totals: workflow.totals, byStage: workflow.byStage, byModel: workflow.byModel, byAgent: workflow.byAgent }
      : null;
    const sessionCount = workflow ? Object.keys(workflow.sessions).length : 0;
    const stagePhase = resolveStagePhaseMap(harnessStageDirs(projectDir, harnessDir));
    const knownModels = new Set(Object.keys(core.loadRates()));
    model = buildReportModel({
      feature,
      aggregate,
      sessionCount,
      stagePhase,
      knownModels,
      trackingDisabled,
    });
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(toJsonView(model))}\n`);
  } else if (asTable) {
    process.stdout.write(renderTable(model));
  } else {
    process.stdout.write(renderMarkdown(model));
  }
  // Non-zero only on an UNEXPECTED ledger-load failure, so an agent/harness
  // step that checks the exit code sees it even if it captured only stdout. A
  // genuinely-empty ledger (expected absence) is still a success (0).
  return model.loadError ? 1 : 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
