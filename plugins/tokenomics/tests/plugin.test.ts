// The tokenomics plugin's own content validation + the report tool's pure logic.
//
// Run: bun test plugins/tokenomics/tests/plugin.test.ts

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validatePluginContent,
  walkMarkdownFiles,
} from "../../../tests/harness/plugin-kit.ts";
import {
  buildReportModel,
  costByKey,
  fmtTokens,
  phaseRollup,
  renderMarkdown,
  renderTable,
  resolveStagePhaseMap,
  toJsonView,
  NO_STAGE_PHASE,
  UNATTRIBUTED_PHASE,
  type Totals,
  type UsageAggregate,
} from "../tools/tokenomics-report.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..");

// --- fixtures ---------------------------------------------------------------

function totals(usd: number, input = 0, output = 0, cacheRead = 0, cacheWrite = 0): Totals {
  return {
    tokens: { input, output, cacheCreate5m: cacheWrite, cacheCreate1h: 0, cacheRead },
    usd,
  };
}

function fixtureAggregate(): UsageAggregate {
  return {
    totals: totals(6.0, 1000, 500, 2000, 300),
    byStage: {
      "requirements-analysis": { totals: totals(2.0, 400, 100, 0, 0), byModel: {}, byAgent: {} },
      "code-generation": { totals: totals(3.0, 500, 350, 2000, 300), byModel: {}, byAgent: {} },
      "deployment-execution": { totals: totals(1.0, 100, 50, 0, 0), byModel: {}, byAgent: {} },
    },
    byModel: {
      "opus-4-8": totals(4.0),
      "haiku-4-5": totals(2.0),
      "mystery-9": totals(0, 500, 100, 0, 0), // unknown model, has tokens → unpriced
    },
    byAgent: {
      main: totals(5.0),
      subagent: totals(1.0),
    },
  };
}

const STAGE_PHASE = {
  "requirements-analysis": "inception",
  "code-generation": "construction",
  // deployment-execution deliberately UNMAPPED → unattributed
};

const KNOWN = new Set(["opus-4-8", "haiku-4-5", "sonnet-4-6"]);

// --- content validation -----------------------------------------------------

describe("tokenomics plugin own content validation", () => {
  test("passes the reusable plugin content validator", () => {
    expect(validatePluginContent(PLUGIN_ROOT)).toEqual([]);
  });

  test("ships a stage and an agent", () => {
    expect(walkMarkdownFiles(join(PLUGIN_ROOT, "stages")).length).toBeGreaterThan(0);
    expect(walkMarkdownFiles(join(PLUGIN_ROOT, "agents")).length).toBeGreaterThan(0);
  });
});

// --- fmtTokens --------------------------------------------------------------

describe("fmtTokens", () => {
  test("compacts at k and M scale, trims trailing .0, floors non-positive", () => {
    expect(fmtTokens(500)).toBe("500");
    expect(fmtTokens(1200)).toBe("1.2k");
    expect(fmtTokens(2000)).toBe("2k");
    expect(fmtTokens(3_400_000)).toBe("3.4M");
    expect(fmtTokens(0)).toBe("0");
    // A negative count is corruption — surfaced, not hidden as 0.
    expect(fmtTokens(-5)).toBe("⚠-5");
  });
});

// --- phaseRollup ------------------------------------------------------------

describe("phaseRollup", () => {
  test("folds stages into phases in canonical order, unmapped → unattributed last", () => {
    const rows = phaseRollup(fixtureAggregate(), STAGE_PHASE);
    expect(rows.map((r) => r.phase)).toEqual([
      "inception",
      "construction",
      UNATTRIBUTED_PHASE,
    ]);
  });

  test("sums each phase's cost from its stage buckets", () => {
    const rows = phaseRollup(fixtureAggregate(), STAGE_PHASE);
    const byPhase = Object.fromEntries(rows.map((r) => [r.phase, r.totals.usd]));
    expect(byPhase.inception).toBeCloseTo(2.0);
    expect(byPhase.construction).toBeCloseTo(3.0);
    expect(byPhase[UNATTRIBUTED_PHASE]).toBeCloseTo(1.0); // unmapped stage kept, not dropped
  });

  test("preserves the unmapped stage under its stage list", () => {
    const rows = phaseRollup(fixtureAggregate(), STAGE_PHASE);
    const un = rows.find((r) => r.phase === UNATTRIBUTED_PHASE);
    expect(un).toBeDefined();
    expect(un?.stages.map((s) => s.slug)).toEqual(["deployment-execution"]);
  });

  test("emits a no-stage residual so phase sums reconcile to the headline total", () => {
    // totals.usd = 10 but byStage sums to only 6 → a $4 stageless residual.
    const agg: UsageAggregate = {
      totals: totals(10.0, 1000, 0, 0, 0),
      byStage: {
        "code-generation": { totals: totals(6.0, 600, 0, 0, 0), byModel: {}, byAgent: {} },
      },
      byModel: { "opus-4-8": totals(10.0, 1000, 0, 0, 0) },
      byAgent: { main: totals(10.0, 1000, 0, 0, 0) },
    };
    const rows = phaseRollup(agg, { "code-generation": "construction" });
    const residual = rows.find((r) => r.phase === NO_STAGE_PHASE);
    expect(residual).toBeDefined();
    expect(residual?.totals.usd).toBeCloseTo(4.0);
    // The phase table now reconciles to the headline total.
    const sum = rows.reduce((s, r) => s + r.totals.usd, 0);
    expect(sum).toBeCloseTo(agg.totals.usd);
  });

  test("no residual row when stages already sum to the total", () => {
    const rows = phaseRollup(fixtureAggregate(), STAGE_PHASE);
    expect(rows.find((r) => r.phase === NO_STAGE_PHASE)).toBeUndefined();
  });
});

