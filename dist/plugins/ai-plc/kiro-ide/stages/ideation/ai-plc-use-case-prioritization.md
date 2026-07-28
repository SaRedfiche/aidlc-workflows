---
slug: ai-plc-use-case-prioritization
number: 1.53
name: Use Case Prioritization
plugin: ai-plc
phase: ideation
execution: CONDITIONAL
condition: Execute after ai-plc-use-case-intake when multiple use cases need ranking. Skip when a single solution or use case is already selected.
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-prioritization-scoring
  - ai-plc-prioritization-ranking
consumes:
  - artifact: ai-plc-use-cases
    required: true
requires_stage:
  - ai-plc-use-case-intake
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc-discovery
  - ai-plc-full
inputs: The confirmed use-case set from ai-plc-use-case-intake
outputs: scoring.md, ranking.md (under this stage's record dir, engine-resolved)
---

# Use Case Prioritization

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Score every captured use case with the framework matching its type, rank
them, and select the top candidates (default: top 3) for prototype
specification. Show the arithmetic; the human adjusts the selection, not the
other way around.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Apply the Frameworks

Read `ai-plc-use-cases` from the intake record dir. Score each use case 0-10
per criterion with a one-line rationale, using the framework for its type:

**Agentic framework** (weights): Business Value 25%, LLM Capability Match
20%, Tool Availability 15%, User Acceptance 15%, Time to Market 15%,
Strategic Alignment 10%.

**Application framework** (weights): Business Value 25%, Technical
Feasibility 20%, User Impact 20%, Development Effort 15% (inverse - less
effort scores higher), Integration Complexity 10% (inverse), Strategic
Alignment 10%.

Compute each use case's weighted total. Write `scoring.md` in this stage's
record dir: per use case, every criterion score with its rationale and the
weighted total, grouped by type, with the frameworks and weights documented
at the top.

### Step 3: Generate and Present Rankings

Write `ranking.md` in this stage's record dir: agentic and application use
cases ranked separately by score, then the recommended top 3 across both
lists with the selection rationale.

Present the ranked tables (rank, name, score, key strengths) and the
recommended top 3 as a structured question: agree with the selection, or
adjust it (the user names which use cases instead). Iterate until the
selection is confirmed, then record the final selection and rationale in
`ranking.md`. STOP for the human response.

### Step 4: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-use-case-prioritization --result awaiting-approval`.

### Step 5: Present Completion & Request Approval

Completion emoji: :trophy:
Review path: this stage's engine-resolved record dir.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
artifacts, then report `--result revised` before re-presenting.

## Sensors

This stage's outputs are markdown artefacts under its record dir. The imported `required-sections` and `upstream-coverage` sensors check those outputs.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions -
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts - the ritual writes into the
harness, not into this file.
