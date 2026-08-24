import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  frontmatterBlock,
  parseStageFrontmatter,
  scalarField,
} from "./aidlc-lib.ts";
import {
  type ValidationContext,
  validateStageFrontmatter,
} from "./aidlc-stage-schema.ts";
import { resolveHarnessPath } from "./aidlc-runtime-paths.ts";

export interface PluginValidationOptions {
  coreStagesDir?: string;
  coreAgentsDir?: string;
}

export type PluginFindingCode =
  | "manifest-missing"
  | "manifest-json"
  | "manifest-shape"
  | "manifest-name"
  | "stage-schema"
  | "stage-slug"
  | "plugin-owner"
  | "artifact-namespace"
  | "contribution-target"
  | "file-name"
  | "stage-body";

export interface PluginContentFinding {
  code: PluginFindingCode;
  file: string;
  message: string;
}

export interface PluginTarget {
  harnessName: string;
  harnessDir: string;
  manifestDir: string;
  kind: "store" | "kiro" | "kiro-ide" | "cursor";
}

export interface BuildPluginProjectionOptions {
  pluginRoot: string;
  target: PluginTarget;
  outDir: string;
  templateDir?: string;
  reviewerCoreStagesDir?: string;
  reviewerPluginStagesDir?: string;
}

export function walkMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdownFiles(path));
    else if (entry.name.endsWith(".md")) out.push(path);
  }
  return out;
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

export function stageBodyAfterFrontmatter(raw: string): string {
  return raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)?.[1] ?? "";
}

export function assertNonEmptyStageBody(file: string): void {
  const body = stageBodyAfterFrontmatter(readFileSync(file, "utf-8"));
  if (body.trim().length === 0) {
    throw new Error(
      `${file}: stage body is empty - the stage is behaviorally dead; did a transform drop everything after the closing ---?`,
    );
  }
}

function addFinding(
  findings: PluginContentFinding[],
  code: PluginFindingCode,
  file: string,
  message: string,
): void {
  findings.push({ code, file, message });
}

export function pluginAgentRoster(
  pluginRoot: string,
  options: PluginValidationOptions = {},
): string[] {
  const coreAgentsDir =
    options.coreAgentsDir ?? resolveHarnessPath(["agents"]);
  const coreSlugs = walkMarkdownFiles(coreAgentsDir).map((file) =>
    basename(file, ".md"),
  );
  const pluginSlugs = walkMarkdownFiles(join(pluginRoot, "agents")).map(
    (file) => basename(file, ".md"),
  );
  return [...new Set([...coreSlugs, ...pluginSlugs, "orchestrator"])].sort();
}

function nestedListField(
  frontmatter: string,
  parent: string,
  key: string,
): string[] {
  const lines = frontmatter.split(/\r?\n/);
  const parentIndex = lines.indexOf(`${parent}:`);
  if (parentIndex < 0) return [];
  for (let index = parentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line)) break;
    if (line === `  ${key}:`) {
      const values: string[] = [];
      for (let item = index + 1; item < lines.length; item += 1) {
        const itemLine = lines[item];
        const match = itemLine.match(/^\s{4}-\s+(.+?)\s*$/);
        if (match) {
          values.push(match[1].replace(/^["']|["']$/g, ""));
          continue;
        }
        if (itemLine.trim() !== "") break;
      }
      return values;
    }
  }
  return [];
}

function validateManifest(
  pluginRoot: string,
  pluginName: string,
  findings: PluginContentFinding[],
): void {
  const manifestFile = join(pluginRoot, ".aidlc-plugin", "plugin.json");
  if (!existsSync(manifestFile)) {
    addFinding(
      findings,
      "manifest-missing",
      manifestFile,
      "plugin manifest is missing",
    );
    return;
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestFile, "utf-8"));
  } catch (error) {
    addFinding(
      findings,
      "manifest-json",
      manifestFile,
      `plugin manifest is not valid JSON: ${String(error)}`,
    );
    return;
  }
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    addFinding(
      findings,
      "manifest-shape",
      manifestFile,
      "plugin manifest must be an object",
    );
    return;
  }
  const value = manifest as Record<string, unknown>;
  if (value.name !== pluginName) {
    addFinding(
      findings,
      "manifest-name",
      manifestFile,
      `manifest name must equal plugin directory name "${pluginName}"`,
    );
  }
  if (typeof value.version !== "string" || value.version.trim() === "") {
    addFinding(
      findings,
      "manifest-shape",
      manifestFile,
      "manifest version must be a non-empty string",
    );
  }
  const aidlc = value.aidlc;
  if (
    typeof aidlc !== "object" ||
    aidlc === null ||
    Array.isArray(aidlc) ||
    typeof (aidlc as Record<string, unknown>).contributes !== "object" ||
    (aidlc as Record<string, unknown>).contributes === null ||
    Array.isArray((aidlc as Record<string, unknown>).contributes)
  ) {
    addFinding(
      findings,
      "manifest-shape",
      manifestFile,
      "manifest aidlc.contributes must be an object",
    );
  }
}

