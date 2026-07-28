---
slug: ai-plc-discovery-document
number: 1.58
name: Discovery Document Assembly
plugin: ai-plc
phase: ideation
execution: ALWAYS
condition: Always executes as the last AI-PLC discovery stage - compiles every discovery artifact into the portable Discovery Document handoff
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-discovery-document
consumes:
  - artifact: ai-plc-pain-point-analysis
    required: false
  - artifact: ai-plc-prfaq
    required: false
  - artifact: ai-plc-identified-solutions
    required: false
  - artifact: ai-plc-use-cases
    required: false
  - artifact: ai-plc-prioritization-ranking
    required: false
  - artifact: ai-plc-prototype-specs
    required: false
  - artifact: ai-plc-prototype-builds
    required: false
  - artifact: ai-plc-product-strategy
    required: true
  - artifact: ai-plc-gtm-plan
    required: true
requires_stage:
  - ai-plc-product-strategy
  - ai-plc-go-to-market
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc-discovery
  - ai-plc-full
  - ai-plc-prototype-build
inputs: Every discovery artifact this run produced - which subset exists depends on the entry point taken
outputs: discovery-document.md (under this stage's record dir, engine-resolved)
---

# Discovery Document Assembly

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Compile everything discovery produced into one comprehensive, self-contained
Discovery Document. This is AI-PLC's handoff artifact: a development team (or
the continuation of this run under the `ai-plc-full` scope) uses it as the
product input to Inception's Requirements Analysis, and it works equally as a
traditional product brief read without any AI tooling.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Inventory the Discovery Record

Read every upstream artifact this run produced. Which subset exists depends
on the entry point: a pain-point run has the analysis and PR/FAQ; a use-case
run has the intake and ranking; a prototype-build run may have only specs,
builds, strategy, and GTM. Missing optional artifacts are expected - note the
path taken, never invent content for stages that did not run.

### Step 3: Assemble the Document

Write `discovery-document.md` in this stage's record dir, containing (a
section per artifact that exists, in this order):

- **Discovery Summary** - product name, date, the entry point and path taken, and a one-paragraph overview
- **Pain Point Analysis** - summary with the key insights, referencing the full analysis
- **PR/FAQ** - the press release and FAQs
- **Solution Analysis** - the identified solutions and determination
- **Use Case Prioritization** - the ranked lists, scores, and selection rationale
- **Prototype Specifications** - one subsection per PROTOTYPE-*.md file: the spec verbatim or a faithful summary with the file's location
- **Prototype Validation** - build outcomes, iteration history, what users validated or rejected, the selected winner
- **Product Strategy** - positioning, differentiation, business model, target market, success metrics
- **Go-to-Market Plan** - marketing, sales, launch, metrics and kill criteria
- **Handoff Notes** - what the receiving team needs: where the spec files live, open questions discovery left unresolved, and the recommendation for what to build first

The document must stand alone: no references to this session's conversation,
and every claim traceable to a discovery artifact.

### Step 4: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-discovery-document --result awaiting-approval`.

### Step 5: Present Completion & Request Approval

Completion emoji: :scroll:
Review path: this stage's engine-resolved record dir.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
artifacts, then report `--result revised` before re-presenting.

After approval, tell the user where the run goes next: under
`ai-plc-discovery` or `ai-plc-prototype-build` the discovery workflow is
complete and the document is ready to hand to a development team; under
`ai-plc-full` the run continues into Inception, where Requirements Analysis
consumes this document directly.

## Sensors

This stage's outputs are markdown artefacts under its record dir. The imported `required-sections` and `upstream-coverage` sensors check those outputs.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions -
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts - the ritual writes into the
harness, not into this file.
