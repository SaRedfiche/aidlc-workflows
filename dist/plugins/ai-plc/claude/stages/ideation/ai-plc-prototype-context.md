---
slug: ai-plc-prototype-context
number: 1.54
name: Prototype Context Generation
plugin: ai-plc
phase: ideation
execution: CONDITIONAL
condition: Execute once use cases are selected for prototyping (from prioritization, or a single solution from solution analysis). Skip when PROTOTYPE-*.md specifications already exist in the workspace.
lead_agent: ai-plc-product-strategist-agent
support_agents: []
mode: inline
produces:
  - ai-plc-prototype-specs
  - ai-plc-prototype-context-questions
consumes:
  - artifact: ai-plc-prioritization-ranking
    required: false
  - artifact: ai-plc-identified-solutions
    required: false
requires_stage: []
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - ai-plc-discovery
inputs: The selected use cases (from ai-plc-use-case-prioritization's ranking, or the single solution from ai-plc-solution-analysis)
outputs: prototypes/<use-case-slug>/PROTOTYPE-<use-case-slug>.md per selected use case, prototype-context-questions.md (under this stage's record dir, engine-resolved)
---

# Prototype Context Generation

MANDATORY: Follow stage-protocol.md for approval gates, question format, and completion messages.

For each selected use case, gather design and technical context and generate
a self-contained `PROTOTYPE-<use-case-slug>.md` specification. These files
are the portable handoff artifact of AI-PLC discovery: usable to build
prototypes in this run, shareable with other teams for parallel builds under
the `ai-plc-prototype-build` scope, or resumable in a future session.

## Steps

### Step 1: Load Agent Personas

Load ai-plc-product-strategist-agent persona from `agents/ai-plc-product-strategist-agent.md` and knowledge from `{{HARNESS_DIR}}/knowledge/ai-plc-product-strategist-agent/`.

### Step 2: Identify the Selected Use Cases

Read the selection: the confirmed top use cases from
`ai-plc-prioritization-ranking` when prioritization ran, else the single
solution from `ai-plc-identified-solutions`. Announce the list and that each
gets its own specification file.

### Step 3: Gather Context Per Use Case

Create `prototype-context-questions.md` in this stage's record dir. For each
selected use case, gather via the standard question format:

1. **Brand and design context** - the company or product website URL for brand matching, or a described brand style, or a generic modern design
2. **Device target** - mobile, desktop, or responsive
3. **Tools** (agentic use cases) - 1-2 simple demonstration tools (FAQ lookup, database query, API call, file search, calculation)
4. **Key screens** (application use cases) - 2-3 main screens (dashboard, list, detail, form, settings)
5. **Sample interactions** (agentic) - 2-3 example user-agent exchanges

### Step 4: Generate the Specification Files

For each use case, derive the slug from the name (lowercase letters, numbers,
and hyphens only; strip everything else; reject any slug containing path
separators or `..`) and write
`prototypes/<use-case-slug>/PROTOTYPE-<use-case-slug>.md` under this stage's
record dir, containing:

- **Use Case Overview** - problem statement, target users, business value, success criteria
- **Agent Requirements** (agentic) - purpose, LLM configuration, conversation style; or **Application Requirements** (application) - core features
- **Tools** (agentic) - per tool: name, purpose, inputs, outputs, sample data
- **Frontend Requirements** - device target, key screens, user flow, UI components
- **Design Context** - brand reference, style guidelines, design notes
- **Sample Interactions** - the gathered example exchanges
- **Deployment Instructions** - how to run the prototype locally

Each file must stand alone for a team that was not in the room: no references
to this session's conversation.

### Step 5: Present the Handoff Decision

Present a structured question: (A) build the prototypes now in this session
(`ai-plc-prototype-building` executes next), (B) stop here and hand the
specification files to other teams (prototype building is skipped; the run
continues to product strategy), or (C) build only specific ones (name which).
STOP for the human response.

### Step 6: Completion Handoff

Run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts report --stage ai-plc-prototype-context --result awaiting-approval`.

### Step 7: Present Completion & Request Approval

Completion emoji: :package:
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
