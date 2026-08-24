// Framework-agnostic helpers for validating, building, composing, and driving
// AIDLC plugins. This module intentionally has no bun:test dependency.

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
export {
  assertNonEmptyStageBody,
  pluginAgentRoster,
  stageBodyAfterFrontmatter,
  validatePluginContent,
  walkMarkdownFiles,
} from "../../dist/claude/.claude/tools/aidlc-plugin-author.ts";
export type {
  PluginContentFinding,
  PluginFindingCode,
  PluginValidationOptions,
} from "../../dist/claude/.claude/tools/aidlc-plugin-author.ts";
import type { DriveOptions } from "./sdk-drive.ts";
import { driveAidlc } from "./sdk-drive.ts";
import type { AcpDriveOptions } from "./kiro-acp-drive.ts";
import { driveKiroAcp } from "./kiro-acp-drive.ts";
import {
  type ExecResult,
  execCodex,
  runCopilot,
  runCursor,
  runOpencode,
} from "./exec-drive.ts";
import { REPO_ROOT } from "./fixtures.ts";
import {
  harnessByName,
  type ShippedHarnessName,
} from "./harness-matrix.ts";

const PACKAGE_TS = join(REPO_ROOT, "scripts", "package.ts");
const BUN = process.execPath;
const TIMEOUT_MS = 60_000;

export function buildPluginProjection(
  plugin: string,
  harness: ShippedHarnessName,
  outDir: string,
): string {
  const build = spawnSync(
    BUN,
    [PACKAGE_TS, "plugin", "build", plugin, harness, outDir],
    {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      timeout: TIMEOUT_MS - 5_000,
    },
  );
  if (build.status !== 0) {
    throw new Error(
      `plugin build failed for ${plugin}/${harness}: ${build.stderr}`,
    );
  }
  return outDir;
}

export function copyHarnessInstall(
  harness: ShippedHarnessName,
  projectDir: string,
): string {
  mkdirSync(projectDir, { recursive: true });
  cpSync(harnessByName(harness).distRoot, projectDir, { recursive: true });
  return projectDir;
}

export function readPluginDropLogs(projectDir: string): string {
  const healthDir = join(
    projectDir,
    "aidlc",
    "spaces",
    "default",
    "intents",
    ".aidlc-hooks-health",
  );
  if (!existsSync(healthDir)) return "";
  return readdirSync(healthDir)
    .filter(
      (file) =>
        file.startsWith("plugin-compose") && file.endsWith(".drops"),
    )
    .sort()
    .map((file) => readFileSync(join(healthDir, file), "utf-8"))
    .join("");
}

export interface ComposePluginFixtureOptions {
  plugin: string;
  harness: ShippedHarnessName;
  projectDir?: string;
  pluginBuilt?: string;
  copyInstall?: boolean;
  env?: NodeJS.ProcessEnv;
  beforeCompose?: (fixture: {
    projectDir: string;
    pluginBuilt: string;
  }) => void;
}

export interface ComposedPluginFixture {
  projectDir: string;
  pluginBuilt: string;
  dropLogs: string;
  composeStdout: string;
  composeStderr: string;
}

function cursorCompose(
  projectDir: string,
  pluginBuilt: string,
  envOverrides: NodeJS.ProcessEnv | undefined,
): { stdout: string; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.PLUGIN_ROOT;
  delete env.AIDLC_PLUGIN_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  delete env.CURSOR_PROJECT_DIR;
  delete env.AIDLC_PROJECT_DIR;
  env.AIDLC_HARNESS_DIR = ".cursor";
  // Empty PATH forces the launcher's bundled compose fallback (no installed
  // aidlc binary); pass env.PATH via overrides to exercise the installed-
  // binary branch.
  env.PATH = "";
  Object.assign(env, envOverrides);

  const compose = spawnSync(
    BUN,
    [join(pluginBuilt, "hooks", "aidlc-plugin-compose.ts"), ".cursor"],
    {
      cwd: pluginBuilt,
      input: JSON.stringify({
        hook_event_name: "sessionStart",
        workspace_roots: [projectDir],
      }),
      encoding: "utf-8",
      timeout: TIMEOUT_MS - 5_000,
      env,
    },
  );
  if (compose.status !== 0) {
    throw new Error(`cursor compose failed: ${compose.stderr}`);
  }
  return { stdout: compose.stdout ?? "", stderr: compose.stderr ?? "" };
}

function directCompose(
  harness: ShippedHarnessName,
  projectDir: string,
  pluginBuilt: string,
  envOverrides: NodeJS.ProcessEnv | undefined,
): { stdout: string; stderr: string } {
  const harnessDir = harnessByName(harness).manifest.harnessDir;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AIDLC_HARNESS_DIR: harnessDir,
    AIDLC_HARNESS_NAME: harness,
  };
  if (harness === "claude" || harness === "codex" || harness === "kiro" || harness === "kiro-ide") {
    env.CLAUDE_PLUGIN_ROOT = pluginBuilt;
    env.CLAUDE_PROJECT_DIR = projectDir;
  } else {
    env.PLUGIN_ROOT = pluginBuilt;
    env.AIDLC_PROJECT_DIR = projectDir;
  }
  Object.assign(env, envOverrides);

  const compose = spawnSync(BUN, [join(pluginBuilt, "hooks", "compose.ts")], {
    cwd: projectDir,
    encoding: "utf-8",
    timeout: TIMEOUT_MS - 5_000,
    env,
  });
  if (compose.status !== 0) {
    throw new Error(`${harness} compose failed: ${compose.stderr}`);
  }
  return { stdout: compose.stdout ?? "", stderr: compose.stderr ?? "" };
}

