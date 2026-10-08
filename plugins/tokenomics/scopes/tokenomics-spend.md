---
name: tokenomics-spend
plugin: tokenomics
depth: Standard
keywords:
  - tokenomics
  - ai spend
  - ai cost
  - what did this cost
description: Report what the feature cost to build in AI tokens and dollars
skeleton: off
runner: true
---

# tokenomics scope

Runs the tokenomics report stage on demand, so a project can see what a feature
cost to build in AI usage without waiting for a full workshop-close ceremony.

## Why this stage

The report is a read-only render of the usage ledger core already keeps. The
scope exists so the report is reachable by keyword (`tokenomics`, `ai spend`,
`what did this cost`) at any point after a workshop has produced usage, not only
at a fixed lifecycle position.

## Membership

Keyword triggers: `tokenomics`, `ai spend`, `ai cost`, `what did this cost`.
`tokenomics-report` executes when its plugin stage membership includes this
scope; unrelated stages remain governed by their own scope lists.
