# Try the AI-PLC plugin (pre-PR preview)

AI-PLC is a PM-facing product discovery workflow
([aws-samples/sample-ai-plc](https://github.com/aws-samples/sample-ai-plc))
ported as an AIDLC v2 plugin: pain points -> PR/FAQ -> use-case
prioritization -> prototype specs -> product strategy -> GTM -> a Discovery
Document that feeds straight into Inception's Requirements Analysis.

This is a preview branch, not a release. It bundles engine changes still in
review ([PR #664](https://github.com/awslabs/aidlc-workflows/pull/664)), so
it only works with the base install included here - do not compose the
plugin into an existing AIDLC project.

## Prerequisites

- [bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Claude Code, or Kiro CLI >= 2.6 (paid plan recommended; weaker models may
  rush approval gates)

## Setup (one command)

Claude Code:

```bash
curl -fsSL https://raw.githubusercontent.com/awslabs/aidlc-workflows/spike/ai-plc-combined/scripts/try-ai-plc.sh | bash
cd ai-plc-preview && claude
```

Kiro CLI:

```bash
curl -fsSL https://raw.githubusercontent.com/awslabs/aidlc-workflows/spike/ai-plc-combined/scripts/try-ai-plc.sh | bash -s -- kiro
cd ai-plc-preview && kiro-cli chat
```

The script creates `./ai-plc-preview`, copies the base install, composes the
plugin, and drops in a sample prototype spec. Prefer to read before piping
to bash? The script is at that URL - short and boring. A manual recipe is at
the bottom.

## The three ways to start (mirrors the original repo)

| You have | Type |
| --- | --- |
| Customer pain points, feedback, a problem area | `/ai-plc I want to start discovery from customer pain points for YOUR-IDEA` |
| A list of use cases to prioritize | `/ai-plc I have 5 use cases to prioritize` |
| PROTOTYPE-*.md spec files | `/ai-plc build my prototypes` (a sample spec, "team lunch picker", is already in the project) |

Entry-point-specific commands also exist: `/ai-plc-pain-points`,
`/ai-plc-use-cases`, `/ai-plc-prototype-build`.

After the Discovery Document is approved you'll be asked: stop there (hand
the document to a dev team) or keep going - the same run then continues into
requirements analysis, design, and build.

## Sample runs

### Entry point 1 - start from pain points

```
/ai-plc I want to start discovery from customer pain points for a neighborhood dog-walking marketplace
```

```
/ai-plc Help me create a PR/FAQ - our customers complain that onboarding new suppliers takes 6 weeks and three departments
```

```
/ai-plc-pain-points Our support team is drowning in password-reset tickets and I have a pile of customer feedback to analyze
```

What to expect: business-context questions first (with an option to give a
URL to analyze instead of typing), then pain-point gathering, a categorized
analysis, and a Working Backwards PR/FAQ with an approval gate. If the
PR/FAQ suggests several distinct solutions, the run offers to prioritize
them like use cases.

### Entry point 2 - start from use cases

```
/ai-plc I have 5 use cases to prioritize for our internal AI tooling
```

```
/ai-plc-use-cases Prioritize these: invoice-matching agent, customer churn dashboard, meeting summarizer, contract clause checker, onboarding chatbot
```

You can also just paste a table or a rough list when it asks - bulk paste is
supported; it parses and asks you to confirm. What to expect: an 8-field
intake per use case, agentic vs application categorization, weighted scoring
with the arithmetic shown, and a ranked top-3 you can override.

### Entry point 3 - build from existing specs

The preview project already contains a sample spec
(`aiplc-docs/discovery/prototypes/team-lunch-picker/PROTOTYPE-team-lunch-picker.md` -
a small agentic app with two tools):

```
/ai-plc I have PROTOTYPE-*.md files ready, let's build them
```

```
/ai-plc-prototype-build build my prototypes
```

What to expect: it finds the spec, shows a spec-vs-defaults summary, ALWAYS
asks your LLM provider (or offers a mocked agent if you don't want to spend
credits - say "mock it"), then builds and runs it on localhost and iterates
on your feedback.

### Continuing past discovery (the AIDLC extension)

At the Discovery Document approval gate, answer that you want to continue
rather than hand off - the same run flows into core Inception:

```
Approve. Continue into Inception in this workspace.
```

Requirements Analysis should then explicitly reference the Discovery
Document as an input. This is the part the original repo can't do in one
session.

### Steering and inspecting mid-run

```
/aidlc --status                    where am I, what's next
/aidlc --doctor                    health check (should be clean)
/ai-plc --status                   same, scope-fixed
/aidlc --stage ai-plc-product-strategy    jump to a specific stage
/aidlc-replay                      replay the decision history
```

### A 10-minute smoke test, if you only have 10 minutes

1. `/ai-plc-prototype-build build my prototypes` - answer "mock it" at the
   provider question (no credentials needed, no cost)
2. Approve the build, skim the strategy and GTM questions (option A defaults
   everywhere - just confirm)
3. Approve the Discovery Document, answer "stop here"
4. Read `discovery-document.md` in the record directory it names, and tell
   us whether you'd hand that to a team

## What feedback we want

The mechanics (stage graph, gates, artifacts) are tested. What needs human
eyes is the conversational experience:

1. Did the run enter at the right point for how you phrased your start?
2. Question quality - do the intelligent defaults (option A) feel drawn from
   your earlier answers, or generic?
3. Gate pacing - too many approval stops, too few, wrong places?
4. Artifact quality - is the PR/FAQ / prioritization scoring / Discovery
   Document something you'd actually hand to a team?
5. Anything the [original AI-PLC](https://github.com/aws-samples/sample-ai-plc)
   does better.

## Manual setup (if you'd rather not curl | bash)

```bash
git clone --branch spike/ai-plc-combined --single-branch https://github.com/awslabs/aidlc-workflows.git
mkdir ai-plc-preview && cd ai-plc-preview

# Claude Code:
cp -r ../aidlc-workflows/dist/claude/.claude .
CLAUDE_PLUGIN_ROOT=../aidlc-workflows/dist/plugins/ai-plc/claude \
CLAUDE_PROJECT_DIR=$PWD AIDLC_HARNESS_DIR=.claude \
  bun ../aidlc-workflows/dist/plugins/ai-plc/claude/hooks/compose.ts

# Kiro CLI (instead):
cp -r ../aidlc-workflows/dist/kiro/.kiro . && cp ../aidlc-workflows/dist/kiro/AGENTS.md .
AIDLC_PLUGIN_ROOT=../aidlc-workflows/dist/plugins/ai-plc/kiro \
AIDLC_PROJECT_DIR=$PWD AIDLC_HARNESS_DIR=.kiro \
  bun ../aidlc-workflows/dist/plugins/ai-plc/kiro/hooks/compose.ts

# Optional, for entry point 3 - the sample spec:
mkdir -p aiplc-docs/discovery/prototypes/team-lunch-picker
cp ../aidlc-workflows/plugins/ai-plc/examples/PROTOTYPE-team-lunch-picker.md \
  aiplc-docs/discovery/prototypes/team-lunch-picker/
```
