# Changelog

All notable changes to this project are documented in this file.

## 0.0.1 - 2025-12-17

### Fixed
- MiniMax tool-calling reliability by normalizing `role="tool"` history into MiniMax-safe user tool-result messages.
- Prevent backend stalls/OOMs by clamping MiniMax `max_tokens` and lowering unsafe defaults when clients omit it.
- MiniMax streaming responsiveness by emitting deltas immediately while still detecting `<minimax:tool_call>` blocks.

### Added
- Request tracing with `X-Request-Id` on responses and structured request/latency logging.
- Clearer backend failure surfacing by mapping backend errors to `502` and returning backend response bodies (truncated) for debugging.
