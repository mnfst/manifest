---
title: "feat: NanoGPT subscription provider support"
labels: Feature, Highly requested
related: "#930"
---

## Description

User requests NanoGPT subscription support as a provider in Manifest routing. NanoGPT is a subscription aggregator that provides access to various open-source models through a single subscription.

This is an extension of #930 (Allow using OpenClaw-managed tokens for various providers).

## Report from Discord

**User: CptanPanic** ([Discord](https://discord.com/channels/1089907785178812499) — 2026-03-22):
> I use nanogpt subscription to get access to various open models, can I use manifest?

## Context

NanoGPT provides access to open-source models (Llama, Mistral, etc.) via a unified subscription API. Integration would require:

1. Understanding NanoGPT's API format (likely OpenAI-compatible)
2. Adding NanoGPT as a provider in `PROVIDER_REGISTRY`
3. Supporting NanoGPT's authentication mechanism

## Related issues

- #930 — Allow using OpenClaw-managed tokens for various providers
- #934 — Allow github-copilot login (similar subscription provider request)
