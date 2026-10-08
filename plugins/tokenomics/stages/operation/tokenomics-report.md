---
slug: tokenomics-report
number: 5.80
name: AI Tokenomics Report
plugin: tokenomics
phase: operation
execution: CONDITIONAL
condition: Execute at workshop close, or on demand under the tokenomics scope, to report what the feature cost to build in AI tokens and list-price dollars.
lead_agent: tokenomics-reporter-agent
support_agents: []
mode: inline
produces:
  - tokenomics-report
consumes: []
requires_stage: []
sensors: []
scopes:
  - tokenomics-spend
inputs: The usage ledger core already keeps for this intent (aidlc/.aidlc-sessions/usage-ledger.json)
outputs: tokenomics-report.md (under this stage's record dir, engine-resolved)
---

# AI Tokenomics Report

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

A read-only, end-of-workshop report of what this feature cost to build in AI
usage. It renders the usage ledger AI-DLC already keeps — tokens and list-price
cost, attributed per phase, stage, model, and agent — into one report. It
captures nothing new and parses no transcript; it only reads and formats.

Honesty constraints this stage MUST preserve:
- The dollar figure is a **list-price estimate**, not a billed AWS figure. Say so.
- Token/cost capture is wired only in the Claude harness. On other harnesses the
  ledger is empty and the report renders an honest empty state — never a zero.
- An unknown model's cost is shown as unpriced, never fabricated.

## Steps

### Step 1: Generate the report

Run the plugin's read-only report tool against the current intent:

`bun {{HARNESS_DIR}}/tools/tokenomics-report.ts`

This resolves the active intent, loads the ledger, folds stages into phases,
and writes the Markdown report. For a terminal summary use `--table`; for a
machine-readable form use `--json`.

### Step 2: Write the artifact

Write `tokenomics-report.md` to this stage's engine-resolved record directory,
leading with the cost headline exactly as the tool emits it (a plain estimate
when every model is priced, an incomplete priced subtotal when any model is
unpriced — never relabel a subtotal as a total) and total tokens, then the
by-phase,
by-stage, by-model, and by-agent breakdowns and the cache-economics line.

### Step 3: Open the Approval Gate

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage tokenomics-report --result awaiting-approval`.

### Step 4: Present Completion & Request Approval

Completion emoji: :money_with_wings:
Review path: this stage's engine-resolved record dir.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report Request Changes with
`--result rejected --user-input "<feedback>"`, revise the artifact, then report
`--result revised` before re-presenting.

## Learn

While running this stage, record observations in the engine-created
`<record>/<phase>/<stage>/memory.md`. Treat it as an output-only target: never
read, probe, create, or initialize it. Follow the active harness's diary-write
discipline when inserting entries under Interpretations, Deviations, Tradeoffs,
and Open questions, each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
