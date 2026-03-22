---
title: "feat: Agent-Zero framework integration support"
labels: Feature
---

## Description

User requests guidance and/or support for using the Manifest plugin with [Agent-Zero](https://github.com/frdel/agent-zero), a general-purpose AI agent framework.

Currently, Manifest integrates primarily via the OpenClaw plugin ecosystem. Agent-Zero uses its own architecture for model routing and tool execution, so integration would require either:

1. **OTLP telemetry ingestion** — Agent-Zero could send OpenTelemetry traces to Manifest's `/otlp/v1/traces` endpoint for observability (model usage, token tracking, costs)
2. **OpenAI-compatible proxy** — Agent-Zero could point its LLM base URL at Manifest's `/v1/chat/completions` endpoint for intelligent routing

## Report from Discord

**User: Ludger1001** ([Discord](https://discord.com/channels/1089907785178812499) — 2026-03-20):
> Any idea how I can use this manifest plugin with Agent-Zero?

## Investigation needed

- Does Agent-Zero support custom OpenAI-compatible endpoints?
- Does Agent-Zero emit OpenTelemetry traces?
- What's the minimal integration path for non-OpenClaw agent frameworks?

## Notes

Could potentially be addressed with documentation if Agent-Zero already supports OpenAI-compatible base URLs. The `/v1/chat/completions` proxy should work with any client that speaks the OpenAI chat completions protocol.