export function composePluginFixture(
  options: ComposePluginFixtureOptions,
): ComposedPluginFixture {
  const scratchRoot = options.projectDir
    ? dirname(resolve(options.projectDir))
    : mkdtempSync(join(tmpdir(), `aidlc-plugin-${options.plugin}-`));
  const projectDir =
    options.projectDir ?? join(scratchRoot, `${options.harness}-project`);
  const pluginBuilt =
    options.pluginBuilt ??
    join(scratchRoot, `plugin-${options.plugin}-${options.harness}`);

  if (options.copyInstall !== false && options.harness === "cursor") {
    mkdirSync(projectDir, { recursive: true });
    const install = spawnSync(
      BUN,
      [join(harnessByName("cursor").distRoot, "install.ts"), projectDir],
      {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        timeout: TIMEOUT_MS - 5_000,
      },
    );
    if (install.status !== 0) {
      throw new Error(`cursor install failed: ${install.stderr}`);
    }
  } else if (options.copyInstall !== false) {
    copyHarnessInstall(options.harness, projectDir);
  }

  if (!options.pluginBuilt) {
    buildPluginProjection(
      options.plugin,
      options.harness,
      pluginBuilt,
    );
  }
  options.beforeCompose?.({ projectDir, pluginBuilt });

  const compose =
    options.harness === "cursor"
      ? cursorCompose(projectDir, pluginBuilt, options.env)
      : directCompose(
          options.harness,
          projectDir,
          pluginBuilt,
          options.env,
        );
  return {
    projectDir,
    pluginBuilt,
    dropLogs: readPluginDropLogs(projectDir),
    composeStdout: compose.stdout,
    composeStderr: compose.stderr,
  };
}

export type InvokableHarness =
  | "claude"
  | "kiro"
  | "codex"
  | "copilot"
  | "opencode"
  | "cursor";

const LIVE_GATES: Record<InvokableHarness, string> = {
  claude: "AIDLC_CLAUDE_SDK_LIVE",
  kiro: "AIDLC_KIRO_ACP_LIVE",
  codex: "AIDLC_CODEX_EXEC_LIVE",
  copilot: "AIDLC_COPILOT_EXEC_LIVE",
  opencode: "AIDLC_OPENCODE_RUN_LIVE",
  cursor: "AIDLC_CURSOR_RUN_LIVE",
};

/**
 * Return the opt-in environment variable for a live harness invocation.
 * An unset value means skip, not pass.
 */
export function liveGateFor(harness: InvokableHarness): string {
  return LIVE_GATES[harness];
}

export interface InvokeHarnessOptions {
  codexHome?: string;
  claude?: Omit<DriveOptions, "projectDir">;
  kiro?: Omit<AcpDriveOptions, "projectDir" | "prompt">;
  opencodeArgs?: string[];
}

export type HarnessInvocationResult =
  | {
      status: "skipped";
      harness: InvokableHarness;
      liveGate: string;
      reason: string;
    }
  | {
      status: "completed";
      harness: InvokableHarness;
      liveGate: string;
      result: unknown;
    };

export async function invokeHarness(
  workingDir: string,
  harness: InvokableHarness,
  prompt: string,
  options: InvokeHarnessOptions = {},
): Promise<HarnessInvocationResult> {
  const liveGate = liveGateFor(harness);
  if (process.env[liveGate] !== "1") {
    return {
      status: "skipped",
      harness,
      liveGate,
      reason: `${liveGate} is not set to 1`,
    };
  }

  let result:
    | Awaited<ReturnType<typeof driveAidlc>>
    | Awaited<ReturnType<typeof driveKiroAcp>>
    | ExecResult;
  switch (harness) {
    case "claude":
      result = await driveAidlc(prompt, {
        ...options.claude,
        projectDir: workingDir,
      });
      break;
    case "kiro":
      result = await driveKiroAcp({
        ...options.kiro,
        projectDir: workingDir,
        prompt,
      });
      break;
    case "codex": {
      const home = options.codexHome ?? process.env.CODEX_HOME;
      if (!home) {
        throw new Error(
          "codex invocation requires opts.codexHome or CODEX_HOME",
        );
      }
      result = execCodex(workingDir, home, prompt);
      break;
    }
    case "copilot":
      result = runCopilot(workingDir, prompt);
      break;
    case "opencode":
      result = runOpencode(
        workingDir,
        options.opencodeArgs ?? [prompt],
      );
      break;
    case "cursor":
      result = runCursor(workingDir, prompt);
      break;
  }
  return { status: "completed", harness, liveGate, result };
}
