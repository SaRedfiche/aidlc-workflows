---
slug: ai-plc-prototype-building
number: 1.55
name: Prototype Building
plugin: ai-plc
phase: ideation
execution: CONDITIONAL
condition: Execute when PROTOTYPE-*.md specifications exist and the user chose to build prototypes in this run (or the run started from existing specs under the ai-plc-prototype-build scope). Skip when the user hands the specification files off instead.
lead_agent: aidlc-developer-agent
support_agents:
  - ai-plc-product-strategist-agent
mode: inline
produces:
  - ai-plc-prototype-builds
consumes:
  - artifact: ai-plc-prototype-specs
    required: false
requires_stage: []
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc-discovery
  - ai-plc-full
  - ai-plc-prototype-build
inputs: PROTOTYPE-*.md specification files (from ai-plc-prototype-context, or pre-existing in the workspace)
outputs: prototype-builds.md build log plus one runnable prototype directory per spec (under this stage's record dir, engine-resolved)
---

# Prototype Building

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Build a working, locally runnable prototype from each PROTOTYPE-*.md
specification. Prototypes are throwaway validation vehicles for the product
decision, not production code: no authentication, localhost only, smallest
thing that lets a human feel the product.

## Steps

### Step 1: Load Agent Personas

Load aidlc-developer-agent persona from `agents/aidlc-developer-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/aidlc-developer-agent/`.
Load ai-plc-product-strategist-agent support persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Identify the Specifications

Locate the PROTOTYPE-*.md files: from the `ai-plc-prototype-context` record
dir when that stage ran, otherwise wherever the user placed them in the
workspace (the `ai-plc-prototype-build` scope's entry case). List what was
found and confirm the build set with the user.

### Step 3: Configure Each Prototype

For each specification, in order:

1. Read the spec and extract use case, type (Agentic/Application), tools or screens, brand reference, device target.
2. Present a configuration summary as a structured question: what the spec provides, and defaults for everything missing (LLM model, port - increment from 3000 per prototype, generic modern design, responsive). The user proceeds or adjusts.
3. **Agentic use cases: always ask the LLM provider** (never assume), offering the providers the team can actually use. Then confirm credentials are configured as environment variables. NEVER ask the user to paste an API key into chat; if one appears in chat, tell the user to revoke and regenerate it, and never write credential values into any artifact - record only "credentials configured: yes/no".
4. If an agent SDK or framework is needed and unavailable in the environment, offer a mock fallback: build the frontend with hardcoded mock responses and mark the build "UI Prototype - Agent Mocked" in the build log.

STOP for the human response at each configuration gate.

### Step 4: Build and Validate Each Prototype

Build per the confirmed configuration, run it locally, and hand it to the
user to try. Iterate on their feedback (log each iteration). Append per
prototype to `prototype-builds.md` in this stage's record dir:

- **Build Summary** - what was built, stack, agentic or mocked
- **Run Instructions** - how to start it, the local URL
- **Iteration Log** - each user-requested change and its outcome
- **Validation Notes** - what the user validated or rejected, feeding product strategy

### Step 5: Select the Winner

When multiple prototypes were built, present a structured question asking
which prototype should carry forward into Product Strategy. Record the
selection and rationale in `prototype-builds.md`. STOP for the human
response.

### Step 6: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-prototype-building --result awaiting-approval`.

### Step 7: Present Completion & Request Approval

Completion emoji: :hammer_and_wrench:
Review path: this stage's engine-resolved record dir.
Standard 2-option approval (Approve / Request Changes).
STOP for the human response. Report Approve with
`--result approved --user-input "<exact choice>"`; report
Request Changes with `--result rejected --user-input "<feedback>"`, revise the
artifacts, then report `--result revised` before re-presenting.

## Sensors

This stage's outputs include the markdown build log under its record dir. The imported `required-sections` and `upstream-coverage` sensors check that log.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions -
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts - the ritual writes into the
harness, not into this file.
