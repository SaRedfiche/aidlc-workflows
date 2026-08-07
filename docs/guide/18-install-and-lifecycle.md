# Install and Lifecycle

The native release channel installs a self-contained `aidlc` command and one
or more harness runtimes. `aidlc init` then creates or refreshes a project from
that local runtime. The installer and init path do not require Bun, Node.js,
or Git.

This chapter describes the native install lifecycle available in this release.
The planned `aidlc setup` experience, npm package, and package-manager formulas
are not available yet. Existing copy installs remain supported and continue to
invoke the TypeScript tools with Bun.

## Install

Release assets cover:

- macOS x64 and arm64
- Linux x64 and arm64, with glibc and musl builds
- Windows x64

Install as the target user. The Unix installer refuses root; the Windows
installer refuses an elevated Administrator session. Native installs are
per-user and do not need `sudo`.

Choose from `claude`, `kiro`, `kiro-ide`, `codex`, and `opencode`. For an
interactive picker:

```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  | bash
```

### macOS and Linux

```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  | bash -s -- --harness claude
export PATH="$HOME/.local/bin:$PATH"
```

An online run needs `curl` or `wget`; every run needs `sha256sum` or `shasum`.
It installs
versions under `${XDG_DATA_HOME:-$HOME/.local/share}/aidlc/versions/` and
links `$HOME/.local/bin/aidlc` to the active version by default.

The installer does not edit a shell startup file unless
`--profile <absolute-path-under-$HOME>` is explicit. That option writes or
updates one `BEGIN AI-DLC:PATH` block transactionally and preserves the rest
of the file.

### Windows PowerShell

```powershell
$installer = Join-Path $env:TEMP install-aidlc.ps1
irm https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.ps1 -OutFile $installer
& $installer --harness claude
```

