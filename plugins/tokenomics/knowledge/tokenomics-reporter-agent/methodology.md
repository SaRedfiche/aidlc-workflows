# Tokenomics reporting methodology

How this plugin turns the usage ledger into a feature-level cost report, and the
honesty rules that keep the number trustworthy.

## What is already captured (reuse, don't rebuild)

Core's `aidlc-usage.ts` keeps a durable ledger at
`aidlc/.aidlc-sessions/usage-ledger.json`. For every assistant turn it records
input / output / cache-create / cache-read tokens and prices them against a
model-version rate table (`DEFAULT_RATES`, overlaid by a shipped
`model-rates.json`, overlaid by `$AIDLC_MODEL_RATES`). The ledger partitions
usage by stage, by model, by agent, and per intent (= per feature when an
intent is active; an unscoped `…/legacy` bucket otherwise, which the report
labels as whole-workspace usage) → per
session. This plugin only reads that.

## The one new fold: stage → phase

The ledger keys usage by stage slug but not by phase. The report folds stages
into the five AI-DLC phases (initialization, ideation, inception, construction,
operation) using a stage→phase map read from the composed stage files'
frontmatter. A stage with no mapped phase is bucketed as "unattributed" so its
cost is never dropped.

## Honesty rules

1. **List-price estimate, not a bill.** The figure reflects the rate table, not
   provisioned-throughput or negotiated AWS pricing. State it on every headline.
2. **Harness scope.** Capture is Claude-transcript-specific. On Kiro / Codex /
   opencode the ledger is empty; render the empty state, not a zero.
3. **Unknown models.** A model absent from the rate table has its tokens counted
   but its cost withheld — shown as unpriced, never fabricated.
4. **Cache economics.** Cache reads price at a fraction of input (0.025–0.2×). A
   high read:write ratio is spend AI-DLC's prompt caching already avoided; the
   report surfaces it so the saving is visible.
