---
name: ai-plc-pain-points
plugin: ai-plc
depth: Standard
keywords:
  - pain points
  - customer pain
  - prfaq
  - working backwards
description: AI-PLC entry point 1 baked in - start from customer pain points (Envision -> PR/FAQ), through discovery, the Discovery Document, and onward into core Inception when the run continues
skeleton: on
runner: true
---

# ai-plc-pain-points scope

The AI-PLC pain-point entry point (entry point 1) with the fork pre-answered:
the run starts at Envision - gathering customer pain points, synthesizing the
categorized analysis, and writing the Working Backwards PR/FAQ - with no
"how would you like to start?" question. Everything downstream matches the
`ai-plc` scope, including continuing into core Inception through Operation
after the Discovery Document gate (or stopping there for the PM handoff).

## Why these stages, why skip those

Envision and Solution Analysis lead the run. Use Case Intake and
Prioritization REMAIN members even though this is the pain-point path: the
methodology's path A.2 merges into the use-case path mid-run when the PR/FAQ
surfaces multiple solutions, and that merge is only knowable after Solution
Analysis - so those stages stay CONDITIONAL members rather than being
excluded. A single-solution PR/FAQ skips them by condition. Core ideation
stays SKIP; the core inception/construction/operation memberships arrive via
this plugin's `adds.scopes` contributions.

## Membership

Keyword triggers: `pain points`, `customer pain`, `prfaq`,
`working backwards`. All nine ai-plc stages are members (the use-case pair
conditionally, for the multi-solution merge), joined by contribution to the
core inception, construction, and operation sets; initialization always
executes; core ideation stages are SKIP.
