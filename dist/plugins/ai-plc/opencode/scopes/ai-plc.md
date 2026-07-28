---
name: ai-plc
plugin: ai-plc
depth: Standard
keywords:
  - discovery
  - pain points
  - prfaq
  - use case prioritization
  - product discovery
description: AI-PLC product discovery - pain points or use cases through prototype specs, strategy, GTM, and the Discovery Document, continuing into core Inception onward when the run keeps going
skeleton: on
runner: true
---

# ai-plc scope

Standard depth for the AI-PLC flow: product discovery first, and the core
lifecycle after it. The nine discovery stages run in place of core ideation,
covering both discovery entry points from the AI-PLC methodology - starting
from customer pain points (Envision -> PR/FAQ -> Solution Analysis) or from a
prepared use-case list (Intake -> Prioritization). The two paths share their
tail (prototype specs, optional prototype build with validation, product
strategy, go-to-market, Discovery Document), and the pain-point path can
merge into the use-case path when a PR/FAQ surfaces multiple solutions - so
the entry-point fork is a runtime decision the first in-scope stage makes,
not a scope decision.

After the Discovery Document is approved, the run continues into the core
Inception -> Construction -> Operation arc in the same workspace, with
Requirements Analysis consuming the Discovery Document directly. For the
PM-workspace handoff model (discovery only, document handed to a separate
development team), simply stop at the Discovery Document approval gate - it
is the phase boundary, and the document plus the PROTOTYPE-*.md specs are the
portable handoff.

## Why these stages, why skip those

The discovery stages replace core ideation: they cover the same territory
(intent, feasibility of the product bet, scope of the offering) PM-first and
deeper on the product side, so core ideation stages stay SKIP. The
path-specific discovery stages are CONDITIONAL - a use-case start skips
Envision and Solution Analysis; a pain-point start with a single clear
solution skips Intake and Prioritization; prototype building runs only when
the user chooses to build rather than hand specs off. From Inception onward
the core path runs as in the core `feature` scope.

Membership of the discovery stages in this scope is declared on the plugin's
own stage files. Membership of the core inception/construction/operation
stages is declared by this plugin's contribution files via `adds.scopes` - on
installs whose compose hook predates the `adds.scopes` merge surface, those
contributions are advisory-dropped (visible in `/aidlc --doctor`) and this
scope selects only the discovery stages; there, hand the Discovery Document
to a run under a core scope instead.

## Membership

Keyword triggers: `discovery`, `pain points`, `prfaq`,
`use case prioritization`, `product discovery`. All nine ai-plc stages are
members, joined by contribution to the core inception, construction, and
operation sets that the core `feature` scope runs; initialization always
executes; core ideation stages are SKIP.
