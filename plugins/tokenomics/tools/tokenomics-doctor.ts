#!/usr/bin/env bun
// Deterministic, read-only doctor check for the tokenomics plugin. Inspects the
// composed install and emits the plugin doctor JSON contract on stdout.

import { existsSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.env.AIDLC_PROJECT_DIR ?? process.cwd();
const harnessDir = process.env.AIDLC_HARNESS_DIR ?? ".claude";
const harnessRoot = join(projectDir, harnessDir);
const fix = `Run \`bun ${harnessDir}/tools/aidlc-utility.ts plugin-sync\` (or re-run the plugin's \`hooks/compose.ts\`).`;

function installed(
  relativePath: string,
  severity: "error" | "advisory",
): { pass: boolean; label: string; fix: string; severity: "error" | "advisory" } {
  return {
    pass: existsSync(join(harnessRoot, relativePath)),
    label: `${relativePath} installed`,
    fix,
    severity,
  };
}

const checks = [
  installed("tools/tokenomics-report.ts", "error"),
  installed("stages/operation/tokenomics-report.md", "error"),
  installed("scopes/tokenomics-spend.md", "advisory"),
  installed("agents/tokenomics-reporter-agent.md", "advisory"),
];

process.stdout.write(`${JSON.stringify({ checks })}\n`);
