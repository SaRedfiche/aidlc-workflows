---
slug: ai-plc-use-case-intake
number: 1.52
name: Use Case Intake
plugin: ai-plc
phase: ideation
execution: CONDITIONAL
condition: Execute when discovery starts from a prepared use-case list, or when ai-plc-solution-analysis identified multiple solutions to prioritize. Skip when a single solution is already selected or when building from existing PROTOTYPE-*.md specifications.
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-use-cases
  - ai-plc-use-case-intake-questions
consumes:
  - artifact: ai-plc-identified-solutions
    required: false
requires_stage: []
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc
inputs: The user's use-case list (any format), or the identified solutions from ai-plc-solution-analysis
outputs: use-cases.md, use-case-intake-questions.md (under this stage's record dir, engine-resolved)
---

# Use Case Intake

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

Gather and document every candidate use case for prioritization. Two ways in:
the user starts discovery with a use-case list (the use-case entry point), or
`ai-plc-solution-analysis` extracted multiple solutions from a PR/FAQ and the
user chose to prioritize them - in that case seed the intake from the
`ai-plc-identified-solutions` artifact and confirm rather than re-elicit.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Gather Use Cases

Create `use-case-intake-questions.md` in this stage's record dir. Ask how
many use cases the user has, then gather for each (accepting structured
answers, a bulk paste, a table, or conversational description - parse and
confirm whatever arrives):

1. Use case name
2. Brief description (what problem does it solve?)
3. Target users or personas
4. Business value (High/Medium/Low)
5. Technical complexity (High/Medium/Low)
6. Type (Agentic or Application)
7. Key capabilities needed (2-3)
8. Constraints or dependencies

When seeded from `ai-plc-identified-solutions`, prefill each entry from that
artifact and ask only for the missing fields.

### Step 3: Confirm the Captured Set

Present the parsed use cases (name, type, one-line summary each) and the
agentic/application split as a structured question: correct and complete, or
needs additions or edits. Iterate until confirmed. STOP for the human
response.

### Step 4: Document the Use Cases

Write `use-cases.md` in this stage's record dir, containing:

- **Intake Summary** - total count, source (direct input or PR/FAQ solutions), agentic/application split
- **Agentic Use Cases** - per use case: description, target users, business value, technical complexity, key capabilities, constraints
- **Application Use Cases** - same structure
- **Next Steps** - proceed to prioritization

### Step 5: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-use-case-intake --result awaiting-approval`.

### Step 6: Present Completion & Request Approval

Completion emoji: :inbox_tray:
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
