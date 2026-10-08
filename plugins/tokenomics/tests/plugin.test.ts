// The tokenomics plugin's own content validation + the report tool's pure logic.
//
// Run: bun test plugins/tokenomics/tests/plugin.test.ts

import { describe, expect, test } from "bun:test";
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
      "mystery-9": totals(0), // unknown model → unpriced
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
    expect(fmtTokens(-5)).toBe("0");
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
    expect(out).toContain("estimated cost");
    expect(out).toContain("list-price estimate");
    expect(out).toContain("$6.00");
  });
});
