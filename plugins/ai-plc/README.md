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

**Three scopes** mapping AI-PLC's entry points and handoff models:

- `ai-plc-discovery` - the PM workspace: discovery only, both the pain-point
  and use-case entry points (the fork between them is a runtime decision),
  ending at the Discovery Document. Core phases are SKIP.
- `ai-plc-prototype-build` - the workshop handoff: PROTOTYPE-*.md specs
  already exist, skip all discovery, build + strategy + GTM + document.
- `ai-plc-full` - discovery joined to the core lifecycle in one run: the
  discovery stages replace core ideation, then Inception through Operation
  run as in the core `feature` scope. Requires an install whose compose hook
  merges `adds.scopes` (older installs advisory-drop the join contributions,
  leaving this scope discovery-only; use the two-scope handoff there).

**One agent** (`ai-plc-product-strategist-agent`) leading the discovery
stages, with methodology knowledge under `knowledge/`.

**Contributions**: `requirements-analysis` gains an optional consume of
`ai-plc-discovery-document` plus a prose step for using it; the core
inception/construction/operation stages of the `feature` path gain
`ai-plc-full` scope membership (the join - `adds.scopes`).

## Entry points -> scopes

| AI-PLC entry point | How to run it |
| --- | --- |
| 1. Start from customer pain points | `ai-plc-discovery` scope (answer "pain points" at the fork) |
| 2. Start from use cases | `ai-plc-discovery` scope (answer "use cases" at the fork) |
| 3. Build from existing PROTOTYPE-*.md specs | `ai-plc-prototype-build` scope |
| Discovery + build in one workspace | `ai-plc-full` scope |

## Tests

```
bun test plugins/ai-plc/tests/plugin.test.ts
```