function validateOwnedFileNames(
  files: string[],
  pluginName: string,
  findings: PluginContentFinding[],
): void {
  for (const file of files) {
    const frontmatter = frontmatterBlock(readFileSync(file, "utf-8")) ?? "";
    const owner = scalarField(frontmatter, "plugin");
    if (owner !== pluginName) {
      addFinding(
        findings,
        "plugin-owner",
        file,
        `plugin field must equal "${pluginName}"`,
      );
    }
    const name = scalarField(frontmatter, "name");
    const stem = basename(file, ".md");
    if (name !== stem) {
      addFinding(
        findings,
        "file-name",
        file,
        `name field must equal filename stem "${stem}"`,
      );
    }
  }
}

export function validatePluginContent(
  pluginRoot: string,
  options: PluginValidationOptions = {},
): PluginContentFinding[] {
  const root = resolve(pluginRoot);
  const pluginName = basename(root);
  const findings: PluginContentFinding[] = [];
  validateManifest(root, pluginName, findings);

  const coreStagesDir =
    options.coreStagesDir ??
    resolveHarnessPath(["aidlc-common", "stages"]);
  const coreStages = new Set(
    walkMarkdownFiles(coreStagesDir).map((file) => basename(file, ".md")),
  );
  const context: ValidationContext = {
    agents: pluginAgentRoster(root, options),
  };

  for (const file of walkMarkdownFiles(join(root, "stages"))) {
    const raw = readFileSync(file, "utf-8");
    let parsed: Record<string, unknown>;
    try {
      parsed = parseStageFrontmatter(raw);
    } catch (error) {
      addFinding(
        findings,
        "stage-schema",
        file,
        `stage frontmatter could not be parsed: ${String(error)}`,
      );
      continue;
    }
    const result = validateStageFrontmatter(parsed, context);
    if (!result.valid) {
      for (const error of result.errors) {
        addFinding(findings, "stage-schema", file, error);
      }
    }
    const stem = basename(file, ".md");
    if (parsed.slug !== stem) {
      addFinding(
        findings,
        "stage-slug",
        file,
        `slug must equal filename stem "${stem}"`,
      );
    }
    if (parsed.plugin !== pluginName) {
      addFinding(
        findings,
        "plugin-owner",
        file,
        `plugin field must equal "${pluginName}"`,
      );
    }
    for (const artifact of Array.isArray(parsed.produces)
      ? parsed.produces
      : []) {
      if (
        typeof artifact === "string" &&
        !artifact.startsWith(`${pluginName}-`)
      ) {
        addFinding(
          findings,
          "artifact-namespace",
          file,
          `produced artifact "${artifact}" must start with "${pluginName}-"`,
        );
      }
    }
    try {
      assertNonEmptyStageBody(file);
    } catch (error) {
      addFinding(findings, "stage-body", file, String(error));
    }
  }

  for (const file of walkMarkdownFiles(join(root, "contributions"))) {
    const raw = readFileSync(file, "utf-8");
    const frontmatter = frontmatterBlock(raw) ?? "";
    const target = scalarField(frontmatter, "target");
    if (!target || !coreStages.has(target)) {
      addFinding(
        findings,
        "contribution-target",
        file,
        `target "${target}" does not resolve to a core stage slug`,
      );
    }
    if (scalarField(frontmatter, "plugin") !== pluginName) {
      addFinding(
        findings,
        "plugin-owner",
        file,
        `plugin field must equal "${pluginName}"`,
      );
    }
    for (const artifact of nestedListField(
      frontmatter,
      "adds",
      "produces",
    )) {
      if (!artifact.startsWith(`${pluginName}-`)) {
        addFinding(
          findings,
          "artifact-namespace",
          file,
          `produced artifact "${artifact}" must start with "${pluginName}-"`,
        );
      }
    }
  }

  validateOwnedFileNames(
    walkMarkdownFiles(join(root, "scopes")),
    pluginName,
    findings,
  );
  validateOwnedFileNames(
    walkMarkdownFiles(join(root, "agents")),
    pluginName,
    findings,
  );
  return findings;
}

