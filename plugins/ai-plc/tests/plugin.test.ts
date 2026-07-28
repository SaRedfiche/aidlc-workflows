// plugins/ai-plc/tests/plugin.test.ts — the ai-plc plugin's OWN test harness.
//
// Distinct from the framework's t188 (which proves the compose MECHANISM works):
// this validates the PLUGIN'S OWN CONTENT with the same rigor the framework
// applies to core — every stage's frontmatter passes the real
// validateStageFrontmatter, agents resolve against the real roster, produced
// artifacts are correctly `ai-plc-` namespaced, every contribution targets a
// real core stage, and the plugin's internal edges (requires_stage, consumes)
// resolve within the plugin. Shape copied from plugins/test-pro/tests/.
//
// Run:  bun test plugins/ai-plc/tests/plugin.test.ts

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseStageFrontmatter,
  scalarField,
} from "../../../dist/claude/.claude/tools/aidlc-lib.ts";
import {
  type ValidationContext,
  validateStageFrontmatter,
} from "../../../dist/claude/.claude/tools/aidlc-stage-schema.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(HERE, "..");
const REPO_ROOT = join(PLUGIN_ROOT, "..", "..");
const CORE_STAGES = join(REPO_ROOT, "dist", "claude", ".claude", "aidlc-common", "stages");
const AGENTS_DIR = join(REPO_ROOT, "dist", "claude", ".claude", "agents");

const PLUGIN_NAME = "ai-plc";

// --- helpers ---

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

// The real core agent roster (dist), plus this plugin's own agents/ bucket and
// the reserved orchestrator pseudo-agent.
function agentRoster(): string[] {
  const coreSlugs = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  const pluginSlugs = walk(join(PLUGIN_ROOT, "agents"))
    .map((f) => basename(f, ".md"));
  return [...new Set([...coreSlugs, ...pluginSlugs, "orchestrator"])].sort();
}

// Core stage slugs (contribution targets must resolve to one of these).
function coreStageSlugs(): Set<string> {
  return new Set(walk(CORE_STAGES).map((p) => basename(p, ".md")));
}

const pluginStageFiles = walk(join(PLUGIN_ROOT, "stages"));
const contributionFiles = walk(join(PLUGIN_ROOT, "contributions"));
const pluginScopeFiles = walk(join(PLUGIN_ROOT, "scopes"));
const pluginAgentFiles = walk(join(PLUGIN_ROOT, "agents"));

function stageBodyAfterFrontmatter(raw: string): string {
  return raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)?.[1] ?? "";
}

