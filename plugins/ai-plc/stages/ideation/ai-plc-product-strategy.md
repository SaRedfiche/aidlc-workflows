---
slug: ai-plc-product-strategy
number: 1.56
name: Product Strategy
plugin: ai-plc
phase: ideation
execution: ALWAYS
condition: Always executes in an AI-PLC run - captures positioning, differentiation, and business model for the selected product bet
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-product-strategy
  - ai-plc-strategy-questions
consumes:
  - artifact: ai-plc-pain-point-analysis
    required: false
  - artifact: ai-plc-prfaq
    required: false
  - artifact: ai-plc-prioritization-ranking
    required: false
  - artifact: ai-plc-prototype-builds
    required: false
  - artifact: ai-plc-validation-results
    required: false
requires_stage: []
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc-discovery
  - ai-plc-prototype-build
inputs: The discovery evidence so far - pain-point analysis and PR/FAQ (pain-point path), prioritization ranking (use-case path), prototype builds and validation notes (when built)
outputs: product-strategy.md, strategy-questions.md (under this stage's record dir, engine-resolved)
---

# Product Strategy

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Capture positioning, differentiation, business model, target market, and
success metrics for the selected use case or solution - grounded in the
discovery evidence (validated pain points, the PR/FAQ, prioritization
scores, and prototype validation feedback when prototypes were built), not
assumptions.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Load Discovery Evidence

Read whichever upstream artifacts this run produced: pain-point analysis and
PR/FAQ, the prioritization ranking, the prototype build log, and the
synthesized validation results. When prototype validation ran, ground
strategy questions in specific findings ("users validated X", "3 of 5 users
requested Y"); when it did not, note that strategy rests on discovery
findings only.

### Step 3: Gather Strategy Inputs

Create `strategy-questions.md` in this stage's record dir covering, via the
standard question format:

- **Positioning** - market position (premium, budget, niche, platform), the one-sentence value proposition, the primary message
- **Differentiation** - top 3 differentiators vs. existing solutions (from the competitive analysis), which is most defensible, the moat
- **Business Model** - revenue model, pricing strategy (informed by willingness-to-pay evidence), key cost drivers, expected gross margin
- **Target Market** - beachhead segment, expansion path, acquisition channels
- **Success Metrics** - primary KPIs for the first 6 months, what product-market fit looks like, leading indicators

Every question MUST offer an intelligent default as option A, drawn from the
discovery evidence, so the PM confirms or overrides rather than writing from
scratch. Analyze answers for ambiguities and follow up until resolved. STOP
for the human response.

### Step 4: Write the Strategy

Write `product-strategy.md` in this stage's record dir, containing:

- **Positioning** - market position, value proposition, primary message
- **Differentiation** - a differentiator/description/defensibility table plus the primary moat
- **Business Model** - revenue model, pricing strategy, cost drivers, expected gross margin
- **Target Market** - beachhead, expansion path, acquisition channels
- **Success Metrics** - a metric/target/leading-indicator table plus the product-market-fit signal

### Step 5: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-product-strategy --result awaiting-approval`.

### Step 6: Present Completion & Request Approval

Completion emoji: :bar_chart:
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
