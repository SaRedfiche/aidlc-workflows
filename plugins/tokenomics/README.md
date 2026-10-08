# tokenomics

A post-workshop **AI tokenomics** plugin for AI-DLC: a read-only report of what a
feature cost to build in AI tokens and list-price dollars.

It adds **no capture**. The usage ledger, per-model pricing, and per-stage /
per-model / per-agent / per-intent attribution already live in core
(`aidlc-usage.ts`). This plugin reads that ledger for one intent (= one feature)
and renders a report, adding only:

- a **stage → phase** fold (the ledger keys stages, not phases), and
- a human-facing **report** (Markdown artifact + terminal table + JSON).

## What it shows

- Estimated total cost + total tokens + session count
- Cost **by phase** (initialization → operation; unmapped stages shown as
  `unattributed`, never dropped)
- Cost **by stage**
- Cost **by model** (model mix; an unknown model is shown unpriced, never guessed)
- Cost **by agent** (main vs swarm)
- **Cache economics** — read:write token ratio, i.e. spend prompt caching avoided

## Honesty constraints

- **List-price estimate, not a bill.** Priced from AI-DLC's default/overridable
  rate table (`$AIDLC_MODEL_RATES` overrides it), not from provisioned-throughput
  or negotiated AWS pricing.
- **Claude-harness-only capture.** On Kiro / Codex / opencode the ledger is empty
  and the report renders an honest empty state.
- **Kill switch.** `AIDLC_DISABLE_USAGE_TRACKING=1` ⇒ no ledger ⇒ no report.

## Usage

Under a workshop that has recorded usage, run the report directly:

```
bun <tools-dir>/tokenomics-report.ts            # Markdown
bun <tools-dir>/tokenomics-report.ts --table    # terminal summary
bun <tools-dir>/tokenomics-report.ts --json      # machine-readable
```

Or invoke the `tokenomics` scope / `tokenomics-report` stage (operation phase)
to produce the `tokenomics-report.md` artifact at workshop close.

## Authoring flow

1. **Validate:** `bun <tools-dir>/aidlc-plugin-validate.ts plugins/tokenomics`
2. **Build:** `bun <tools-dir>/aidlc-plugin-build.ts plugins/tokenomics claude`
3. **Test:** `bun test plugins/tokenomics/tests/plugin.test.ts`

## Roadmap

- **Real billing (follow-up).** v1 is a list-price estimate. A later enhancement
  could ingest a Bedrock cost export as an `$AIDLC_MODEL_RATES` override so the
  report reflects actual negotiated spend. That is a cross-cutting change with
  its own design questions and is intentionally out of v1 scope.

`hooks/compose.ts` is intentionally absent from this authored root. Plugin build
injects the current bundled compose hook into each host projection.
