---
"manifest": minor
---

Add OpenAI Codex as a coding-assistant agent platform. Codex shows up in the agent picker with a copy-ready `~/.codex/config.toml` setup panel that points Codex CLI and Desktop at Manifest over the Responses API (`wire_api = "responses"`) and authenticates with your `mnfst_` key. Two upstream-compatibility fixes make Codex work against non-OpenAI providers: Responses-API `role: "developer"` instruction messages are folded into `system`, and OpenAI-hosted tools (`web_search`, `file_search`, …) are dropped on the Chat Completions path. Native Responses upstreams keep developer roles and hosted tools untouched.
