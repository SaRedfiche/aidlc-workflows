---
name: ai-plc-full
plugin: ai-plc
depth: Standard
keywords:
  - discovery to delivery
  - full product lifecycle
  - discovery and build
description: AI-PLC discovery joined to the core lifecycle - one scope from pain points through Inception, Construction, and Operation
skeleton: on
runner: true
---

# ai-plc-full scope

Standard depth for the joined flow: AI-PLC discovery runs first, then the run
continues into the core Inception -> Construction -> Operation arc in the same
workspace, with the Discovery Document feeding Requirements Analysis directly.
Use it when the same team owns both the product thinking and the build, so a
separate PM-workspace handoff would be ceremony.

## Why these stages, why skip those

The discovery stages replace core ideation: they cover the same
territory (intent, feasibility of the product bet, scope of the offering)
PM-first and deeper on the product side, so core ideation stages stay SKIP.
From Inception onward the core path runs as in the core `feature` scope.

Membership of the ai-plc stages in this scope is declared on the plugin's own
stage files. Membership of the core inception/construction/operation stages is
declared by this plugin's contribution files via `adds.scopes` - on installs
whose compose hook predates the `adds.scopes` merge surface, those
contributions are advisory-dropped (visible in `/aidlc --doctor`) and this
scope selects only the discovery stages; use the two-scope handoff
(`ai-plc-discovery`, then a core scope) instead.

## Membership

Keyword triggers: `discovery to delivery`, `full product lifecycle`,
`discovery and build`. All nine ai-plc stages are members, joined by
contribution to the core inception, construction, and operation sets that the
core `feature` scope runs; core ideation stages are SKIP.
