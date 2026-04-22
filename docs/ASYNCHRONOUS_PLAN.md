# Asynchronous AIDLC Team Collaboration Plan

This document describes how to run the AI-DLC (AI-Driven Development Life Cycle) workflow with pull-request-based phase gate approvals and commit-driven status updates, enabling distributed teams to collaborate asynchronously.

---

## Table of Contents

- [Overview](#overview)
- [Branching Strategy](#branching-strategy)
- [Commit-on-Change (Async Visibility)](#commit-on-change-async-visibility)
- [PR-Based Phase Gate Approvals](#pr-based-phase-gate-approvals)
  - [Inception Phase PRs](#inception-phase-prs)
  - [Construction Phase PRs (Per Unit)](#construction-phase-prs-per-unit)
  - [PR Requirements](#pr-requirements)
- [Status Updates as Commits](#status-updates-as-commits)
- [Question Files for Async Input](#question-files-for-async-input)
- [Session Continuity Across Team Members](#session-continuity-across-team-members)
- [Prompt Template](#prompt-template)

---

## Overview

AIDLC already defines explicit approval gates at each stage — points where the workflow pauses and waits for human confirmation before proceeding. This plan maps each approval gate to a **pull request**, so that:

- **PR approval = AIDLC stage approval.** Merging a PR is equivalent to choosing "Approve and Continue" at an AIDLC gate. Requesting changes on a PR is equivalent to AIDLC's "Request Changes" option.
- **Every meaningful change is committed and pushed**, giving remote team members continuous visibility into progress without synchronous meetings.
- **Question files** (AIDLC's structured multiple-choice input mechanism) are committed to branches so team members can answer asynchronously by editing and pushing.

---

## Branching Strategy

Use the following branch structure, mapped to AIDLC phases and stages:

```
main                                  # Approved, baseline artifacts only
aidlc/inception                       # All Inception phase work
aidlc/construction/{unit-name}        # Per-unit Construction work
aidlc/build-and-test                  # Build and Test stage work
```

All AIDLC artifact generation happens on feature branches. Artifacts reach `main` only through approved PRs.

---

## Commit-on-Change (Async Visibility)

After completing any of the following, immediately commit and push to the current working branch:

- Generating or updating any file in `aidlc-docs/`
- Updating `aidlc-state.md` or `audit.md`
- Answering or generating question files (e.g., `requirement-verification-questions.md`)
- Completing a code generation plan step (checkbox update)

### Commit Message Convention

Use descriptive commit messages that reference the AIDLC stage:

```
aidlc(inception/requirements): generate requirements.md and verification questions
aidlc(inception/user-stories): complete persona definitions and story mapping
aidlc(construction/api-service/functional-design): complete business-rules.md
aidlc(construction/api-service/code-generation): implement authentication module [3/7]
aidlc(build-and-test): generate integration test instructions
aidlc(status): update aidlc-state.md with inception phase progress
```

This ensures remote team members can see progress by pulling the branch — no separate status document or synchronous meeting is needed.

---

## PR-Based Phase Gate Approvals

At each AIDLC approval gate — the point where the workflow says "Wait for Explicit Approval" — create a pull request instead of approving inline in the chat session.

### Inception Phase PRs

| AIDLC Stage | PR: source -> target | Suggested Reviewers |
|---|---|---|
| Reverse Engineering | `aidlc/inception` -> `main` | Tech Lead, Architect |
| Requirements Analysis | `aidlc/inception` -> `main` | Product Owner, Tech Lead |
| User Stories | `aidlc/inception` -> `main` | Product Owner, QA Lead |
| Workflow Planning | `aidlc/inception` -> `main` | Tech Lead, Product Owner |
| Application Design | `aidlc/inception` -> `main` | Architect, Tech Lead |
| Units Generation | `aidlc/inception` -> `main` | Architect, Tech Lead |

### Construction Phase PRs (Per Unit)

| AIDLC Stage | PR: source -> target | Suggested Reviewers |
|---|---|---|
| Functional Design | `aidlc/construction/{unit}` -> `main` | Tech Lead, Domain Expert |
| NFR Requirements | `aidlc/construction/{unit}` -> `main` | Architect, SRE Lead |
| NFR Design | `aidlc/construction/{unit}` -> `main` | Architect, SRE Lead |
| Infrastructure Design | `aidlc/construction/{unit}` -> `main` | Cloud Architect, SRE Lead |
| Code Generation | `aidlc/construction/{unit}` -> `main` | Tech Lead, Senior Dev |
| Build and Test | `aidlc/build-and-test` -> `main` | QA Lead, Tech Lead |

### PR Requirements

Each PR must include:

1. **Summary** — list the artifacts generated or updated in `aidlc-docs/`
2. **State reference** — link to the relevant section of `aidlc-state.md` showing stage status
3. **Completion message** — the AIDLC stage completion message as the PR description body
4. **Labels** — `aidlc-gate` plus the phase name (e.g., `aidlc-gate:inception`, `aidlc-gate:construction`)

### Approval and Change Request Flow

- **Do NOT proceed to the next AIDLC stage until the PR is approved and merged.**
- If reviewers request changes, address them in the same branch and re-request review. This maps directly to AIDLC's "Request Changes" option.
- Once the PR is approved and merged, the next AIDLC stage can begin on the working branch (rebased on the updated `main`).

---

## Status Updates as Commits

When providing status updates to the team:

1. Update `aidlc-state.md` with current progress (checkboxes, stage status)
2. Commit and push with message: `aidlc(status): {brief description of progress}`
3. The team reads status by pulling the branch — no separate status report needed

The combination of `aidlc-state.md` (current stage progress), `audit.md` (full decision history), and the Git log provides a complete picture of project status at any point in time.

---

## Question Files for Async Input

AIDLC generates structured question files with `[Answer]:` tags (e.g., `requirement-verification-questions.md`). To handle these asynchronously:

1. The agent generates the question file and commits/pushes it to the working branch
2. Notify the team (via PR comment, Slack, or team channel) that input is needed
3. Team members answer by editing the file directly and pushing commits to the branch
4. Once all `[Answer]:` fields are filled, any team member can resume the AIDLC workflow by telling the agent: "We have answered your clarification questions. Please re-read the file and proceed."

This preserves AIDLC's question-file-based interaction model while enabling input from team members who are not in the same session.

---

## Session Continuity Across Team Members

Any team member can pick up and resume the workflow. AIDLC already supports session continuity through its state files:

1. Pull the latest branch
2. Read `aidlc-state.md` to identify the current phase, stage, and next step
3. Read `audit.md` for context on prior decisions and approvals
4. Resume from the first unchecked item in the relevant plan file

### Resume Prompt

Use this prompt when resuming in a new session:

```
Go to aidlc-docs/aidlc-state.md, find the first unchecked item,
then go to the corresponding plan file and resume from that point.
```

Or for a manual handoff:

```
I am resuming a previously stopped conversation. Here is the context:
[paste summary of last output or recent change]
Please continue with [next action or section].
```

---

## Prompt Template

The following prompt can be used to instruct the AI agent to follow this asynchronous collaboration plan. Customize the reviewer roles, branch names, and document paths to match your team.

```
You are a principal technical product manager guiding a distributed team through
the AI-DLC workflow. Your goal is to orchestrate the AIDLC process so that every
phase gate becomes a pull request that stakeholders review and approve
asynchronously, and every meaningful status change is committed and pushed so the
team has a shared, always-current view of progress.

## Branching Strategy

Use the following branch structure mapped to AIDLC phases and stages:

- `main` — approved, baseline artifacts only
- `aidlc/inception` — all Inception phase work
- `aidlc/construction/{unit-name}` — per-unit Construction work
- `aidlc/build-and-test` — Build and Test stage work

## Workflow Rules

### 1. Commit-on-Change (Async Visibility)
After completing any of the following, immediately commit and push to the
current working branch:
- Generating or updating any file in `aidlc-docs/`
- Updating `aidlc-state.md` or `audit.md`
- Answering or generating question files
- Completing a code generation plan step (checkbox update)

Use descriptive commit messages that reference the AIDLC stage:
  `aidlc(inception/requirements): generate requirements.md and verification questions`
  `aidlc(construction/api-service/functional-design): complete business-rules.md`

### 2. PR-Based Phase Gate Approvals
At each AIDLC approval gate — the point where the workflow says "Wait for Explicit
Approval" — create a pull request instead of approving inline.

PR approval = AIDLC stage approval. Do NOT proceed to the next stage until the PR
is approved and merged. If reviewers request changes, address them in the same
branch and re-request review.

Each PR must include:
- A summary of artifacts produced in `aidlc-docs/`
- A link to the relevant section of `aidlc-state.md`
- The AIDLC stage completion message as the PR description
- Label: `aidlc-gate` plus the phase name

### 3. Status Updates as Commits
Update `aidlc-state.md` with current progress and commit with message:
  `aidlc(status): {brief description}`

### 4. Question Files for Async Input
When AIDLC generates question files:
1. Commit and push the question file
2. Notify the team that input is needed
3. Team members answer by editing the file and pushing to the branch
4. Once all [Answer]: fields are filled, resume the workflow

### 5. Session Continuity
Any team member can resume by pulling the branch and reading aidlc-state.md.
The audit.md provides full decision history. Resume from the first unchecked
item in the relevant plan file.

## Starting the Workflow
Begin by reading the vision document at [path/to/vision.md] and technical
environment document at [path/to/tech-env.md], then start the AIDLC workflow.
Create the `aidlc/inception` branch and begin with Workspace Detection. Commit
and push after each stage completes, and create a PR at each approval gate.
```

---

## References

- [AI-DLC Core Workflow](aidlc-rules/aws-aidlc-rules/core-workflow.md) — the full AIDLC workflow definition
- [Working with AIDLC](docs/WORKING-WITH-AIDLC.md) — interaction patterns and tips
- [Generated Docs Reference](docs/GENERATED_DOCS_REFERENCE.md) — complete list of artifacts produced by the workflow
- [Writing Inputs Quick Start](docs/writing-inputs/inputs-quickstart.md) — how to prepare vision and technical environment documents
