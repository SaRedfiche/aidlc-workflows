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
  - ai-plc-validation-results
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
outputs: prototype-builds.md build log, validation-results.md, plus one runnable prototype directory per spec (under this stage's record dir, engine-resolved)
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
3. **Agentic use cases: always ask the LLM provider** (never assume), offering the providers the team can actually use. Then confirm credentials are configured as environment variables. NEVER ask the user to paste an API key into chat; if one appears in chat, tell the user to revoke and regenerate it, and never write credential values into any artifact - record only "credentials configured: yes/no". Check only that the variables exist; never read, display, or echo their values.
4. If an agent SDK or framework is needed and unavailable in the environment, offer a mock fallback: build the frontend with hardcoded mock responses and mark the build "UI Prototype - Agent Mocked" in the build log. When installing for real, use an isolated project environment (e.g. a Python venv - never the system interpreter) with pinned dependency versions from the standard public registry, and no root or sudo.

STOP for the human response at each configuration gate.

Security posture for every build (methodology rules, not optional):

- **Credential isolation** - the prototype's process gets only the selected provider's credential environment variables, never the full shell environment.
- **Localhost only, no tunneling** - prototypes have no authentication and hold provider credentials; never expose them via ngrok, localtunnel, or any public binding.
- **Never embed credentials in generated code** - configuration comes from the environment at runtime.

### Step 4: Build and Validate Each Prototype

Build per the confirmed configuration, run it locally, and hand it to the
user to try. Iterate on their feedback (log each iteration). Append per
prototype to `prototype-builds.md` in this stage's record dir:

- **Build Summary** - what was built, stack, agentic or mocked
- **Run Instructions** - how to start it, the local URL
- **Iteration Log** - each user-requested change and its outcome
- **Validation Notes** - what the user validated or rejected, feeding product strategy

### Step 5: Validate with Users

Offer structured validation before the build decision (the user may decline
for a quick informal pass). When taken:

1. Agree the validation plan as a structured question: feedback method (interviews and demos, survey, shared link, or a combination), user count (3-5 suggested), and timeline - or "feedback ready now" to skip straight to synthesis.
2. STOP and wait (possibly across sessions) for the user to return with feedback: pasted text, imported files, or verbal description.
3. Synthesize into `validation-results.md` in this stage's record dir:
   - **Feedback Sources** - who and how many
   - **Theme Analysis** - per theme: frequency ("X of Y users"), severity, a representative quote
   - **Feature Validation** - validated / partially validated / not tested per feature
   - **Pain Point Mapping** - each original pain point vs. Yes/Partial/No/Not tested, with evidence
   - **Unmet Needs Discovered** - each with a recommended action (add to Inception scope, defer, or ignore)
   - **Key Insights**
4. Present the synthesis for confirmation. STOP for the human response.

### Step 6: Build Decision

Recommend one of PROCEED / ITERATE / PIVOT / KILL with rationale grounded in
the evidence (pain points validated X of Y, supporting signal, risk, unmet
needs). The PM decides; the AI never decides for them. Record the decision
and rationale in `prototype-builds.md`. STOP for the human response.

- **Proceed** - when multiple prototypes were built, ask which carries forward into Product Strategy; record the selection and rationale.
- **Iterate** - return to Step 4's iteration loop, then re-validate.
- **Pivot** - the validated feedback becomes new input: report this stage rejected and recommend re-running discovery from `ai-plc-envision` with the validation results as context.
- **Kill** - record the decision and evidence; the artifacts remain as the record of a cheap invalidation (that is discovery succeeding, not failing). Product strategy and GTM for this bet are moot; say so at the gate.

### Step 7: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-prototype-building --result awaiting-approval`.

### Step 8: Present Completion & Request Approval

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
