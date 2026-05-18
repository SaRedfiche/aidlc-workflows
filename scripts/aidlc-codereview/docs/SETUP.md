# AIDLC Code Reviewer - Setup Guide

## Quick Start

```bash
# Clone and enter the project
cd AIDLC-CodeReviewer

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate    # macOS / Linux
# .venv\Scripts\activate     # Windows

# Install the package
pip install -e .

# Run a review
aidlc-code-reviewer ./src
```

This installs the CLI with all dependencies: Python static analysis tools (bandit, ruff, mypy, radon, vulture, semgrep) and the AI agent (strands-agents, boto3, pydantic, etc.) for auto-generating wrappers and producing AI-powered report sections.

---

## Prerequisites

### Python

- **Python 3.11 or higher** is required (`pyproject.toml` specifies `>=3.11`)
- Verify with: `python3 --version`

### AWS Credentials (required for agent features)

The agent needs AWS credentials with Amazon Bedrock access. Choose the highest-priority option available to you.

> **Note:** Under the AWS Shared Responsibility Model, you are responsible for securing your AWS credentials, configuring least-privilege IAM policies, and rotating credentials regularly.

#### Priority order

| Priority | Option                             | When to use                                      |
| -------- | ---------------------------------- | ------------------------------------------------ |
| 1        | IAM Role (EC2 / ECS / Lambda)      | Running on AWS compute                           |
| 2        | AWS IAM Identity Center (SSO)      | Running from a workstation with org access       |
| 3        | Named AWS profile with SSO         | Local development against an SSO-enabled account |
| 4        | Named AWS profile with static keys | Local development without SSO (least preferred)  |

#### Priority 1: IAM Role (recommended for AWS compute)

**Security control:** AWS STS issues temporary credentials to the compute resource via the instance metadata service. Credentials are automatically rotated approximately every 6 hours and are scoped to the role's trust and permission policies. No secrets are stored on disk.

**Security improvement:** Eliminates long-term credential exposure entirely. Credential rotation is automatic with no developer action required.

If running on Amazon EC2, Amazon ECS, or AWS Lambda, boto3 picks up the role credentials automatically — no configuration needed. Attach a role with `bedrock:InvokeModel` permission to your compute resource.

#### Priority 2: AWS IAM Identity Center / SSO (recommended for workstations)

**Security control:** AWS IAM Identity Center federates authentication through your identity provider (e.g., Okta, Azure AD) and issues short-lived credentials via AWS STS. Default session duration is 1–12 hours (configurable by your admin). Credentials are never written as long-term keys.

**Security improvement:** Provides temporary credentials that expire automatically, enforces MFA through the identity provider, and centralizes access auditing in CloudTrail.

```bash
aws configure sso
# Follow the prompts to authenticate via your identity provider.
# Then set the resulting profile:
export AWS_PROFILE=my-sso-profile
```

Or in `agent-config.yaml`:

```yaml
aws:
  profile_name: "my-sso-profile"
```

#### Priority 3–4: Named AWS profile (local development fallback)

**Security control:** A named profile in `~/.aws/credentials` or `~/.aws/config`. When backed by SSO (Priority 3), it inherits the same temporary-credential benefits above. When backed by static access keys (Priority 4), credentials do not expire unless manually rotated.

**Security improvement (SSO-backed):** Same as Priority 2 — temporary, auto-expiring credentials.

**Security risk (static keys):** Credentials are long-lived and stored in plaintext on disk. If compromised, they remain valid until manually revoked. Use this only when SSO is unavailable, and rotate keys at least every 90 days.

```bash
aws configure --profile my-profile
# Then set in agent-config.yaml:
#   aws:
#     profile_name: "my-profile"
# Or via environment variable:
export AWS_PROFILE=my-profile
```

> **Important:** Avoid static access keys whenever possible. Prefer IAM roles (Priority 1) or IAM Identity Center (Priority 2) for temporary, automatically rotated credentials.

### Enable Amazon Bedrock Model Access

In the AWS Console:

1. Go to **Amazon Bedrock** > **Model access**
2. Request access to **Anthropic Claude Sonnet 4.6** (or your preferred model)
3. Wait for access to be granted (usually immediate for on-demand)

The default model is `us.anthropic.claude-sonnet-4-6`. To change it:

```yaml
# agent-config.yaml
agent:
  model_id: "us.anthropic.claude-sonnet-4-6"
```

Or via environment variable:

```bash
export BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
```

### Java Tools (optional)

For Java analysis (PMD, PMD-CPD, Checkstyle, javac):

