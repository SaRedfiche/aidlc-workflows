# aidlc-live-status — live status + stall detector for the AIDLC v2 engine

A **standalone, conductor-side** reader that gives a human visibility during the
long silent waits while driving the AIDLC v2 engine. It reads only the engine's
own on-disk artifacts by their documented grammar — **no engine-core import, no
writes to the ledger** — so it is safe to run against a live workflow and needs
no maintainer sign-off to adopt.

It addresses the three silence sources:

1. **The next/continue stream** — surfaces the current part and continue-token
   when a `load-steering` directive is mid-stream, plus the phase/stage that is
   coming next.
2. **Inside a run-stage body** — surfaces intent / phase / stage (X of N),
   active lead, mode, and the next gate, read from `aidlc-state.md` +
   `active-directive.json`.
3. **Guard/hook STALLS (the worst case)** — the stall detector distinguishes a
   **BUSY** engine from a **WEDGED** one. A wedge is the audit signature of a
   hung PreToolUse hook chain (hook #4, the plan-approval-guard, blocking on
   I/O): only bare `HUMAN_TURN` events accrue with no engine-activity event
   between them. When that persists past a threshold the detector emits
   **WEDGED**, names the likely hook, and gives the documented remedy
   (`AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1` + fresh session). It fails **toward**
   signalling, never toward a false clean.

## Ground-truth sources (verified against a live workshop workflow, 2026-09-24)

| What | Path | Format |
|---|---|---|
| Audit log | `aidlc/spaces/<space>/intents/<slug-id8>/audit/*.md` (per-intent, per-clone shards; space-root fallback `aidlc/spaces/<space>/audit/*.md`) | Markdown blocks split by `\n---\n`; each has `## <heading>`, `**Timestamp**: <ISO seconds Z>`, `**Event**: <EVENT_TYPE>`, then `**Key**: value`. First line `# AI-DLC Audit Log`. Matches `aidlc-audit.ts` `renderAuditBlock` / `auditBlockField`. |
| State | `aidlc/spaces/<space>/intents/<slug-id8>/aidlc-state.md` | `- **Current Stage**`, `- **Next Stage**`, `- **Lifecycle Phase**`, `- **Status**`, `- **Active Agent**`, `- **Total Stages**`/`- **Completed**`, and a `## Stage Progress` checkbox list (`[ ] [-] [?] [R] [x] [S]`; rows tagged `— SKIP` or `[S]` are excluded from the executable X-of-N count). |
| Run-stage cursor | `aidlc/spaces/<space>/intents/<slug-id8>/.aidlc-engine/active-directive.json` | JSON: `kind` (run-stage / load-steering / ask / …), `stage`, `delivery`, `active_attempt.command_kind` (next/continue/report/park), and a `steering_payload` whose `i`=part index, `g`=gate, `n`=next-stage label. |

`HUMAN_TURN` is a first-class audit event (heading "Human Turn"), emitted only by
the prompt-submit hook — it is CLI-reserved, so the wedge signature can be read
but not forged.

**Note:** `core/tools/aidlc-channel.ts` is the release-channel (stable/preview
version-id) module — **not** a progress channel. The engine has no native
progress/event channel today; this tool fills that gap by reading artifacts.

## Invocation

```
bun aidlc-live-status.ts status  --project-dir <project> [--json]
bun aidlc-live-status.ts stall   --project-dir <project> [--threshold-secs 90] [--json]
bun aidlc-live-status.ts both    --project-dir <project> [--json]
bun aidlc-live-status.ts watch   --project-dir <project> [--interval-secs 5] [--threshold-secs 90]
```

- `status` prints one rolling line (or JSON) — designed for a conductor to poll
  and surface as an mcwidget or a status line.
- `stall` exits **3** when WEDGED, so a conductor loop can branch on it.
- Runs under `bun` (the engine's toolchain). No dependencies.

## Validation

- **Live-status: real-engine validated.** Driven against a real workshop
  workflow (`aidlc engine intent create` → `orchestrate next`), it read
  `INCEPTION › practices-discovery (4 of 25)`, the lead agent, `next=…[gate]`,
  and tracked a real directive transition `run-stage → ask` (guard-recovery).
- **Stall detector BUSY/IDLE: real-engine validated** against the same live
  audit log.
- **Stall detector WEDGED: synthetic-validated.** A real hook hang cannot be
  forced safely in a sandbox, so the WEDGED path is validated against a
  synthetic audit log (`fixtures/wedged/…`) written in the exact engine grammar
  with the bare-`HUMAN_TURN` signature. This is a deliberate, labelled synthetic
  — the parsing and decision logic it exercises are the same code paths the real
  log would hit.

## Tests / toolchain

Matches the engine's toolchain (bun + tsc + biome):

```
bun test aidlc-live-status.test.ts                 # 9/9
<engine>/node_modules/.bin/tsc --noEmit -p tsconfig.json
<engine>/node_modules/.bin/biome check aidlc-live-status.ts aidlc-live-status.test.ts
```

The suite covers audit-grammar parsing, status assembly (X-of-N, phase, lead,
next+gate), and the BUSY / WEDGED / IDLE / NO_WORKFLOW decision with a
deterministic injected clock (no real waits).

## Open question / maintainer sign-off item

Whether A (live status) and B (stall detection) should be **upstreamed as a
native engine progress event** — e.g. the engine emitting a structured
`PROGRESS`/heartbeat row, or `active-directive.json` gaining an explicit
`parts`/`part` pair on load-steering markers — rather than living as an external
artifact reader. That is a maintainer decision (it touches engine-core emit
paths); this tool deliberately changes no engine-core file.
