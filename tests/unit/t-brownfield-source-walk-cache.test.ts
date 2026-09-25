// covers: function:withWorkspaceSourceStateCache, function:workspaceSourceState, function:workspaceSourceFingerprint, function:workspaceSourceListing
//
// The workspace source-freshness walk fires at every plan-approval /
// code-generation checkpoint. Within one review command the freshness and
// currency accounting each recomputed the whole-tree walk, per unit — so a
// brownfield command re-walked the tree 3+ times. withWorkspaceSourceStateCache
// computes it ONCE per command.
//
// This suite pins Option B's contract:
//   1. inside a cache scope, repeated calls for the same (projectDir,intent,
//      space) return the IDENTICAL object — one walk, the rest are cache hits
//      (the walk reduction), with byte-identical fingerprint+listing,
//   2. the cache is per-command: outside a scope every call recomputes (no
//      cross-command staleness), and a scope is dropped when it returns
//      (re-entrant / restores a prior scope),
//   3. the cached identity is the SAME sha256 raw-byte OID space as before —
//      no fingerprint change, no migration — including the invariant that an
//      ignored generated tree stays out while a registered source under it
//      remains bound (the identity is unchanged by the cache),
//   4. an unbindable (null) walk is never memoized, so a workspace that becomes
//      bindable inside the same scope is seen as bound.

import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  _resetWorkspaceSourceStateCacheForTests,
  withWorkspaceSourceStateCache,
  workspaceSourceFingerprint,
  workspaceSourceListing,
  workspaceSourceState,
} from "../../core/tools/aidlc-lib.ts";
import { cleanupTestProject, createTestProject, REPO_ROOT } from "../harness/fixtures.ts";

const created: string[] = [];
afterEach(() => {
  _resetWorkspaceSourceStateCacheForTests();
  while (created.length) cleanupTestProject(created.pop());
});

