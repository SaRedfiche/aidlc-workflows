---
slug: build-and-test
phase: construction
execution: ALWAYS
condition: Always executes once after all per-unit stages are finished.
lead_agent: aidlc-quality-agent
support_agents:
  - aidlc-devsecops-agent
mode: inline
produces:
  - build-instructions
  - integration-test-instructions
  - performance-test-instructions
  - security-test-instructions
  - build-and-test-summary
  - build-test-results
  - cross-unit-traceability
consumes:
  - artifact: code-generation-plan
    required: true
  - artifact: unit-test-instructions
    required: true
  - artifact: code-summary
    required: true
requires_stage:
  - code-generation
sensors:
  - required-sections
  - upstream-coverage
  - type-check
scopes:
  - enterprise
  - feature
  - mvp
  - poc
  - bugfix
  - refactor
  - security-patch
  - classic
  - workshop
  - express
inputs: ALL code generation outputs across all units
outputs: build-instructions.md, integration-test-instructions.md, performance-test-instructions.md, security-test-instructions.md, build-and-test-summary.md, test-results.md, cross-unit-traceability.md (under this stage's record dir, engine-resolved)
---

# Build and Test

## Steps

### Step 1: Load Personas

Load aidlc-quality-agent (lead) persona from `agents/aidlc-quality-agent.md` and knowledge from `.aidlc/knowledge/aidlc-quality-agent/`. Load aidlc-devsecops-agent persona from `agents/aidlc-devsecops-agent.md` and knowledge from `.aidlc/knowledge/aidlc-devsecops-agent/` for security testing input. Apply aidlc-quality-agent as the primary perspective with aidlc-devsecops-agent providing security testing expertise.

### Step 2: Analyze Testing Requirements

Read code generation outputs across all units from
`<record>/construction/*/code-generation/code-summary.md` and per-unit test
instructions from
`<record>/construction/*/code-generation/unit-test-instructions.md`. For a
zero-Unit scope such as `express`, read the stage-level equivalents under
`<record>/construction/code-generation/`. Review NFR requirements across units
(if they exist) to identify performance and security testing needs. Catalog all
test types required.

### Step 3: Generate Build Instructions

Create `<record>/construction/build-and-test/build-instructions.md`:
- Dependency installation steps
- Environment setup (env vars, config files, local services)
- Build commands (compile, bundle, transpile)
- Build verification steps
- Troubleshooting common build issues

### Step 4-8: Generate Test Instructions (Strategy-Aware)

Consult the active test strategy from `aidlc-state.md` → `**Test Strategy**` (see stage-protocol.md §8 "Test Strategy"). Generate additional test instruction files based on the strategy level:

**Minimal strategy** — generate no additional test instruction files. Unit
tests are covered per-unit by Code Generation.

**Standard strategy** — generate:
- `integration-test-instructions.md`: Key boundary tests, cross-unit interaction

**Comprehensive strategy** — generate all applicable:
- `integration-test-instructions.md`: Cross-unit interaction, external dependency handling
- `performance-test-instructions.md` (IF NFR performance requirements exist): Load testing, benchmarks, regression detection
- `security-test-instructions.md` (IF NFR security requirements exist): SAST/DAST, auth testing, injection testing
- Additional types as applicable (contract tests, E2E, accessibility) — create specifically named files

All files go in `<record>/construction/build-and-test/`.

Each instruction file should include:
- Test framework setup and configuration
- How to run the tests (commands, flags, filters)
- Expected coverage targets appropriate to the strategy level
- Test data management and environment setup

These are soft guidelines — the LLM can generate additional test types at any strategy level if context demands it (e.g., a Minimal security-patch may still warrant security test instructions).

### Step 9: Generate Build and Test Summary

Create `<record>/construction/build-and-test/build-and-test-summary.md`:
- Overall build status and prerequisites
- Test type inventory (which test types were generated)
- Coverage expectations per unit
- Readiness assessment (build-ready, test-ready, deployment-ready)
- Known limitations or outstanding items

### Step 10: Execute Build and Tests

Attempt to execute the build and test commands documented in the instruction files:

1. **Build**: Run the build commands from `build-instructions.md` via Bash. Capture output.
2. **Unit tests**: Collect the run commands from both the stage-level
   `<record>/construction/code-generation/unit-test-instructions.md` file (when
   present, including Express) and all per-unit
   `<record>/construction/*/code-generation/unit-test-instructions.md` files.
   Deduplicate identical commands and run each distinct command ONCE via Bash.
   Per-unit commands should already be scoped to their Unit. A stage-level or
   malformed per-unit file may carry a project-wide command; run that command
   once, never N times. Capture and report stage-level/per-unit pass/fail
   results without double counting.
3. **Integration tests** (if applicable): Run integration test commands. Capture results.
4. **Report results**: Create or update `<record>/construction/build-and-test/test-results.md` with:
   - Build status (success/failure + output)
   - Test results (total, passed, failed, skipped)
   - Failure details (test name, assertion, stack trace)
   - Coverage report (if test framework supports it)

**On failure**: If build or tests fail, attempt to diagnose and fix the issue:
- Read the error output
- Identify the failing code
- Apply the fix
- Re-run the failing step
- If unable to fix after 2 attempts, log the failure in test-results.md and present the issue to the user at the approval gate

**On success**: Update the Build and Test Summary with actual results (not just instructions).

### Step 11: Cross-Unit Final Coverage Gate

This is a stage-level gate, not the Construction phase boundary. Enumerate:

- every `FR` and `NFR` from
  `<record>/inception/requirements-analysis/requirements.md`
- every three-segment `AC` from
  `<record>/inception/user-stories/stories.md` when that stage executed

Read both the stage-level
`<record>/construction/code-generation/traceability.json` file (when present,
including Express) and every per-unit
`<record>/construction/*/code-generation/traceability.json` file. Verify each
enumerated ID is covered with status `OK` in at least one stage-level or Unit
entry and that its target file exists. Write
`<record>/construction/build-and-test/cross-unit-traceability.md` with a
pass/fail verdict, per-ID coverage, owning stage/Unit, target file, and every
uncovered element. Any uncovered ID is a build-and-test finding that must be
surfaced at the approval gate.

### Step 12: Completion Handoff

Hand completion to `stage-protocol.md` via
`bun .aidlc/tools/aidlc-orchestrate.ts report --stage build-and-test --result <outcome>`.
That `report` call owns every lifecycle transition and advancement; never perform one in prose, and never narrate this bookkeeping to the user.

### Step 13: Completion

Present completion message and approval gate:

```
# :hammer: Build and Test Complete
```

Summary of all test instruction sets generated, readiness assessment, then:

```
**Review:** `<record>/construction/build-and-test/`
```

Approval gate: strictly 2-option (Approve / Request Changes).

## Sensors

This stage produces test-instruction markdown files under
`<record>/construction/build-and-test/` and runs the project's build
and test commands as part of execution. The instruction artefacts are
the agent-authored outputs the markdown-shape sensors check; the build
itself emits exit codes and a results report.

Imports: `required-sections`, `upstream-coverage`, `type-check`.

Upstream targets: `code-generation-plan`, `unit-test-instructions`, `code-summary`.

`type-check` inspects matching TypeScript/TSX code touched during test
generation.

`linter` is intentionally NOT imported. The canonical lint runs in the build
pipeline this stage drives, so importing it would duplicate findings; the
build exit code remains the authoritative signal.

## Learn

Follow stage-protocol.md §13: maintain `<record>/<phase>/<stage>/memory.md`
under the four standard headings while working; before the approval gate,
surface candidates with `aidlc-learnings.ts`;
still ask the mandatory "Anything to add for next time?" question, and persist confirmed selections
with the tool. The memory file stays in the artefact directory, and the stage
file remains immutable.