function stageRoot(rootOrStagesDir: string): string {
  return basename(rootOrStagesDir) === "stages"
    ? rootOrStagesDir
    : join(rootOrStagesDir, "aidlc-common", "stages");
}

function pluginStagesRoot(rootOrStagesDir: string): string {
  return basename(rootOrStagesDir) === "stages"
    ? rootOrStagesDir
    : join(rootOrStagesDir, "stages");
}

const reviewerSetCache = new Map<string, Set<string>>();

export function reviewerAgentSet(
  coreRootOrStagesDir: string,
  pluginRootOrStagesDir?: string,
): Set<string> {
  const coreStagesDir = stageRoot(coreRootOrStagesDir);
  const pluginStagesDir = pluginRootOrStagesDir
    ? pluginStagesRoot(pluginRootOrStagesDir)
    : null;
  const cacheKey = `${coreStagesDir}\0${pluginStagesDir ?? "<checkout-plugins>"}`;
  const cached = reviewerSetCache.get(cacheKey);
  if (cached) return cached;

  const set = new Set<string>();
  const collect = (dir: string): void => {
    for (const file of walkMarkdownFiles(dir)) {
      const match = readFileSync(file, "utf-8").match(
        /^reviewer:\s*(\S+)\s*$/m,
      );
      if (match) set.add(match[1]);
    }
  };
  collect(coreStagesDir);

  if (pluginStagesDir) {
    collect(pluginStagesDir);
  } else if (basename(coreRootOrStagesDir) !== "stages") {
    const pluginsRoot = join(dirname(coreRootOrStagesDir), "plugins");
    if (existsSync(pluginsRoot)) {
      for (const plugin of readdirSync(pluginsRoot).sort()) {
        collect(join(pluginsRoot, plugin, "stages"));
      }
    }
  }

  reviewerSetCache.set(cacheKey, set);
  return set;
}

export function absorbReviewerKnowledge(
  content: string,
  agentName: string,
  coreRootOrStagesDir: string,
  sourceRoot: string = coreRootOrStagesDir,
  pluginRootOrStagesDir?: string,
): string {
  if (
    !reviewerAgentSet(
      coreRootOrStagesDir,
      pluginRootOrStagesDir,
    ).has(agentName)
  ) {
    return content;
  }
  const knowledgeDir = join(sourceRoot, "knowledge", agentName);
  if (!existsSync(knowledgeDir)) return content;
  const files = readdirSync(knowledgeDir)
    .filter((file) => file.endsWith(".md"))
    .sort();
  if (files.length === 0) return content;
  const sections = files.map((file) => {
    const text = readFileSync(join(knowledgeDir, file), "utf-8").trim();
    return (
      `<!-- Absorbed at build time from knowledge/${agentName}/${file} - ` +
      `edit that file, not this generated copy. -->\n\n${text}`
    );
  });
  return `${content.trimEnd()}\n\n---\n\n${sections.join("\n\n---\n\n")}\n`;
}

