# Running on other harnesses

AI-DLC is one harness-neutral core rendered onto the CLI you use. The
methodology — the [phases and stages](../04-phases-and-stages.md), the
[agents](../06-agents.md), the [scopes](../05-scopes-and-depth.md), the
[approval gates](../07-interaction-modes.md) — is identical on every harness.
What differs is the *shell*: how gates render, how subagents are dispatched,
which session events fire, where config lives. Each chapter here covers one
harness's install steps, prerequisites, and the handful of behaviours that
differ from the neutral methodology.

## Install first

The recommended first-run path for every harness is the checksum-verified native
installer followed by `aidlc init`:

```bash
curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh \
  | bash -s -- --harness claude
cd your-project
aidlc init
```

Replace `claude` with `kiro`, `kiro-ide`, `codex`, or `opencode` as needed. The
native runtime has no Bun, Node.js, or Git dependency. Run the installer
without arguments in an interactive terminal to pick a harness; the Unix
picker reads from `/dev/tty`, including when the script is piped. Automation,
`--yes`, `--json`, `--quiet`, and runs without a controlling terminal require
the literal `--harness` flag. Host prerequisites still apply: Codex requires
the target project to be a Git repository for project hook discovery.

On Windows, download `install.ps1` and invoke it as
`& $installer --harness <name>`. An interactive run without the flag shows the
same picker; redirected or `pwsh -NonInteractive` runs require the flag.

Pick your harness:

| Harness | Invoke | Next step and trust | Chapter |
|---------|--------|---------------------|---------|
| **Claude Code** | `/aidlc` | Open Claude Code, then `/aidlc --doctor`; the native projection allows `aidlc *`. | Covered throughout the [User Guide](../00-introduction.md); install details are in [Getting Started](../01-getting-started.md). |
| **Kiro IDE** | `/aidlc` | Open the project, then `/aidlc --doctor`; init merges `aidlc *` into IDE trusted commands. | [Running AI-DLC on Kiro IDE](kiro-ide.md) |
| **Kiro CLI** (≥ 2.6) | `/aidlc` | Run `kiro-cli chat`, then `/aidlc --doctor`; the projected default agent permits `aidlc *`. | [Running AI-DLC on Kiro CLI](kiro-cli.md) |
| **Codex CLI** (≥ 0.145.0) | `$aidlc` | In a Git repository, run `codex`, approve project hook trust (or apply the generated trust seed), then `$aidlc --doctor`. | [AI-DLC on Codex CLI](codex-cli.md) |
| **opencode** (≥ 1.17) | `/aidlc` | Run `opencode`, then `/aidlc --doctor`; the projected config allows direct `aidlc *` calls. | [AI-DLC on opencode](opencode.md) |

AI-DLC on Kiro (IDE or CLI) works best with **Claude Opus 4.8**, which requires a **paid Kiro plan**.

The committed `dist/<harness>/` trees remain a source/development alternative.
That copy channel requires Git and Bun and does not use `aidlc init`; each
harness chapter keeps its copy instructions under a clearly labeled
alternative.

After `aidlc upgrade`, run `aidlc doctor` to see project/runtime version skew
and refresh each project with `aidlc init` between workflows. Init refuses an
active-workflow refresh, protecting running work from changed stage or graph
definitions.

This set is open: a new harness gets its own chapter here, added from the same
template. For *building* a new harness (the source contract — manifest, hook
adapter, `emit.ts`), see the Harness Engineer Guide's
[Porting to a New Harness](../../harness-engineering/09-porting-to-a-new-harness.md).

Whichever harness you run, the methodology is the same — start with
[Your First Workflow](../02-your-first-workflow.md) and the
[Phases and Stages](../04-phases-and-stages.md) tour.