Windows installs versions under `%LOCALAPPDATA%\aidlc\versions\` and keeps a
stable `%LOCALAPPDATA%\aidlc\bin\aidlc.cmd` shim. The installer adds that bin
directory to the current PowerShell process and prints the command needed in
new sessions; it does not edit a PowerShell profile.

Use the literal `--harness` spelling shown above. Other PowerShell installer
parameters use their native names, such as `-Version`, `-From`, `-Offline`,
`-ReleaseBaseUrl`, `-CaBundle`, `-Yes`, `-Quiet`, `-Json`, and `-NoColor`.

### Harness Selection and Automation

`--harness <name>` is repeatable, so one install can include several harness
runtimes. Without it, human mode presents a numbered picker when a controlling
terminal is available. The Unix picker reads `/dev/tty`, so it also works when
the script itself arrives through a pipe.

Automation must pass at least one `--harness`. This includes runs with no
terminal and installer runs using `--yes`, `--quiet`, or `--json`.
PowerShell also treats redirected input and `pwsh -NonInteractive` as
non-interactive.

### Installer Options

| Unix | PowerShell | Meaning |
|------|------------|---------|
| `--harness <name>` | `--harness <name>` | Install a named harness; repeatable |
| `--version <x.y.z>` | `-Version <x.y.z>` | Install one strict semantic version instead of latest |
| `--from <dir>` | `-From <dir>` | Read a flat release set locally and imply offline mode |
| `--offline` | `-Offline` | Forbid network access; requires `--from` / `-From` |
| `--release-base-url <url>` | `-ReleaseBaseUrl <url>` | Use a compatible release mirror |
| `--ca-bundle <absolute-path>` | `-CaBundle <absolute-path>` | Use a custom CA bundle |
| `--profile <absolute-path>` | Not available | Transactionally add the Unix PATH block |
| `--yes` | `-Yes` | Automation mode; it does not bypass integrity checks |
| `--quiet` | `-Quiet` | Suppress progress and emit one result line |
| `--json` | `-Json` | Suppress progress and emit one schema-versioned JSON result |
| `--no-color` | `-NoColor` | Disable color output |
| `--help` | Not exposed | Print Unix installer usage |

`AIDLC_RELEASE_BASE_URL` and `AIDLC_CA_BUNDLE` provide installer defaults;
explicit options win. `AIDLC_INSTALL_ROOT` and `AIDLC_BIN_DIR` override the
machine and command locations. Those paths must be absolute on Unix. The
PowerShell installer also honors `AIDLC_OFFLINE=1`; the Unix installer
requires the explicit `--offline` or `--from` spelling.

### Release Authentication

The installer:

1. Downloads or reads `version.json` and `checksums.txt`.
2. Verifies the `version.json` SHA-256 before trusting its asset metadata.
3. Verifies the selected binary and harness archives by SHA-256 and declared
   byte length.
4. Lets the verified binary validate and transactionally install the release.

Metadata is limited to 1 MiB and individual release assets to 1 GiB. Asset
names cannot contain paths. Archive extraction rejects links, special files,
path traversal, absolute paths, duplicate entries, and oversized expansion.

The release workflow re-verifies `checksums.txt` before publishing and
publishes a GitHub build-provenance attestation for the release artifacts.
TLS, SHA-256, and that provenance are the permanent trust model. OS
code-signing and notarization are not part of it.

The installer refuses an existing mixed-ownership command. It also yields to
an existing Homebrew or Nix command instead of replacing it. This project does
not yet ship those package-manager channels; use the owning manager or choose
an explicit empty `AIDLC_BIN_DIR`.

## Initialize or Refresh a Project

Run init before opening the harness:

```bash
cd your-project
aidlc init --dry-run --json
aidlc init
aidlc doctor
```

`aidlc init` is local-only and transactional. It creates the selected harness
tree, the `aidlc/` workspace shell, root integrations, a projection stamp, and
an ownership baseline. It does not create a workflow intent.

### Init Options

| Option | Meaning |
|--------|---------|
| `--project-dir <path>` | Target this project instead of the current directory |
| `--harness <name>` | Select an installed harness runtime |
| `--from <dir-or-tgz>` | Use a local projection directory or projection archive instead of an installed runtime |
| `--mcp defaults\|none` | Add or omit Claude's optional shipped MCP entries |
| `--dry-run` | Calculate the complete plan without creating the target directory or changing bytes |
| `--plan-token <token>` | Apply only the exact plan approved from a JSON dry run |
| `--force` | Replace locally modified framework-owned files and managed blocks where that policy permits |
| `--yes` | Confirm an otherwise unrecognized target directory; it does not imply MCP consent or choose a harness |
| `--json` | Emit one result object with counts, actions, and `data.planToken` |
| `--quiet` | Emit one summary or remediation line |
| `--no-color` | Disable color output |

An existing project stamp fixes the harness for a refresh. For a fresh
project, selection order is explicit `--harness`, machine default, the only
installed harness, then an interactive picker. Multiple candidates in a
non-interactive run require `--harness`. If `.aidlc-version` exists, init
requires a source at that exact version with the matching project harness.

Init recognizes directories containing `.git`, `package.json`, `Cargo.toml`,
`go.mod`, or `pyproject.toml`. Outside those shapes, interactive mode asks for
confirmation and non-interactive mode requires `--project-dir`.

Claude's optional MCP integration defaults to `none` without a TTY. A human
TTY is prompted when no prior choice exists. `--yes` and `--json` do not grant
MCP consent. Reliable automation supplies `--project-dir`, `--harness`, and
`--mcp defaults|none` explicitly; JSON controls output but does not disable
TTY prompts by itself.

For exact scripted approval:

```bash
token=$(
  aidlc init --project-dir "$PWD" --harness claude --mcp none \
    --dry-run --json | jq -r .data.planToken
)
aidlc init --project-dir "$PWD" --harness claude --mcp none \
  --plan-token "$token" --json
