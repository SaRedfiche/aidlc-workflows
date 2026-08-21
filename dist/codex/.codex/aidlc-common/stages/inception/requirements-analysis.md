---
slug: requirements-analysis
phase: inception
execution: ALWAYS
condition: Always executes — depth scales with project complexity
lead_agent: aidlc-product-agent
support_agents: []
mode: inline
summary_confirmation: required
reviewer: aidlc-product-lead-agent
reviewer_max_iterations: 2
review_class: advisory
produces:
  - requirements
  - requirements-analysis-questions
consumes:
  - artifact: intent-statement
    required: false
  - artifact: scope-document
    required: false
  - artifact: business-overview
    required: false
    conditional_on: brownfield
  - artifact: architecture
    required: false
    conditional_on: brownfield
  - artifact: code-structure
    required: false
    conditional_on: brownfield
  - artifact: team-practices
    required: false
requires_stage:
  - approval-handoff
  - reverse-engineering
sensors:
  - required-sections
  - upstream-coverage
scopes:
  - enterprise
  - feature
  - mvp
  - poc
  - bugfix
  - refactor
  - infra
  - security-patch
  - classic
  - workshop
  - express
inputs: RE artifacts (if brownfield), user's project description (from <record>/audit/<host>-<clone>.md)
outputs: requirements.md, requirements-analysis-questions.md (under this stage's record dir, engine-resolved)
---

# Requirements Analysis

## Steps

### Step 1: Load Agent Personas

Load aidlc-product-agent persona from `agents/aidlc-product-agent.md` and knowledge from `.codex/knowledge/aidlc-product-agent/`.

### Step 2: Load Prior Context

- If brownfield: Read RE artifacts from `aidlc/spaces/<active-space>/codekb/<repo>/` (the directory `codekb-path --repo <repo>` prints)
- Read user's project description from `<record>/audit/<host>-<clone>.md`

### Step 3: Analyze User Request

Assess the user's request for:
- **Clarity**: How well-defined is the request?
- **Type**: New feature, enhancement, refactoring, bug fix, migration
- **Scope**: Single component, multi-component, system-wide
- **Complexity**: Simple, standard, complex

### Step 4: Determine Depth

Based on complexity assessment:
- **Minimal**: Clear request, narrow scope, well-understood domain
- **Standard**: Moderate scope, some unknowns, multiple stakeholders
- **Comprehensive**: Large scope, significant unknowns, complex domain

### Step 5: Assess Current Requirements

Extract and organize what is already known from the user's input:
- Explicit functional requirements
- Implied non-functional requirements
- Constraints and assumptions
- Business context and goals

### Step 6: Completeness Analysis

Evaluate coverage across six dimensions:
1. **Functional requirements** — Core behaviors, features, use cases
2. **Non-functional requirements** - Performance, security, scalability, reliability, observability
3. **User scenarios** — User workflows, edge cases, error scenarios
4. **Business context** — Goals, success metrics, stakeholders, constraints
5. **Technical context** — Integration points, platform requirements, technology constraints
6. **Quality attributes** — Maintainability, testability, accessibility, usability

Identify gaps in each dimension.

### Step 7: Generate Clarifying Questions

PROACTIVE: Always generate clarifying questions unless requirements are exceptionally clear and complete across all six dimensions.

Create `<record>/inception/requirements-analysis/requirements-analysis-questions.md` using the [Answer]: tag format from stage-protocol.md. Include context-appropriate questions with A-E options. Every ordinary clarifying question MUST end with `X. Other (please specify)` as the final option; the later Consolidated Summary Confirmation is the unlettered exception. Leave all [Answer]: tags blank.

Then follow the unified question flow from stage-protocol.md section 3: offer the user a choice between guided (interactive) and self-guided (file edit) modes. In either case, ensure all answers are written to the file before proceeding.

### Step 8: Collect and Analyze Answers

After all answers are collected:
1. Read `<record>/inception/requirements-analysis/requirements-analysis-questions.md`
2. Confirm ALL `[Answer]:` tags are filled in. If any are blank, present the unanswered questions as structured questions and write answers back. Do NOT proceed with partial answers.
3. Then proceed with ambiguity detection and contradiction analysis on the full answer set.

- MANDATORY ambiguity detection: scan ALL responses for vague language ("mix of", "not sure", "depends", "probably", "maybe")
- Check for contradictions between answers
- Identify missing details needed for requirements generation

### Step 9: Follow-Up Questions

If ANY ambiguity, vagueness, or contradictions found in Step 8:
- Create follow-up questions targeting the specific ambiguities
- Resolve all ambiguities before proceeding
- When in doubt, ask. Incomplete answers lead to poor designs.

### Step 10: Confirm the Consolidated Summary

MANDATORY PRE-GENERATION STOP: After every original and follow-up answer is
filled, append or update a `## Consolidated Summary Confirmation` entry in
`<record>/inception/requirements-analysis/requirements-analysis-questions.md`.
The entry MUST contain:

- An unordered bullet list summarizing every answer (never number these summary
  items; the following structured question starts its own response keys at 1)
- `Does this all look correct before I generate the requirements artifact?`
- `Looks correct` and `Request changes` options
- A blank `[Answer]:` tag

Present that prompt as a structured question using the
`Looks correct` / `Request changes` options from `stage-protocol.md`, then end
the turn and wait for the user's response. Use the checkpoint-specific
`aidlc-log.ts decision` / `answer` commands from that protocol, including this
questions-file path; fill the confirmation `[Answer]:` before recording the
answer receipt. If the user requests changes, ask **"What should change?"** and
end the turn again. Do not update any answer until the user supplies that
feedback. Then record the feedback, update the affected answers, reset the
confirmation `[Answer]:` to blank, and repeat this step. Do NOT create
`requirements.md` until the confirmation entry contains the user's explicit
`Looks correct` answer and the receipt command succeeds.

### Step 11: Generate Requirements

Create `<record>/inception/requirements-analysis/requirements.md` containing:
- **Intent analysis** — What the user is trying to achieve (goals, not just features)
- **Functional requirements** — Organized by feature area or domain. Give every requirement a stable `FR{n}` ID (for example `FR1`) and every sub-requirement an `FR{n}.{m}` ID (for example `FR1.2`).
- **Non-functional requirements** — Performance, security, scalability, reliability, and observability targets. Give every requirement a stable `NFR{n}` ID (for example `NFR3`).
- **Constraints** — Technical, business, and organizational constraints
- **Assumptions** — Documented assumptions with rationale
- **Out of scope** — Explicitly excluded items
- **Open questions** — Any remaining uncertainties for later stages

These IDs are permanent traceability keys. Downstream stages must preserve
them exactly rather than renumbering or replacing them with prose references.

### Step 12: Completion Handoff

Hand completion to `stage-protocol.md` via
`bun .codex/tools/aidlc-orchestrate.ts report --stage requirements-analysis --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 13: Present Completion & Request Approval

Use stage-protocol.md completion template with completion emoji: :mag:
- Summary of requirements produced
- Review path: `<record>/inception/requirements-analysis/`
IF User Stories is set to SKIP in the execution state:
```question
prompt: "Requirements Analysis complete. How would you like to proceed?"
header: Approval
multiSelect: false
options:
  - label: Approve
    description: Continue to [next stage]
  - label: Request Changes
    description: Provide revision feedback
  - label: Add User Stories
    description: Include User Stories stage (currently skipped)
```
Render `[next stage]` verbatim from the run-stage directive's `next_stage`
field (per the stage-protocol.md approval-gate binding), or `Complete workflow`
when it is null. Never guess the next stage name.
If "Add User Stories" is selected, run
`bun .codex/tools/aidlc-utility.ts recompose --add user-stories`
before re-entering the approval flow.

IF User Stories is NOT set to SKIP: use standard 2-option approval (Approve / Request Changes).

## Sensors

This stage's outputs are markdown artefacts under `<record>/inception/requirements-analysis/`.

Imports: `required-sections`, `upstream-coverage`.

Upstream targets: `intent-statement`, `scope-document`, `business-overview`, `architecture`, `code-structure`, `team-practices`.

## Learn

Follow stage-protocol.md §13: maintain `<record>/<phase>/<stage>/memory.md`
under the four standard headings while working; before the approval gate,
surface candidates with `aidlc-learnings.ts`;
still ask the mandatory "Anything to add for next time?" question, and persist confirmed selections
with the tool. The memory file stays in the artefact directory, and the stage
file remains immutable.