- **Java JDK 17+**: `java --version`
- **PMD**: Download from [pmd.github.io](https://pmd.github.io/) or `brew install pmd`
- **Checkstyle**: `brew install checkstyle` or download the JAR

These are only needed if you have Java tools in your `review-config.yaml` and Java files in your target.

### Third-Party CLI Tools

Each tool listed in `review-config.yaml` needs its CLI installed and on PATH for the wrapper to run it. Built-in Python tools (bandit, ruff, etc.) are installed as pip dependencies. External tools must be installed separately:

| Tool       | Install                       | Purpose                              |
| ---------- | ----------------------------- | ------------------------------------ |
| bandit     | `pip install bandit` (auto)   | Python security                      |
| ruff       | `pip install ruff` (auto)     | Python linting                       |
| mypy       | `pip install mypy` (auto)     | Python type checking                 |
| radon      | `pip install radon` (auto)    | Python complexity                    |
| vulture    | `pip install vulture` (auto)  | Python dead code                     |
| semgrep    | `pip install semgrep` (auto)  | Multi-language security              |
| gitleaks   | `brew install gitleaks`       | Secret detection                     |
| pmd        | `brew install pmd`            | Java linting/complexity              |
| checkstyle | `brew install checkstyle`     | Java style                           |
| javac      | Comes with JDK                | Java compilation                     |
| pylint     | `pip install pylint`          | Python linting (no built-in wrapper) |

Tools marked **(auto)** are installed automatically with `pip install -e .`. Others need manual installation. If a tool isn't installed, its wrapper returns an error and the tool is skipped.

---

## Verify Setup

```bash
aidlc-code-reviewer ./src --preflight
```

If you encounter `LLM invocation failed`, check your AWS credentials and Amazon Bedrock model access.

---

## Configuration

### review-config.yaml

Defines which tools to run:

```yaml
tools:
  - pylint
  - flake8
  - bandit
```

Just add a tool name to the list. If a built-in wrapper exists in `tools/`, it's used. Otherwise the agent generates one automatically.

### agent-config.yaml

Agent and Amazon Bedrock settings:

```yaml
agent:
  model_id: "us.anthropic.claude-sonnet-4-6"  # Amazon Bedrock inference profile ID
  max_tokens: 8192                             # Max response tokens
  max_retries: 2                               # Retries on verification failure

aws:
  region: "us-east-1"                          # AWS region
  profile_name: null                           # Named AWS profile (or null)
```

**Environment variable overrides** (take precedence over the YAML file):

| Variable           | Overrides          |
| ------------------ | ------------------ |
| `AWS_REGION`       | `aws.region`       |
| `AWS_PROFILE`      | `aws.profile_name` |
| `BEDROCK_MODEL_ID` | `agent.model_id`   |

---

## CLI Usage

```bash
# Default: generates both technical and business logic reports
aidlc-code-reviewer <target>

# Technical report only (static tools + critical findings + structure critique)
aidlc-code-reviewer <target> --technical-report

# Business logic report only (AI-driven, skips static tools — faster)
aidlc-code-reviewer <target> --business-report

# Both flags = same as default
aidlc-code-reviewer <target> --technical-report --business-report

# With custom config
aidlc-code-reviewer <target> --config my-config.yaml

# Custom output directory (default: ./reports/)
aidlc-code-reviewer <target> --output-dir ./my-reports

# Disable auto-generation (skip tools without built-in wrappers)
aidlc-code-reviewer <target> --no-generate
```

### Flags

| Flag                 | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `<target>`           | Path to file or directory to analyze (required)          |
| `-c`, `--config`     | Path to review-config.yaml (default: built-in)           |
| `-o`, `--output-dir` | Output directory for reports (default: `./reports/`)     |
| `--technical-report` | Generate only the technical report (tools + AI critique) |
| `--business-report`  | Generate only the business logic review report           |
| `--no-generate`      | Skip AI wrapper generation for unknown tools             |
| `--preflight`        | Run pre-flight checks for agent setup, then exit         |
| `-v`, `--verbose`    | Show detailed progress output                            |

### Example Output

```text
Activating AIDLC Code Reviewer...
  Tools run: 5, Skipped: 2, Findings: 47
  Critical sections: 3
  Business logic findings: 12, Consistency issues: 2

  Reports:
    → Start here:          reports/code_review_summary_20260421_143000.html
    Technical (Markdown): reports/code_review_technical_20260421_143000.md
    Technical (HTML):     reports/code_review_technical_20260421_143000.html
    Business Logic (Markdown): reports/code_review_business_20260421_143000.md
    Business Logic (HTML):     reports/code_review_business_20260421_143000.html
```

Open the summary HTML first — it links to the detailed reports.

---

## How Auto-Generation Works

When a tool in `review-config.yaml` has no built-in wrapper:

1. **Doc Fetch** - Attempts to fetch the tool's documentation from known URLs or PyPI (non-blocking)
2. **Prompt Assembly** - Builds a prompt containing the project's data models, utility functions, severity policy, three example wrappers, and the tool's config
3. **LLM Call** - Sends the prompt to Amazon Bedrock (Claude Sonnet) via Strands SDK
4. **Code Extraction** - Parses the Python code from the LLM response
5. **Level 1 Verification (static)** - Checks syntax, imports, `run()` signature, required constants (`CATEGORY`, `TOOL`, `SUPPORTED_LANGUAGES`), and return type via dry run
6. **Retry** - If Level 1 fails, feeds errors back to the LLM and retries (up to 2 times)
7. **Level 2 Verification (live)** - If the tool CLI is on PATH, runs the wrapper against the actual target and validates the output structure
8. **Write & Register** - Saves the wrapper to `tools/<name>.py` and registers it in memory
9. **Run** - The wrapper is immediately used for the current review

Generated wrappers persist in the `tools/` directory and are reused on subsequent runs (no regeneration needed).

---

## Troubleshooting

| Symptom                                                   | Cause                                            | Fix                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `Agent dependencies not installed`                        | Packages missing or corrupt install              | Reinstall with `pip install -e .`                                                         |
| `LLM invocation failed: ValidationException`              | Wrong model ID or no model access                | Check `agent-config.yaml` model_id, enable access in Amazon Bedrock console               |
| `LLM invocation failed: AccessDeniedException`            | AWS credentials lack Amazon Bedrock permissions  | Add `bedrock:InvokeModel` permission to your IAM policy                                   |
| `Level 2 verification failed: Tool not installed`         | Tool CLI not on PATH                             | Install the tool or add `.venv/bin` to PATH. Wrapper is still accepted (Level 1 passed).  |
| `Generation failed: Could not extract valid Python code`  | LLM response didn't contain parseable code       | Retry, or try a different model via `BEDROCK_MODEL_ID`                                    |
| Tool skipped with no message                              | `--no-generate` flag or no wrapper exists        | Remove `--no-generate` flag                                                               |
