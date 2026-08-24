// covers: subcommand:aidlc-utility:plugin-validate, subcommand:aidlc-utility:plugin-build
// covers: file:core/tools/aidlc-plugin-author.ts, file:tools/data/plugin-targets.json

import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUN = process.execPath;
const DIST_TOOLS = join(
  REPO_ROOT,
  "dist",
  "claude",
  ".claude",
  "tools",
);
const DISPATCHER = join(DIST_TOOLS, "aidlc.ts");
const UTILITY = join(DIST_TOOLS, "aidlc-utility.ts");
const PACKAGE_TS = join(REPO_ROOT, "scripts", "package.ts");
const TEST_PRO = join(REPO_ROOT, "plugins", "test-pro");
const scratch = mkdtempSync(join(tmpdir(), "aidlc-t301-"));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function copyPlugin(parent: string): string {
  mkdirSync(parent, { recursive: true });
  const pluginRoot = join(parent, "test-pro");
  cpSync(TEST_PRO, pluginRoot, { recursive: true });
  expect(pluginRoot.startsWith(`${REPO_ROOT}${sep}`)).toBe(false);
  return pluginRoot;
}

function aidlc(args: string[], cwd: string) {
  if (!statSync(UTILITY).isFile()) {
    throw new Error(`missing delegated utility: ${UTILITY}`);
  }
  const result = spawnSync(BUN, [DISPATCHER, ...args], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      AIDLC_DISPATCH_TOOLS_DIR: DIST_TOOLS,
    },
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function packageBuild(outDir: string) {
  const result = spawnSync(
    BUN,
    [PACKAGE_TS, "plugin", "build", "test-pro", "claude", outDir],
    {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      timeout: 60_000,
    },
  );
  if (result.error) throw result.error;
  return result;
}

function filesUnder(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(root, path).split(sep).join("/"));
    }
  };
  walk(root);
  return files;
}

describe("t301 plugin author CLI outside the framework checkout", () => {
  test("validate exits clean for valid content and exits 1 for findings", () => {
    const cleanRoot = copyPlugin(join(scratch, "clean"));
    const clean = aidlc(["plugin", "validate", "--json"], cleanRoot);
    expect(clean.status, clean.stderr).toBe(0);
    expect(JSON.parse(clean.stdout)).toMatchObject({
      pluginRoot: cleanRoot,
      valid: true,
      findings: [],
    });

    const badRoot = copyPlugin(join(scratch, "bad"));
    const manifestPath = join(badRoot, ".aidlc-plugin", "plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    manifest.name = "wrong-name";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const bad = aidlc(["plugin", "validate", "--json"], badRoot);
    expect(bad.status).toBe(1);
    const report = JSON.parse(bad.stdout) as {
      valid: boolean;
      findings: Array<{ code: string }>;
    };
    expect(report.valid).toBe(false);
    expect(report.findings.some((finding) => finding.code === "manifest-name"))
      .toBe(true);
  });

  test("build is byte-identical to the repository packager projection", () => {
    const pluginRoot = copyPlugin(join(scratch, "build"));
    const cliOut = join(scratch, "cli-out");
    const packageOut = join(scratch, "package-out");

    const built = aidlc(["plugin", "build", "claude", cliOut], pluginRoot);
    expect(built.status, built.stderr).toBe(0);
    expect(built.stdout).toContain(`plugin build complete: ${cliOut}`);

    const reference = packageBuild(packageOut);
    expect(reference.status, reference.stderr).toBe(0);

    const cliFiles = filesUnder(cliOut);
    expect(cliFiles).toEqual(filesUnder(packageOut));
    for (const file of cliFiles) {
      expect(
        readFileSync(join(cliOut, file)).equals(
          readFileSync(join(packageOut, file)),
        ),
        file,
      ).toBe(true);
    }
  });
});
