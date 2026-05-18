# Changelog

## 0.2.0 (2026-05-18)

### Changed

- Repackaged into `src/` layout matching aidlc-workflows conventions
- Externalized config files to `config/` directory (agent-config.yaml, review-config.yaml, prompts)
- Switched build backend from setuptools to hatchling
- Added `uv.lock` for reproducible installs
- Added NOTICE file with third-party attributions

### Features

- Technical report: static analysis tools + AI-powered critical findings + structure critique
- Business logic report: AI-driven domain review with consistency checking
- Auto-generation of tool wrappers via Amazon Bedrock
