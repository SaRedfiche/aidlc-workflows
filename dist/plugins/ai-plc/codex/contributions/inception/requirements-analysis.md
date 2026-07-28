---
target: requirements-analysis
plugin: ai-plc
adds:
  consumes:
    - artifact: ai-plc-discovery-document
      required: false
  scopes:
    - ai-plc-discovery
fragments:
  - anchor: after-step:2
    order: 100
---

## fragment: after-step:2

### Step 2b (ai-plc): Load the Discovery Document

If an `ai-plc-discovery-document` artifact exists (produced by the AI-PLC
discovery stages in this run, or copied into the workspace from a separate
PM-workspace discovery run), read it before analyzing requirements. It
carries validated product context that replaces guesswork:

- The **pain point analysis** and **PR/FAQ** define the problem, the target
  customer, and the differentiation claims - treat them as the product
  intent, alongside (not instead of) any core ideation artifacts present.
- The **use case prioritization** names which use case was selected and why -
  requirements belong to the selected use case, not the rejected ones.
- The **prototype specifications and validation notes** are evidence of what
  users accepted or rejected - carry validated behavior into requirements
  and flag rejected behavior so it is not re-specified.
- The **product strategy** (beachhead market, MVP scope) and **go-to-market
  plan** (launch milestones, kill criteria) bound the requirements depth:
  requirements outside the MVP scope belong to the post-launch roadmap
  section, not the launch set.

Reference the discovery document explicitly in the requirements artifact so
the upstream-coverage sensor can verify the linkage. If the artifact is
absent, proceed with the core inputs - it is optional.
