# ai-plc plugin

An AIDLC plugin porting the [AI-PLC](https://github.com/aws-samples/sample-ai-plc)
product discovery methodology: a PM-facing Discovery flow that runs before
Inception and hands a portable Discovery Document to the core requirements
stages.

## What it adds

**Nine ideation stages** forming a self-contained discovery sub-DAG (no edges
to core ideation stages):

| Stage | What it does |
| --- | --- |
| `ai-plc-envision` | Pain points -> categorized analysis -> Working Backwards PR/FAQ |
| `ai-plc-solution-analysis` | Single vs. multiple solutions from the PR/FAQ |
| `ai-plc-use-case-intake` | Gather and categorize candidate use cases |
| `ai-plc-use-case-prioritization` | Framework scoring (agentic vs. application), ranked selection |
| `ai-plc-prototype-context` | Portable PROTOTYPE-*.md specifications per selected use case |
| `ai-plc-prototype-building` | Working localhost prototypes, user validation loop |
| `ai-plc-product-strategy` | Positioning, differentiation, business model, metrics |
| `ai-plc-go-to-market` | Marketing, sales, launch plan, kill criteria |
| `ai-plc-discovery-document` | Assemble the handoff Discovery Document |

**Two scopes** mapping AI-PLC's entry points and handoff models:

- `ai-plc-discovery` - the main scope: discovery first (both the pain-point
  and use-case entry points; the fork between them is a runtime decision),
  then the run continues into core Inception through Operation with
  Requirements Analysis consuming the Discovery Document. The Discovery
  Document approval gate is the phase boundary: stop there for the
  PM-workspace handoff model (document + specs go to a separate team), or
  keep approving to build in the same workspace. Core ideation stays SKIP.
  The core-stage memberships arrive via `adds.scopes` contributions; an
  install whose compose hook predates that merge surface advisory-drops them
  (visible in doctor), leaving the scope discovery-only.
- `ai-plc-prototype-build` - the workshop handoff: PROTOTYPE-*.md specs
  already exist, skip all discovery, build + strategy + GTM + document.

**One agent** (`ai-plc-product-strategist-agent`) leading the discovery
stages, with methodology knowledge under `knowledge/`.

**Contributions**: `requirements-analysis` gains an optional consume of
`ai-plc-discovery-document` plus a prose step for using it; the core
inception/construction/operation stages of the `feature` path gain
`ai-plc-discovery` scope membership (the join - `adds.scopes`).

## Entry points -> scopes

| AI-PLC entry point | How to run it |
| --- | --- |
| 1. Start from customer pain points | `ai-plc-discovery` scope (answer "pain points" at the fork) |
| 2. Start from use cases | `ai-plc-discovery` scope (answer "use cases" at the fork) |
| 3. Build from existing PROTOTYPE-*.md specs | `ai-plc-prototype-build` scope |
| PM handoff vs. build-in-place | same scope: stop at (or continue past) the Discovery Document gate |

## Tests

```
bun test plugins/ai-plc/tests/plugin.test.ts
```
