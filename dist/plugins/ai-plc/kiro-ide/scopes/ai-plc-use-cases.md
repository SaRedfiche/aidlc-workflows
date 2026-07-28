---
name: ai-plc-use-cases
plugin: ai-plc
depth: Standard
keywords:
  - use cases
  - use case prioritization
  - prioritize use cases
description: AI-PLC entry point 2 baked in - start from a prepared use-case list (Intake -> Prioritization), through discovery, the Discovery Document, and onward into core Inception when the run continues
skeleton: on
runner: true
---

# ai-plc-use-cases scope

The AI-PLC use-case entry point (entry point 2) with the fork pre-answered:
the run starts at Use Case Intake - gathering and categorizing the prepared
use-case list - then scores and ranks them with the prioritization
frameworks. No "how would you like to start?" question, and no pain-point
elicitation. Everything downstream matches the `ai-plc` scope, including
continuing into core Inception through Operation after the Discovery
Document gate (or stopping there for the PM handoff).

## Why these stages, why skip those

Unlike the pain-point path (which can merge INTO this one), a use-case start
can never need Envision or Solution Analysis - so they are structurally SKIP
here, not condition-judged: this scope guarantees no PR/FAQ detour. Intake,
Prioritization, and the shared tail (prototype specs, optional build with
validation, strategy, GTM, Discovery Document) execute. Core ideation stays
SKIP; the core inception/construction/operation memberships arrive via this
plugin's `adds.scopes` contributions.

## Membership

Keyword triggers: `use cases`, `use case prioritization`,
`prioritize use cases`. Seven ai-plc stages are members (all but
`ai-plc-envision` and `ai-plc-solution-analysis`), joined by contribution to
the core inception, construction, and operation sets; initialization always
executes; core ideation stages are SKIP.