function git(dir: string, args: string[]): void {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout || `exit ${r.status}`}`);
  }
}

// A committed git work tree with a handful of source files (enough that a walk
// is real work, so a cache hit is a meaningful reduction).
function project(): string {
  const dir = createTestProject();
  created.push(dir);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "t@test"]);
  git(dir, ["config", "user.name", "t"]);
  mkdirSync(join(dir, "src"), { recursive: true });
  for (let i = 0; i < 8; i++) {
    writeFileSync(join(dir, "src", `mod${i}.ts`), `export const m${i} = ${i};\n`);
  }
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "seed"]);
  return dir;
}

describe("t-brownfield-source-walk-cache: compute the source walk once per command", () => {
  test("1. inside a scope repeated calls return the IDENTICAL object (the walk reduction)", () => {
    const dir = project();
    const [a, b, c] = withWorkspaceSourceStateCache(() => [
      workspaceSourceState(dir),
      workspaceSourceState(dir),
      workspaceSourceState(dir),
    ]);
    expect(a).not.toBeNull();
    // Same object reference on every hit — proves the walk ran once, the rest
    // were served from the memo (no second/third whole-tree pass).
    expect(b).toBe(a);
    expect(c).toBe(a);
    // The derived accessors read through the same memo, still identical content.
    withWorkspaceSourceStateCache(() => {
      const fp1 = workspaceSourceFingerprint(dir);
      const fp2 = workspaceSourceFingerprint(dir);
      expect(fp1).not.toBeNull();
      expect(fp2).toBe(fp1);
      const l1 = workspaceSourceListing(dir);
      const l2 = workspaceSourceListing(dir);
      expect(l1).toBe(l2); // same memoized listing object
    });
  });

  test("2. the cache is per-command: no cross-command staleness, scope dropped on exit", () => {
    const dir = project();
    // Outside any scope, two calls are independent computations (may be equal by
    // content but are not required to be the same object) — importantly, a
    // change between them IS observed (no stale cache bridging commands).
    const before = workspaceSourceFingerprint(dir);
    withWorkspaceSourceStateCache(() => {
      // A first cached read.
      expect(workspaceSourceFingerprint(dir)).toBe(before);
    });
    // A new command (new scope) sees a content change — the prior scope's memo
    // was dropped, so this is not a stale hit.
    writeFileSync(join(dir, "src", "mod0.ts"), "export const m0 = 999;\n");
    git(dir, ["add", "-A"]);
    const after = withWorkspaceSourceStateCache(() => workspaceSourceFingerprint(dir));
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    // Re-entrancy: a nested scope restores the outer scope's memo on exit.
    withWorkspaceSourceStateCache(() => {
      const outer = workspaceSourceState(dir);
      withWorkspaceSourceStateCache(() => {
        // inner scope is a fresh memo
        expect(workspaceSourceState(dir)).not.toBeNull();
      });
      // outer memo intact and still returns its identical object
      expect(workspaceSourceState(dir)).toBe(outer);
    });
  });

  test("3. the cache does not change identity: same OID space, ignored-out / registered-in invariant holds", () => {
    const dir = project();
    // dist/ is a generated-output boundary; ignored + excluded from identity.
    writeFileSync(join(dir, ".gitignore"), "dist/\n");
    // Register a real source under the generated dir via the escape hatch.
    writeFileSync(
      join(dir, ".aidlc-source-paths.json"),
      `${JSON.stringify({ version: 1, paths: ["dist/keep.ts"] })}\n`,
    );
    git(dir, ["add", ".gitignore", ".aidlc-source-paths.json"]);
    git(dir, ["commit", "-qm", "ignore dist, register dist/keep.ts"]);
    mkdirSync(join(dir, "dist"), { recursive: true });
    writeFileSync(join(dir, "dist", "bundle.js"), "generated(1);\n");
    writeFileSync(join(dir, "dist", "keep.ts"), "export const keep = 1;\n");

    // Cached and uncached fingerprints agree (the cache is transparent).
    const uncached = workspaceSourceFingerprint(dir);
    const cached = withWorkspaceSourceStateCache(() => workspaceSourceFingerprint(dir));
    expect(cached).toBe(uncached);

    const listing = workspaceSourceListing(dir);
    expect(listing).not.toBeNull();
    // Ignored generated output stays OUT.
    expect(listing?.has("\0dist/bundle.js")).toBe(false);
    // Registered source under the generated dir stays IN, and is raw sha256 of
    // bytes (64-hex) — the unchanged OID space, not a git blob OID.
    const kept = listing?.get("\0dist/keep.ts");
    expect(kept).toBeDefined();
    expect(/^\d{6} [0-9a-f]{64}$/.test(kept ?? "")).toBe(true);

    // Generated output changing does NOT move the fingerprint; the registered
    // source changing DOES — identical to the pre-cache floor.
    const baseline = withWorkspaceSourceStateCache(() => workspaceSourceFingerprint(dir));
    writeFileSync(join(dir, "dist", "bundle.js"), "generated(2);\n");
    expect(withWorkspaceSourceStateCache(() => workspaceSourceFingerprint(dir))).toBe(baseline);
    writeFileSync(join(dir, "dist", "keep.ts"), "export const keep = 2;\n");
    expect(withWorkspaceSourceStateCache(() => workspaceSourceFingerprint(dir))).not.toBe(baseline);
  });

  test("4. an unbindable walk is never memoized, so a later-bindable state is seen", () => {
    const dir = createTestProject();
    created.push(dir);
    // A malformed source registry makes the walk unbindable (null).
    writeFileSync(join(dir, ".aidlc-source-paths.json"), "{not json");
    withWorkspaceSourceStateCache(() => {
      expect(workspaceSourceState(dir)).toBeNull();
      // Fix it within the same scope; because null was never cached, the next
      // call recomputes and now binds.
      writeFileSync(
        join(dir, ".aidlc-source-paths.json"),
        `${JSON.stringify({ version: 1, paths: [] })}\n`,
      );
      mkdirSync(join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "main.ts"), "export const main = 1;\n");
      expect(workspaceSourceState(dir)).not.toBeNull();
    });
  });

  // The cache only delivers the "once per command" win where a command entry
  // point OPENS a scope. The per-checkpoint accounting that fires the walk is
  // driven by three dispatchers: aidlc-log review, aidlc-orchestrate
  // next/continue/report/park (code-generation), and aidlc-state
  // approve/reject/revise (plan-approval). A commit that claims the win for
  // plan-approval and code-generation but wraps only one dispatcher would
  // silently leave the felt-slow paths uncached — the docs-honesty/tests gap
  // this suite closes. Assert every entry point opens the scope so removing a
  // wrap fails here rather than shipping a hollow perf claim.
  test("5. every command dispatcher that drives the walk opens the cache scope (wiring)", () => {
    const wrap = "withWorkspaceSourceStateCache(() =>";
    for (const rel of [
      "core/tools/aidlc-log.ts", // review
      "core/tools/aidlc-orchestrate.ts", // code-generation: next/continue/report/park
      "core/tools/aidlc-state.ts", // plan-approval: approve/reject/revise
    ]) {
      const src = readFileSync(join(REPO_ROOT, rel), "utf-8");
      expect(src.includes(wrap), `${rel} must open a workspaceSourceState cache scope`).toBe(true);
    }
  });
});