export function agentNameFromPath(srcPath: string): string | null {
  const posixPath = srcPath.split(sep).join("/");
  if (!posixPath.includes("/agents/") || !posixPath.endsWith("-agent.md")) {
    return null;
  }
  return posixPath.split("/").pop()?.replace(/\.md$/, "") ?? null;
}

export function projectCursorPluginAgent(
  content: string,
  srcPath: string,
): string {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    throw new Error(`${srcPath}: plugin agent has no closed frontmatter block.`);
  }
  const frontmatter = match[1]
    .split(/\r?\n/)
    .filter((line) => !/^(?:model|tier|effort|variant):/.test(line))
    .join("\n");
  return content
    .replace(match[0], () => `---\n${frontmatter}\n---\n`)
    .replace(/\{\{HARNESS_DIR\}\}/g, ".cursor");
}

function parsePluginTarget(value: unknown, file: string): PluginTarget {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${file}: plugin target entry must be an object`);
  }
  const target = value as Record<string, unknown>;
  if (
    typeof target.harnessName !== "string" ||
    typeof target.harnessDir !== "string" ||
    typeof target.manifestDir !== "string" ||
    (
      target.kind !== "store" &&
      target.kind !== "kiro" &&
      target.kind !== "kiro-ide" &&
      target.kind !== "cursor"
    )
  ) {
    throw new Error(`${file}: plugin target entry has an invalid shape`);
  }
  return {
    harnessName: target.harnessName,
    harnessDir: target.harnessDir,
    manifestDir: target.manifestDir,
    kind: target.kind,
  };
}

export function loadPluginTargets(
  file = resolveHarnessPath(["tools", "data", "plugin-targets.json"]),
): PluginTarget[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(
      `cannot read plugin targets from ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${file}: plugin targets must be an array`);
  }
  return parsed.map((value) => parsePluginTarget(value, file));
}

export function pluginTargetFor(
  harnessName: string,
  targets: readonly PluginTarget[] = loadPluginTargets(),
): PluginTarget | null {
  return targets.find((target) => target.harnessName === harnessName) ?? null;
}

export function buildPluginProjection(
  options: BuildPluginProjectionOptions,
): string {
  const pluginRoot = resolve(options.pluginRoot);
  const outDir = resolve(options.outDir);
  const pluginName = basename(pluginRoot);
  if (pluginName === "aidlc" || pluginName.startsWith("aidlc-")) {
    throw new Error(
      `plugin name "${pluginName}" is reserved: names must not be "aidlc" or start with "aidlc-"`,
    );
  }

  const manifestPath = join(pluginRoot, ".aidlc-plugin", "plugin.json");
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    throw new Error(
      `${pluginRoot}: cannot parse ${manifestPath}: ${error instanceof Error ? error.message : String(error)}. Fix the manifest JSON.`,
    );
  }

  const version = manifest.version || "0.0.1";
  const author = manifest.author || { name: "AIDLC" };
  const description = manifest.description || "";
  const { harnessName, harnessDir, manifestDir, kind } = options.target;
  const templateDir =
    options.templateDir ??
    resolveHarnessPath(["tools", "data", "plugin-hooks-template"]);
  const reviewerCoreStagesDir =
    options.reviewerCoreStagesDir ??
    resolveHarnessPath(["aidlc-common", "stages"]);
  const reviewerPluginStagesDir =
    options.reviewerPluginStagesDir ?? join(pluginRoot, "stages");
  const contentDirs = [
    "stages",
    "sensors",
    "tools",
    "contributions",
    "scopes",
    "agents",
    "knowledge",
  ];

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const hostManifestDir = join(outDir, manifestDir);
  mkdirSync(hostManifestDir, { recursive: true });
  writeFileSync(
    join(hostManifestDir, "plugin.json"),
    JSON.stringify(
      { name: `aidlc-${pluginName}`, version, description, author },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(hostManifestDir, "marketplace.json"),
    JSON.stringify(
      {
        name: "aidlc-plugins",
        owner: author,
        description: "AIDLC plugin catalogue.",
        plugins: [
          {
            name: `aidlc-${pluginName}`,
            source: ".",
            version,
            description,
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );

  const hooksDir = join(outDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  for (const file of readdirSync(templateDir)) {
    if (
      file === "aidlc-plugin-compose.ts" &&
      kind !== "cursor" &&
      kind !== "kiro-ide"
    ) {
      continue;
    }
    cpSync(join(templateDir, file), join(hooksDir, file));
  }

  const rootExpr =
    harnessName === "claude"
      ? "$" + "{CLAUDE_PLUGIN_ROOT}"
      : "$" + "{PLUGIN_ROOT}";
  let command: string;
  if (kind === "cursor") {
    command = `bun ./hooks/aidlc-plugin-compose.ts ${harnessDir}`;
  } else if (kind === "kiro-ide") {
    command =
      `bun ./hooks/aidlc-plugin-compose.ts ${harnessDir} ${harnessName}`;
  } else {
    const composePath = `${rootExpr}/hooks/compose.ts`;
    const aidlcExpr =
      "AIDLC=$(command -v aidlc 2>/dev/null || true); " +
      `[ -n "$AIDLC" ] && { AIDLC_HARNESS_DIR=${harnessDir} AIDLC_HARNESS_NAME=${harnessName} "$AIDLC" plugin sync && exit 0; }; `;
    const bunExpr =
      "BUN=$(command -v bun 2>/dev/null || true); " +
      '[ -z "$BUN" ] && [ -x "$HOME/.bun/bin/bun" ] && BUN="$HOME/.bun/bin/bun"; ' +
      '[ -z "$BUN" ] && { echo "aidlc plugin compose: aidlc and bun not found, skipping" >&2; exit 0; }';
    command =
      `sh -c '${aidlcExpr}${bunExpr}; AIDLC_HARNESS_DIR=${harnessDir} ` +
      `AIDLC_HARNESS_NAME=${harnessName} "$BUN" "${composePath}"'`;
  }

  if (kind === "kiro") {
    // Kiro CLI 2.x registers hooks only in agent configuration. Folder-drop
    // plugins retain compose.ts for explicit composition.
  } else if (kind === "kiro-ide") {
    const kiroHooksDir = join(outDir, harnessDir, "hooks");
    mkdirSync(kiroHooksDir, { recursive: true });
    writeFileSync(
      join(kiroHooksDir, `aidlc-${pluginName}-compose.json`),
      JSON.stringify(
        {
          version: "v1",
          hooks: [
            {
              name: `aidlc-${pluginName}-compose`,
              trigger: "SessionStart",
              description: `Composes the ${pluginName} AIDLC plugin at session start.`,
              action: { type: "command", command },
            },
          ],
        },
        null,
        2,
      ) + "\n",
    );
  } else if (kind === "cursor") {
    writeFileSync(
      join(hooksDir, "hooks.json"),
      JSON.stringify(
        {
          version: 1,
          hooks: {
            sessionStart: [{ command }],
          },
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    writeFileSync(
      join(hooksDir, "hooks.json"),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command,
                    statusMessage: `AIDLC ${pluginName}: composing plugin`,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
    );
  }

  for (const dir of contentDirs) {
    const srcDir = join(pluginRoot, dir);
    if (!existsSync(srcDir)) continue;
    for (const file of walkFiles(srcDir)) {
      const outputDir =
        kind === "cursor" && dir === "agents"
          ? join(outDir, "aidlc", "agents")
          : join(outDir, dir);
      const outPath = join(outputDir, relative(srcDir, file));
      mkdirSync(dirname(outPath), { recursive: true });
      let content = readFileSync(file);
      if (dir === "agents" && file.endsWith("-agent.md")) {
        let projected = absorbReviewerKnowledge(
          content.toString("utf-8"),
          basename(file, ".md"),
          reviewerCoreStagesDir,
          pluginRoot,
          reviewerPluginStagesDir,
        );
        if (kind === "cursor") {
          projected = projectCursorPluginAgent(projected, file);
        }
        content = Buffer.from(projected, "utf-8");
      }
      writeFileSync(outPath, content);
    }
  }

  return outDir;
}
