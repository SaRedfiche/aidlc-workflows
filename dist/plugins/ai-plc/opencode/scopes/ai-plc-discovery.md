---
name: ai-plc-discovery
plugin: ai-plc
depth: Standard
keywords:
  - discovery
  - pain points
  - prfaq
  - use case prioritization
  - product discovery
description: PM-facing product discovery - pain points or use cases through prototype specs, strategy, and GTM, ending at the Discovery Document handoff
skeleton: off
runner: true
---

# ai-plc-discovery scope

Standard depth for the AI-PLC Discovery flow: a Product Manager workspace that
runs product discovery only and ends at a portable Discovery Document. It
covers both discovery entry points from the AI-PLC methodology - starting from
customer pain points (Envision -> PR/FAQ -> Solution Analysis) or starting
from a list of use cases (Intake -> Prioritization) - because the two paths
share their tail (prototype specs, optional prototype build, product strategy,
go-to-market) and the pain-point path can merge into the use-case path when a
PR/FAQ surfaces multiple solutions. The entry-point fork is a runtime decision
the first in-scope stage makes, not a scope decision.

## Why these stages, why skip those

Discovery is deliberately everything-before-Inception: no core ideation,
inception, construction, or operation stages are members, so a run under this
scope completes when the Discovery Document is assembled. Developers pick the
document up in a separate workspace under a core scope (or under
`ai-plc-full`, which carries discovery straight into the core flow). The
path-specific stages are CONDITIONAL - a use-case start skips Envision and
Solution Analysis; a pain-point start with a single clear solution skips
Intake and Prioritization; prototype building runs only when the user chooses
to build rather than hand specs off.

## Membership

Keyword triggers: `discovery`, `pain points`, `prfaq`,
`use case prioritization`, `product discovery`. All nine ai-plc stages are
members; initialization always executes; every core phase stage is SKIP.