```

Use identical source and behavior options for both calls. Source bytes,
options, or project state changing after the preview changes the token and
the apply fails closed.

### Refresh Safety

A refresh changes project engine and graph files, so init refuses while any
workflow in any space is not complete. Parked workflows still count as
active. Complete every workflow named in the error, then rerun init.

The check runs once while planning and again under the workspace audit lock
immediately before commit. `--force`, `--yes`, and `--plan-token` do not bypass
it. `aidlc upgrade` and `aidlc rollback` remain safe during a workflow because
they only change machine state.

Refresh preserves:

- all workspace records, audit shards, knowledge, and other project files
  absent from the shipped projection
- existing `aidlc/active-space` and space memory files, which are
  project-owned seeds
- every non-identity sibling key in mutable `tools/data/harness.json`,
  including plugin selection and future policy records
- plugin-composed files and recorded stage contributions, then regenerates
  graph, runner, scope, and compiled table surfaces
- upstream-authored orchestrator prose while rebuilding its compiled stage and
  scope regions from the preserved project composition

Locally modified framework-owned files conflict against the prior baseline.
`--force` replaces those files with the refreshed candidate, including local
edits to hand-authored orchestrator prose. It does not claim unrelated
project content.

### Root Integrations and Ownership

| Surface | Harnesses | Policy |
|---------|-----------|--------|
| `.gitignore` | All | Own one marked AI-DLC block; preserve every byte outside it |
| `.mcp.json` / `mcpServers` | Claude | Add or remove only consented, baseline-owned entries; preserve user keys and overrides |
| `AGENTS.md` | Kiro CLI, Kiro IDE, Codex, OpenCode | Own one marked onboarding block; preserve project instructions |
| `.vscode/settings.json` / `kiroAgent.trustedCommands` | Kiro IDE native channel | Reconcile only the shipped string entries; preserve other settings and values |
| `opencode.json` | OpenCode | Whole-file ownership; an unknown existing file is a conflict |

Known unmarked files and JSON entries from historical shipped projections are
adopted only when their exact recorded SHA-256 signature matches. Modified
lookalikes remain ambiguous and are refused.

`--force` can replace a modified, baseline-owned managed block or managed
harness file. It cannot adopt ambiguous unmarked content, overwrite a
user-owned JSON value, or replace an unowned or locally modified whole-file
integration such as `opencode.json`. Malformed JSON, malformed or duplicate
markers, non-regular-file targets, and retired owned content whose integrity
cannot be proved are hard conflicts.

Every planned path receives one action:

| Action | Meaning |
|--------|---------|
| `create` | Add an absent framework path |
| `update` | Refresh framework-owned bytes |
| `merge` | Reconcile a managed block, JSON map, or JSON array |
| `preserve` | Keep current or project-owned bytes |
| `remove` | Remove content previously owned by the baseline and retired upstream |
| `conflict` | Refuse because ownership or integrity cannot be proved |

Successful init prints the host-specific next step:

| Harness | Next step |
|---------|-----------|
| Claude Code | Open Claude Code and run `/aidlc --doctor` |
| Kiro CLI | Run `kiro-cli chat`, then `/aidlc --doctor` |
| Kiro IDE | Open the project in Kiro IDE, then run `/aidlc --doctor` |
| Codex CLI | Run `codex`, then `$aidlc --doctor` |
| OpenCode | Run `opencode`, then `/aidlc --doctor` |

## Upgrade, Roll Back, and Retained Versions

`aidlc update` is an exact alias for `aidlc upgrade`.

| Command | Public options and behavior |
|---------|-----------------------------|
| `aidlc upgrade` | Install latest, preserve the active version's harness set, then atomically activate. Accepts `--version <x.y.z>`, `--from <release-dir>`, `--release-base-url <url>`, `--ca-bundle <path>`, `--offline`, and `--dry-run`. A first lifecycle install without an active version also needs one or more `--harness` values; the normal first-install path is the installer. |
| `aidlc upgrade --check` | Refresh update metadata without installing. Returns 5 when behind, 0 when current, 3 when unavailable/offline, and 1 when checks are disabled. |
| `aidlc rollback [--version <x.y.z>]` | Activate the recorded prior version or a named retained version without network or project changes. Refuses an incomplete target or one missing any harness present in the active version. |
| `aidlc rollback --list` | List complete, non-active retained versions. |
| `aidlc versions list` | Show active/rollback markers, installed harnesses, completeness, live pins, stale pin paths, and pin-registry warnings. |
| `aidlc versions install <x.y.z>` | Install an exact version side by side without activating it. Accepts repeatable `--harness`, `--from`, `--release-base-url`, `--ca-bundle`, and `--offline`; with no `--harness`, it can infer the current project's harness. |
| `aidlc versions prune [--yes]` | Remove every retained version not protected as active, rollback, live-pinned, or stale-pinned. An invalid pin registry blocks pruning. |

Upgrade downloads and fully validates a candidate before changing the active
pointer. An interruption before activation leaves the prior binary active and
may leave a complete unused version visible in `versions list`. `--dry-run`
still acquires and verifies the candidate but does not write or activate it.

Removing the final harness is valid. The command remains available for
lifecycle management, upgrade carries the empty harness set forward, doctor
reports that no runtime is installed, and `aidlc harness add <name>` restores
project operations.

## Project Pins and CI

```bash
aidlc versions install 2.5.45 --harness claude
aidlc use 2.5.45
git add .aidlc-version
```

`aidlc use <version>` requires a complete retained version and, for an
existing initialized project, that version's matching harness runtime. It
writes `.aidlc-version` and registers the real project path in machine-local
`pins.json`. `aidlc use current` removes both the project pin and its registry
entry.

Commit `.aidlc-version`. Engine commands validate the exact retained binary
and project harness before loading project data, then re-execute that binary
when it differs from the active version. A missing or incomplete pin fails
closed with `aidlc versions install <version>` remediation. Machine lifecycle
commands use the active binary; `doctor`, `init`, and `use` inspect pins without
being trapped behind them.

A fresh clone or CI runner installs the committed version before init:

```bash
version=$(cat .aidlc-version)
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  | bash -s -- --harness claude --version "$version" --quiet --yes
aidlc init --project-dir "$PWD" --harness claude --mcp none --quiet
aidlc doctor --project-dir "$PWD" --quiet
```

## Harness Management

| Command | Behavior |
|---------|----------|
| `aidlc harness list` | List runtimes in the active release, including product name, path, and default |
| `aidlc harness add <name>` | Acquire and add that harness for the active version, never latest; accepts `--from`, `--release-base-url`, `--ca-bundle`, and `--offline` |
| `aidlc harness remove <name> [--yes]` | Remove a harness from the active version without changing projects; also clears it if it was the default |
| `aidlc harness default <name>` | Set the harness chosen by fresh init when no explicit or existing project choice wins |
| `aidlc harness default clear` | Remove the machine default |

Removal prompts on a TTY and requires `--yes` without one.

## Offline Packages

Create a flat package on a connected machine:

```bash
aidlc package create --version 2.5.45 \
  --harness claude --target linux-x64 \
  --output ./aidlc-offline