describe(`${PLUGIN_NAME} plugin — own content validation`, () => {
  test("has stages and contributions to validate", () => {
    expect(pluginStageFiles.length).toBeGreaterThan(0);
    expect(contributionFiles.length).toBeGreaterThan(0);
  });

  // --- Every plugin stage passes the framework's stage schema ---
  describe("stage frontmatter (same validator as core)", () => {
    const ctx: ValidationContext = { agents: agentRoster() };
    for (const file of pluginStageFiles) {
      const name = basename(file);
      test(`${name} validates`, () => {
        const fm = parseStageFrontmatter(readFileSync(file, "utf-8"));
        const r = validateStageFrontmatter(fm, ctx);
        if (!r.valid) throw new Error(`${name}: ${r.errors.join("; ")}`);
        expect(r.valid).toBe(true);
      });

      test(`${name} slug matches filename stem`, () => {
        const fm = parseStageFrontmatter(readFileSync(file, "utf-8"));
        expect(fm.slug).toBe(name.replace(/\.md$/, ""));
      });

      test(`${name} declares plugin: ${PLUGIN_NAME}`, () => {
        const fm = parseStageFrontmatter(readFileSync(file, "utf-8"));
        expect(fm.plugin).toBe(PLUGIN_NAME);
      });

      test(`${name} has a non-empty body`, () => {
        const body = stageBodyAfterFrontmatter(readFileSync(file, "utf-8"));
        if (body.trim().length === 0) {
          throw new Error(
            `${name}: stage body is empty - the stage is behaviorally dead; did a transform drop everything after the closing ---?`
          );
        }
        expect(body.trim().length).toBeGreaterThan(0);
      });

      test(`${name} produces only ${PLUGIN_NAME}- namespaced artifacts`, () => {
        const fm = parseStageFrontmatter(readFileSync(file, "utf-8"));
        for (const artifact of (fm.produces as string[]) ?? []) {
          expect(artifact.startsWith(`${PLUGIN_NAME}-`)).toBe(true);
        }
      });

      test(`${name} is inline with no reviewer (dispatch-surface safe on every harness)`, () => {
        const fm = parseStageFrontmatter(readFileSync(file, "utf-8"));
        expect(fm.mode).toBe("inline");
        expect(fm.reviewer).toBeUndefined();
      });
    }
  });

  // --- The plugin's internal graph resolves: edges + consumed artifacts ---
  describe("internal graph closure", () => {
    const stageFms = pluginStageFiles.map((f) =>
      parseStageFrontmatter(readFileSync(f, "utf-8"))
    );
    const pluginSlugs = new Set(stageFms.map((fm) => fm.slug as string));
    const producedArtifacts = new Set(
      stageFms.flatMap((fm) => (fm.produces as string[]) ?? [])
    );

    for (const fm of stageFms) {
      const slug = fm.slug as string;
      test(`${slug} requires_stage edges resolve within the plugin`, () => {
        for (const dep of (fm.requires_stage as string[]) ?? []) {
          if (!pluginSlugs.has(dep)) {
            throw new Error(
              `${slug} requires "${dep}" which is not a ${PLUGIN_NAME} stage - cross-plugin/core hard edges must not be authored on plugin discovery stages`
            );
          }
          expect(pluginSlugs.has(dep)).toBe(true);
        }
      });

      test(`${slug} consumed ${PLUGIN_NAME}- artifacts have a producer in the plugin`, () => {
        const consumes = (fm.consumes as Array<{ artifact: string }>) ?? [];
        for (const c of consumes) {
          if (c.artifact.startsWith(`${PLUGIN_NAME}-`)) {
            expect(producedArtifacts.has(c.artifact)).toBe(true);
          }
        }
      });
    }

    test("the handoff artifact ai-plc-discovery-document is produced", () => {
      expect(producedArtifacts.has("ai-plc-discovery-document")).toBe(true);
    });
  });

  // --- Numbering: authored numbers are display hints, but their ORDER must
  // agree with the internal requires_stage edges, since compile linearizes
  // by number and enforces dependency-lower-numbered.
  describe("authored number order agrees with internal edges", () => {
    const stageFms = pluginStageFiles.map((f) =>
      parseStageFrontmatter(readFileSync(f, "utf-8"))
    );
    const numberBySlug = new Map(
      stageFms.map((fm) => [fm.slug as string, String(fm.number)])
    );
    const order = (n: string): number => parseFloat(n.split(".")[1]);

    for (const fm of stageFms) {
      const slug = fm.slug as string;
      for (const dep of (fm.requires_stage as string[]) ?? []) {
        test(`${dep} (${numberBySlug.get(dep)}) numbers below ${slug} (${numberBySlug.get(slug)})`, () => {
          const depN = numberBySlug.get(dep);
          const myN = numberBySlug.get(slug);
          expect(depN).toBeTruthy();
          expect(myN).toBeTruthy();
          expect(order(depN as string)).toBeLessThan(order(myN as string));
        });
      }
    }
  });

  // --- Every contribution targets a real core stage + namespaces its additions ---
  describe("contributions (target resolution + namespacing)", () => {
    const cores = coreStageSlugs();
    for (const file of contributionFiles) {
      const name = basename(file);
      const content = readFileSync(file, "utf-8");
      const fm = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

      test(`${name} targets a real core stage`, () => {
        const target = fm.match(/^target:\s*(.+)$/m)?.[1].trim();
        expect(target).toBeTruthy();
        expect(cores.has(target ?? "")).toBe(true);
      });

      test(`${name} declares plugin: ${PLUGIN_NAME}`, () => {
        expect(fm.match(/^plugin:\s*(.+)$/m)?.[1].trim()).toBe(PLUGIN_NAME);
      });

      test(`${name} adds.consumes artifacts are ${PLUGIN_NAME}- namespaced and optional`, () => {
        const addsBlock = fm.match(/^adds:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m)?.[1] ?? "";
        const consumesSection = addsBlock.match(/consumes:\n((?:\s+-? .*\n?)*)/);
        if (!consumesSection) return;
        for (const chunk of consumesSection[1].split(/^(?=\s*- artifact:)/m)) {
          const artifact = chunk.match(/-\s*artifact:\s*([\w-]+)/)?.[1];
          if (!artifact) continue;
          expect(artifact.startsWith(`${PLUGIN_NAME}-`)).toBe(true);
          // Cross-boundary consumes must stay optional so core stages never
          // starve when the plugin (or its scope) is not in the run.
          expect(chunk.match(/^\s*required:\s*(true|false)\b/m)?.[1]).toBe("false");
        }
      });

      test(`${name} adds.scopes names only this plugin's scopes`, () => {
        const addsBlock = fm.match(/^adds:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m)?.[1] ?? "";
        const scopesSection = addsBlock.match(/scopes:\n((?:\s+- [\w-]+\n?)*)/);
        const items = scopesSection
          ? [...scopesSection[1].matchAll(/^\s+- ([\w-]+)/gm)].map((m) => m[1])
          : [];
        for (const scope of items) {
          expect(scope.startsWith(`${PLUGIN_NAME}-`)).toBe(true);
        }
      });
    }
  });

  // --- Plugin-shipped scopes and agents keep filename identity stable ---
  describe("scope and agent naming", () => {
    test("ships scopes and an agent", () => {
      expect(pluginScopeFiles.length).toBeGreaterThan(0);
      expect(pluginAgentFiles.length).toBeGreaterThan(0);
    });

    for (const file of pluginScopeFiles) {
      const name = basename(file);
      test(`${name} scope name matches filename stem`, () => {
        const raw = readFileSync(file, "utf-8");
        const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
        expect(scalarField(fm, "name")).toBe(basename(file, ".md"));
      });
    }

    for (const file of pluginAgentFiles) {
      const name = basename(file);
      test(`${name} agent name matches filename stem`, () => {
        const raw = readFileSync(file, "utf-8");
        const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
        expect(scalarField(fm, "name")).toBe(basename(file, ".md"));
      });
    }
  });

  // --- Every stage's scopes: list resolves to a plugin-shipped scope or
  // stays off core scopes entirely (discovery does not run inside core flows).
  describe("stage scope membership", () => {
    const shippedScopes = new Set(
      pluginScopeFiles.map((f) => basename(f, ".md"))
    );
    for (const file of pluginStageFiles) {
      const name = basename(file);
      test(`${name} scopes are plugin-shipped`, () => {
        const fm = parseStageFrontmatter(readFileSync(file, "utf-8"));
        const scopes = (fm.scopes as string[]) ?? [];
        expect(scopes.length).toBeGreaterThan(0);
        for (const s of scopes) {
          expect(shippedScopes.has(s)).toBe(true);
        }
      });
    }
  });

  // --- The manifest is well-formed ---
  describe("manifest", () => {
    const manifestPath = join(PLUGIN_ROOT, ".aidlc-plugin", "plugin.json");
    test("plugin.json exists + parses", () => {
      expect(existsSync(manifestPath)).toBe(true);
      const m = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(m.name).toBe(PLUGIN_NAME);
      expect(m.version).toBeTruthy();
      expect(m.aidlc?.contributes).toBeTruthy();
    });
  });
});
