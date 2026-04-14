# Changelog

All notable changes to this project are documented in this file.

## [v1.17.0] - 2026-04-14

### Added
- Computer sidebar **Browser** tab (embedded `http(s)` preview, URL allow-list) and richer **Files** previews (Markdown, HTML, JSON/code).
- `browser_open_url` streams sync the Browser tab URL; agent system prompt notes the behavior.

### Fixed
- GitHub **Release** workflow: semantic-release no longer requires a root `package.json` or pushes commits to protected `main` (tag + GitHub Release only).

## [v1.13.0] - 2026-03-02

### Added
- controller tests for SSE run termination and stricter agent system prompt contracts
- Daytona tool registry tests for command alias handling (`cmd`, `workdir`, `timeout_ms`)
- Daytona toolbox client tests for legacy route fallback and sandbox quota-recovery flow

### Changed
- OpenAI proxy model activation now supports policy control via `VLLM_STUDIO_OPENAI_MODEL_ACTIVATION_POLICY`:
  - `load_if_idle` (default): reuse currently running model and rewrite request model when needed
  - `switch_on_request`: switch active model to requested recipe before proxying
- lifecycle coordinator now aborts active chat runs when model eviction occurs
- SSE run streams now terminate immediately after `run_end` on both controller and frontend
- Daytona toolbox command execution now accepts alias keys (`cmd`, `workdir`, `timeout_ms`) and string payloads
- Daytona toolbox client now retries sandbox creation after cleaning stopped sandboxes on quota/limit errors
- Daytona toolbox client now supports modern and legacy toolbox endpoint patterns
- Dashboard launch state now clears reliably when launch stages enter a done state

### Fixed
- reduced LiteLLM retry layering by setting router and client retries to zero in `config/litellm.yaml`
- frontend launch API timeout reduced to avoid long-hanging launch calls

## [v1.12.0] - 2026-02-24

- release: repo-wide stabilization, docs reset, and deployment hardening