aidlc package verify ./aidlc-offline
```

`--harness` and `--target` are repeatable. Current release targets are
`linux-x64`, `linux-arm64`, `linux-x64-musl`, `linux-arm64-musl`,
`darwin-x64`, `darwin-arm64`, and `windows-x64`.

`package create` accepts `--version`, `--from`, `--release-base-url`,
`--ca-bundle`, and `--offline`. Its output directory must be absent or empty.
The result includes selected binaries, selected harness archives, both
installers, `version.json`, and `checksums.txt`. `package verify <directory>`
is local and validates the entire flat set.

Install on the disconnected machine:

```bash
bash ./aidlc-offline/install.sh \
  --from ./aidlc-offline --offline --harness claude
```

```powershell
& .\aidlc-offline\install.ps1 `
  -From .\aidlc-offline -Offline --harness claude
```

For native commands, `--offline`, `AIDLC_OFFLINE=1`, or global `offline=true`
prevents release sockets. A network operation without `--from` then fails
before mutation. Init, rollback, listings, config, completions, package
verification, plugin inspection, and uninstall are local regardless.

## Mirrors, Proxies, CAs, and Update Settings

Release settings resolve in explicit option, environment, machine-config,
default order:

| Setting | Environment | Machine config |
|---------|-------------|----------------|
| Offline | `AIDLC_OFFLINE=1` (`0` explicitly enables network) | `aidlc config global set offline on` |
| Mirror | `AIDLC_RELEASE_BASE_URL` | `aidlc config global set release-base-url <url>` |
| CA bundle | `AIDLC_CA_BUNDLE` | `aidlc config global set ca-bundle <absolute-path>` |

