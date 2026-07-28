---
slug: ai-plc-go-to-market
number: 1.57
name: Go-to-Market
plugin: ai-plc
phase: ideation
execution: ALWAYS
condition: Always executes in an AI-PLC run - turns the product strategy into marketing, sales, and launch plans
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-gtm-plan
  - ai-plc-gtm-questions
consumes:
  - artifact: ai-plc-product-strategy
    required: true
requires_stage:
  - ai-plc-product-strategy
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc-discovery
  - ai-plc-full
  - ai-plc-prototype-build
inputs: The approved product strategy from ai-plc-product-strategy
outputs: gtm-plan.md, gtm-questions.md (under this stage's record dir, engine-resolved)
---

# Go-to-Market

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Turn the approved product strategy into a go-to-market plan: marketing
strategy, sales approach, launch planning, and the success metrics and kill
criteria that will govern the launch.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Load the Strategy

Read `ai-plc-product-strategy` from its record dir. The beachhead market,
positioning, and pricing decisions there anchor every GTM question below.

### Step 3: Gather GTM Inputs

Create `gtm-questions.md` in this stage's record dir covering, via the
standard question format:

- **Marketing Strategy** - primary channel for the beachhead market, messaging framework (tagline, elevator pitch, key messages), launch assets needed, pre-launch awareness strategy
- **Sales Approach** - sales model (self-serve, inside sales, field sales, partner, PLG), expected cycle length, key objections and responses, enablement materials
- **Launch Planning** - target date, launch strategy (big bang, soft launch, beta, phased), milestones and dependencies, MVP scope vs. post-launch roadmap
- **Success Metrics and Monitoring** - 30/60/90-day success criteria, day-one metrics, feedback collection mechanism, kill criteria (conditions to pivot or stop)

Every question MUST offer an intelligent default as option A, drawn from the
strategy and discovery evidence. Analyze answers for ambiguities and follow
up until resolved. STOP for the human response.

### Step 4: Write the GTM Plan

Write `gtm-plan.md` in this stage's record dir, containing:

- **Marketing Strategy** - primary channel, messaging framework, pre-launch strategy, launch assets
- **Sales Approach** - sales model, expected cycle, an objection/response table, enablement materials
- **Launch Plan** - target date, launch strategy, MVP scope, post-launch roadmap, a milestone/date/dependencies table
- **Success Metrics and Monitoring** - 30/60/90-day criteria, day-one metrics, feedback collection, kill criteria

### Step 5: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-go-to-market --result awaiting-approval`.

### Step 6: Present Completion & Request Approval

Completion emoji: :rocket:
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
