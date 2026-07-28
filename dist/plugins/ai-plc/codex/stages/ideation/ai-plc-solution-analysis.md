---
slug: ai-plc-solution-analysis
number: 1.51
name: Solution Analysis
plugin: ai-plc
phase: ideation
execution: CONDITIONAL
condition: Execute only after ai-plc-envision produced an approved PR/FAQ, to determine whether it describes one solution or several. Skip when discovery started from a use-case list or from existing PROTOTYPE-*.md specifications.
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-identified-solutions
consumes:
  - artifact: ai-plc-prfaq
    required: true
  - artifact: ai-plc-pain-point-analysis
    required: true
requires_stage:
  - ai-plc-envision
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc
  - ai-plc-pain-points
inputs: The approved PR/FAQ and pain-point analysis from ai-plc-envision
outputs: identified-solutions.md (under this stage's record dir, engine-resolved)
---

# Solution Analysis

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Analyze the approved PR/FAQ to determine whether it describes a single clear
solution or multiple solution options, and route the run accordingly: a
single solution goes straight to prototype specification; multiple solutions
merge into the use-case prioritization path.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Analyze the PR/FAQ

Read the approved `ai-plc-prfaq` and `ai-plc-pain-point-analysis` artifacts
from the ai-plc-envision record dir. Identify how many distinct solutions the
PR/FAQ describes and whether it suggests alternatives or options. For each
identified solution, determine:

- **Type**: Agentic or Application
- **Scope**: Standalone or integrated
- **Complexity**: Simple, Medium, Complex

### Step 3: Document the Solutions

Write `identified-solutions.md` in this stage's record dir, containing:

- **Solutions Identified** - per solution: name, type (Agentic/Application), description, the pain points it addresses, key capabilities
- **Recommendation** - single solution, or multiple solutions requiring prioritization
- **Next Steps** - the determination and its consequence for the run

Determination rules: SINGLE SOLUTION when the PR/FAQ describes one clear
approach with no alternatives; MULTIPLE SOLUTIONS when it mentions several
approaches or the pain points could be addressed in materially different
ways.

### Step 4: Present the Determination

Present the identified solutions and the routing consequence as a structured
question:

- **Single solution**: confirm proceeding directly to prototype specification (`ai-plc-prototype-context`) for that solution.
- **Multiple solutions**: offer (A) prioritize them and prototype the top 3 - the solutions become use-case candidates and the run proceeds through `ai-plc-use-case-prioritization`; or (B) focus on one named solution and skip prioritization.

STOP for the human response.

### Step 5: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-solution-analysis --result awaiting-approval`.

### Step 6: Present Completion & Request Approval

Completion emoji: :bulb:
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