Manage the four machine keys:

```bash
aidlc config global list
aidlc config global get update-check
aidlc config global set update-check off
aidlc config global set offline on
aidlc config global set release-base-url https://mirror.example/releases
aidlc config global set ca-bundle /absolute/path/corporate-ca.pem
aidlc config global clear ca-bundle
```

The keys are `update-check`, `offline`, `release-base-url`, and `ca-bundle`.
Boolean values accept `true|false`, `on|off`, `1|0`, or `yes|no`.
`aidlc config <get|set|clear|list> ... --global` is equivalent.

Mirror base URLs must use HTTPS, except loopback HTTP for local testing, and
cannot contain credentials, a query, or a fragment. The native lifecycle
client follows at most five redirects; redirected URLs may contain a query but
still cannot contain credentials or a fragment. Its errors redact URL
credentials, queries, and fragments.

The native release client honors `HTTPS_PROXY` / `https_proxy` and
`NO_PROXY` / `no_proxy`; proxy URLs must use HTTP or HTTPS. It does not read
`HTTP_PROXY`. The bootstrap scripts delegate proxy behavior to `curl`,
`wget`, or `Invoke-WebRequest`. On Windows, a custom CA bundle requires
`curl.exe`.

Bare help and management listings never refresh the network. They may display
a valid cached update notice. Interactive human `aidlc doctor` may refresh
stale or absent metadata within 750 ms. Non-TTY, `--json`, and `--quiet`
doctor runs are cache-only unless `--check-updates` is explicit.
`doctor --check-updates` and `upgrade --check` use a 15-second metadata
budget. The cache expires after 24 hours; a failed or regressing refresh does
not replace a valid cache. `update-check=off` disables even explicit refreshes
but does not prevent an explicit `aidlc upgrade`.

## Plugins

The public routes are:

```bash
aidlc plugin select
aidlc plugin select aidlc,test-pro
aidlc plugin list --verbose
aidlc plugin list --json
aidlc plugin sync
aidlc plugin sync --prune-missing --yes
```

`plugin select` with no names prints the current selection and known plugin
identities. Pass comma-separated names or separate arguments to write an
explicit enabled set. `aidlc` names the core surfaces; initialization remains
enabled even when core is omitted.

Selection validates every identity under the workspace lock, refuses a change
that would strand an active workflow's scope or pending stage, strips newly
disabled recorded contributions in staging, regenerates graph/runners/tables,
and commits one transaction. Re-enabling a plugin restores its composed
contributions on the next host session start.

`plugin list` compares installed manifest version and deterministic source hash
with project composition and ownership records. The human status is `current`,
`run: aidlc plugin sync`, or `needs attention: <reason>`; `--verbose` adds the
internal state and `--json` emits the full inventory and statuses. Inspection
is always offline.

Claude and Codex can use their host registries for a proved full inventory.
Missing registry sources, malformed Claude enablement settings, and Kiro
outside an injected plugin-root hook fall back to current-root-only inventory.
Without full inventory, aggregate state is reported as unavailable rather
than guessed. Full-inventory discovery is not guaranteed for other hosts.

`plugin sync` composes enabled installed plugins into a staged project and
commits one rollback-safe transaction with version, source-hash, and ownership
records. Plain sync never deletes content for a missing installed source.
`--prune-missing` requires a proved full inventory, TTY confirmation or
`--yes`, and unchanged ownership hashes for every removed path. Invalid host
inventory, changed owned files, degraded compose telemetry, or source changes
during composition refuse the entire transaction.

The native routes accept `--project-dir <path>`. `list` accepts `--verbose` and
`--json`; `sync` accepts `--prune-missing`, `--yes`, and `--json`.