// --- costByKey --------------------------------------------------------------

describe("costByKey", () => {
  test("sorts descending by usd and keeps the unknown-model (0-usd) bucket visible", () => {
    const rows = costByKey(fixtureAggregate().byModel);
    expect(rows.map((r) => r.key)).toEqual(["opus-4-8", "haiku-4-5", "mystery-9"]);
    expect(rows.find((r) => r.key === "mystery-9")).toBeDefined();
  });
});

// --- buildReportModel + renderers -------------------------------------------

describe("buildReportModel", () => {
  test("reports no-data when the aggregate is null", () => {
    const m = buildReportModel({
      feature: "f1",
      aggregate: null,
      sessionCount: 0,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    expect(m.hasData).toBe(false);
  });

  test("reports no-data when the aggregate has zero tokens", () => {
    const empty: UsageAggregate = { totals: totals(0), byStage: {}, byModel: {}, byAgent: {} };
    const m = buildReportModel({
      feature: "f1",
      aggregate: empty,
      sessionCount: 1,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    expect(m.hasData).toBe(false);
  });

  test("builds a full model from a non-empty aggregate", () => {
    const m = buildReportModel({
      feature: "my-feature",
      aggregate: fixtureAggregate(),
      sessionCount: 2,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    expect(m.hasData).toBe(true);
    expect(m.sessionCount).toBe(2);
    expect(m.totals.usd).toBeCloseTo(6.0);
    expect(m.phases.length).toBe(3);
  });

  test("priced subtotal EXCLUDES an unpriced model even if core folded its cost into totals.usd", () => {
    // Adversarial case: core wrongly priced the unknown model into totals.usd
    // ($9) and byModel ($3). The derived priced subtotal must still be the sum
    // of KNOWN models only ($6), so "excludes unpriced" is true by construction.
    const agg: UsageAggregate = {
      totals: totals(9.0, 1600, 600, 0, 0),
      byStage: {},
      byModel: {
        "opus-4-8": totals(4.0, 500, 200, 0, 0),
        "haiku-4-5": totals(2.0, 500, 300, 0, 0),
        "mystery-9": totals(3.0, 600, 100, 0, 0), // unknown, but core gave it a cost
      },
      byAgent: { main: totals(9.0, 1600, 600, 0, 0) },
    };
    const built = buildReportModel({
      feature: "f",
      aggregate: agg,
      sessionCount: 1,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    expect(built.hasUnpriced).toBe(true);
    expect(built.pricedSubtotalUsd).toBeCloseTo(6.0); // 4 + 2, NOT 9
    const out = renderMarkdown(built);
    expect(out).toContain("Priced subtotal: $6.00");
    // The headline must not present the $9 (unpriced-inclusive) total.
    expect(out).not.toContain("Priced subtotal: $9.00");
    expect(out).not.toContain("Estimated cost: $9.00");
  });
});

describe("renderMarkdown", () => {
  const m = buildReportModel({
    feature: "my-feature",
    aggregate: fixtureAggregate(),
    sessionCount: 2,
    stagePhase: STAGE_PHASE,
    knownModels: KNOWN,
    trackingDisabled: false,
  });

  test("leads with the estimate caveat and the feature name", () => {
    const out = renderMarkdown(m);
    expect(out).toContain("# AI tokenomics — my-feature");
    expect(out).toContain("List-price estimate");
    expect(out).toContain("$6.00");
  });

  test("marks an unknown model unpriced, never a fabricated cost", () => {
    const out = renderMarkdown(m);
    expect(out).toContain("mystery-9");
    expect(out).toContain("unpriced");
  });

  test("labels the total an incomplete subtotal when a model is unpriced", () => {
    // The fixture's mystery-9 has recorded tokens but is not in KNOWN.
    expect(m.hasUnpriced).toBe(true);
    const out = renderMarkdown(m);
    expect(out).toContain("Priced subtotal");
    expect(out).toContain("incomplete");
    expect(out).not.toContain("**Estimated cost:");
  });

  test("labels the total a plain estimate when every model is priced", () => {
    const allPriced: UsageAggregate = {
      totals: totals(5.0, 100, 50, 0, 0),
      byStage: { "code-generation": { totals: totals(5.0, 100, 50, 0, 0), byModel: {}, byAgent: {} } },
      byModel: { "opus-4-8": totals(5.0, 100, 50, 0, 0) },
      byAgent: { main: totals(5.0, 100, 50, 0, 0) },
    };
    const priced = buildReportModel({
      feature: "f",
      aggregate: allPriced,
      sessionCount: 1,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    expect(priced.hasUnpriced).toBe(false);
    const out = renderMarkdown(priced);
    expect(out).toContain("**Estimated cost:");
    expect(out).not.toContain("incomplete");
  });

  test("renders the honest empty state when there is no data", () => {
    const empty = buildReportModel({
      feature: "f1",
      aggregate: null,
      sessionCount: 0,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    expect(renderMarkdown(empty)).toContain("No usage was recorded");
  });

  test("names the kill switch when tracking is disabled", () => {
    const disabled = buildReportModel({
      feature: "f1",
      aggregate: null,
      sessionCount: 0,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: true,
    });
    expect(renderMarkdown(disabled)).toContain("AIDLC_DISABLE_USAGE_TRACKING");
  });

  test("surfaces a ledger load failure in the report body, distinct from empty", () => {
    const failed = buildReportModel({
      feature: "f1",
      aggregate: null,
      sessionCount: 0,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
      loadError: true,
    });
    const out = renderMarkdown(failed);
    expect(out).toContain("Could not load the usage ledger module");
    expect(out).toContain("load failure");
    // Must NOT read as a benign "no usage recorded".
    expect(out).not.toContain("Token/cost capture is wired only in the Claude harness");
  });
});

describe("renderTable", () => {
  test("summarises cost, sessions, and the estimate label", () => {
    const m = buildReportModel({
      feature: "my-feature",
      aggregate: fixtureAggregate(),
      sessionCount: 2,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
    });
    const out = renderTable(m);
    expect(out).toContain("priced subtotal");
    expect(out).toContain("INCOMPLETE");
    expect(out).toContain("$6.00");
    expect(out).toContain("sessions");
  });

  test("surfaces a load failure in the terminal summary", () => {
    const failed = buildReportModel({
      feature: "f1",
      aggregate: null,
      sessionCount: 0,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
      loadError: true,
    });
    expect(renderTable(failed)).toContain("could not load the usage ledger");
  });
});

describe("toJsonView", () => {
  const m = buildReportModel({
    feature: "my-feature",
    aggregate: fixtureAggregate(),
    sessionCount: 2,
    stagePhase: STAGE_PHASE,
    knownModels: KNOWN,
    trackingDisabled: false,
  });

  test("serializes an unknown model's cost as null, never a fabricated 0", () => {
    const view = toJsonView(m) as { byModel: { key: string; usd: number | null }[] };
    const mystery = view.byModel.find((r) => r.key === "mystery-9");
    expect(mystery).toBeDefined();
    expect(mystery?.usd).toBeNull();
  });

  test("keeps a known model's numeric cost", () => {
    const view = toJsonView(m) as { byModel: { key: string; usd: number | null }[] };
    const opus = view.byModel.find((r) => r.key === "opus-4-8");
    expect(opus?.usd).toBeCloseTo(4.0);
  });

  test("carries the loadError flag", () => {
    const failed = buildReportModel({
      feature: "f1",
      aggregate: null,
      sessionCount: 0,
      stagePhase: STAGE_PHASE,
      knownModels: KNOWN,
      trackingDisabled: false,
      loadError: true,
    });
    const view = toJsonView(failed) as { loadError: boolean };
    expect(view.loadError).toBe(true);
  });
});

describe("resolveStagePhaseMap", () => {
  test("reads slug→phase from stage frontmatter, incl. quoted and multi-word values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tok-stages-"));
    try {
      mkdirSync(join(dir, "construction"), { recursive: true });
      writeFileSync(
        join(dir, "construction", "a.md"),
        "---\nslug: stage-a\nphase: construction\n---\n# A\n",
      );
      writeFileSync(
        join(dir, "construction", "b.md"),
        '---\nslug: stage-b\nphase: "operation"\n---\n# B\n',
      );
      // A multi-word value must be captured whole (the \S+ bug would truncate
      // it to "operation" and misroute by dropping the rest).
      writeFileSync(
        join(dir, "construction", "c.md"),
        "---\nslug: stage-c\nphase: operation phase\n---\n# C\n",
      );
      const map = resolveStagePhaseMap([dir]);
      expect(map["stage-a"]).toBe("construction");
      expect(map["stage-b"]).toBe("operation"); // quotes stripped
      expect(map["stage-c"]).toBe("operation phase"); // whole value, not just "operation"
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
