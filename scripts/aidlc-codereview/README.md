# AIDLC Code Reviewer

Automated, language-agnostic code quality analysis for code assets generated
through the AI Development Lifecycle (AIDLC). Runs static analysis tools,
AI-powered critical code analysis, and business logic review — then produces
structured HTML and Markdown reports.

## Quick Start

```bash
cd scripts/aidlc-codereview

# Install with uv (recommended)
uv sync

# Or install with pip
pip install -e .

# Run a review
aidlc-code-reviewer ./path/to/code
```

## Prerequisites

- **Python 3.11+**
- **AWS credentials** with Amazon Bedrock access (for AI-powered analysis)
- **Java JDK 17+** (optional, for Java tools)

See [docs/SETUP.md](docs/SETUP.md) for full installation and configuration details.

## What It Does

The tool runs in two parallel tracks:

**Technical Analysis** — static tools + AI critique:

- Security scanning (bandit, semgrep, gitleaks)
- Linting and type checking (ruff, mypy, checkstyle, eslint)
- Complexity, duplication, and dead code analysis
- AI-powered critical code findings (COMPUTATION, CONTROL_FLOW, DATA_TRANSFORM)
- Code structure critique across 6 dimensions (logging, scalability, efficiency,
  complexity, measurability, structure)

**Business Logic Analysis** — AI-driven domain review:

- Identifies business rules, formulas, pricing logic, state machines, and 10 other
  domain categories
- Flags every finding for human review regardless of tool results
- Cross-checks for self-consistency (constant drift, logic divergence, naming
  mismatches)

## Reports

Three report files are generated:

| Report                             | Format          | Purpose                                                             |
| ---------------------------------- | --------------- | ------------------------------------------------------------------- |
| `code_review_summary_*.html`       | HTML            | Entry point — two cards linking to detailed reports                 |
| `code_review_technical_*.html/.md` | HTML + Markdown | Static tool findings, critical code sections, structure critique    |
| `code_review_business_*.html/.md`  | HTML + Markdown | Business logic findings, consistency issues                         |

Open the summary HTML first — it tells you where to start.

## Usage

```bash
# Default: both reports
aidlc-code-reviewer <target>

# Technical report only
aidlc-code-reviewer <target> --technical-report

# Business logic report only
aidlc-code-reviewer <target> --business-report

# Custom output directory
aidlc-code-reviewer <target> -o ./my-reports

# Skip auto-generation of missing tool wrappers
aidlc-code-reviewer <target> --no-generate

# Pre-flight check (verify AWS credentials and Bedrock access)
aidlc-code-reviewer --preflight

# Verbose output
aidlc-code-reviewer <target> -v
```

## Configuration

### config/review-config.yaml

Defines which tools to run. Just list tool names:

```yaml
tools:
  - bandit
  - ruff
  - mypy
  - semgrep
```

The agent auto-generates a wrapper for each tool on first run (requires Amazon
Bedrock access). Generated wrappers are cached in `src/code_reviewer/tools/` for
subsequent runs.

### config/agent-config.yaml

Controls the Amazon Bedrock model and AWS settings:

```yaml
agent:
  model_id: "us.anthropic.claude-sonnet-4-6"
  max_tokens: 16384

aws:
  region: "us-east-1"
```

Environment variables `AWS_REGION`, `AWS_PROFILE`, and `BEDROCK_MODEL_ID` override
the YAML values.

## Project Structure

```text
scripts/aidlc-codereview/
├── src/
│   └── code_reviewer/
│       ├── __init__.py             # Package init, project root constants
│       ├── runner.py               # CLI orchestration
│       ├── agent/                  # AI agents (critical findings, structure, business logic)
│       ├── common/                 # Shared utilities, models, report generation
│       └── tools/                  # Tool registry and auto-generated wrappers
├── config/
│   ├── agent-config.yaml           # Agent/Bedrock configuration
│   ├── review-config.yaml          # Tool configuration
│   └── prompts/                    # System prompts for AI agents
├── docs/
│   └── SETUP.md                    # Detailed setup guide
├── pyproject.toml
├── README.md
├── CHANGELOG.md
├── LICENSE
└── NOTICE
```

## Documentation

See [docs/SETUP.md](docs/SETUP.md) for:

- AWS credential configuration (IAM roles, SSO, profiles)
- Amazon Bedrock model access setup
- CLI usage and flags
- How auto-generation works
- Troubleshooting

## License

MIT-0 (MIT No Attribution)