## Output, Automation, and Exit Codes

Native lifecycle, init, config, and management routes support human,
`--quiet`, and `--json` output where declared by the route registry. Plugin
output options are listed in the Plugins section; `version`, `help`, and
`completions` are human-output routes. `--json` emits a schema-versioned result
with `ok`, `code`, `status`, `message`, and command-specific `data` when
available. `--quiet` emits one success line or remediation line. Download
progress appears only in human mode.

The native diagnostic form is
`aidlc doctor [--project-dir <path>] [--verbose] [--json|--quiet]
[--check-updates] [--release-base-url <url>] [--ca-bundle <path>]
[--offline]`. `--export` writes a redacted diagnostic bundle, with
`--output <directory>` overriding its default project location; export output
is additional to the selected live-report mode.

`--no-color` and `NO_COLOR` disable ANSI output. `--project-dir <path>` selects
project context without changing the shell directory. Destructive operations
(`versions prune`, `harness remove`, `uninstall`, and plugin missing-content
pruning) prompt on a TTY and require `--yes` without one. `--yes` never bypasses
ownership, integrity, active-workflow, or release-authentication refusals.

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Operational failure |
| 2 | Usage or invalid machine configuration |
| 3 | Required network result or retained runtime unavailable |
| 4 | Integrity or ownership refusal |
| 5 | Check completed and action is required, such as an available upgrade |

## Help and Completions

`aidlc --help` prints the compact public command list. `aidlc help --all`
includes conductor plumbing and adapter routes for debugging; those hidden
routes are not stable scripting interfaces.

Generate deterministic shell definitions from the same public route registry:

```bash
aidlc completions bash
aidlc completions zsh
aidlc completions fish
aidlc completions powershell
```

The definitions complete route options and use bounded, local helper calls to
offer retained versions and installed harnesses. They never use the network.

Install bash output under
`~/.local/share/bash-completion/completions/aidlc`, put zsh output in a
directory on `$fpath`, or write fish output to
`~/.config/fish/completions/aidlc.fish`. Load PowerShell output for the current
session with:

```powershell
aidlc completions powershell | Out-String | Invoke-Expression
```

## Transactions and Recovery

Project and machine mutations stage on the destination filesystem, validate
the candidate, and commit through atomic renames. Concurrent changes detected
against planned state abort instead of overwriting new bytes. Abandoned
owner-private staging is swept only after lock and ownership checks.

If rollback of an interrupted commit cannot be completed safely, evidence is
retained in a named `.aidlc-recovery-*` quarantine under the machine install
root or project root. `aidlc doctor` reports it. Recover any needed files,
ensure no AI-DLC mutation is running, then remove only the listed directory
manually. Automatic staging cleanup never deletes quarantines.

Windows uninstall uses a recoverable continuation because a running executable
cannot remove its own command shim. A later command resumes a valid pending
continuation before doing other work.

## Copy Channel

Copying `dist/<harness>/` remains the source/development channel. Copy the
complete distribution root so the harness tree, `aidlc/` workspace shell, and
project-root files stay together. This channel still invokes
`bun <harness>/tools/aidlc.ts`; Bun must be on the PATH seen by hooks.

The separately generated `dist-release/<harness>/` trees are native release
payloads consumed through the installer and `aidlc init`, not replacements to
copy by hand. Prefer the public `aidlc` routes whenever the native command is
installed. Direct `bun .../tools/*.ts` calls remain copy-channel and developer
debug mechanisms, not a second native lifecycle interface.

## Uninstall

```bash
aidlc uninstall
aidlc uninstall --purge --yes
```

Uninstall removes the installer-owned command and all retained versions but
never changes project trees. Without `--purge`, it preserves machine config,
update cache, pin registrations, and the default harness. `--purge` removes
those machine records too.

Uninstall requires confirmation and refuses a root-owned, package-manager-owned,
or mixed-ownership command. On Windows it schedules verified cleanup after the
running command exits and resumes an interrupted continuation on the next
command.
