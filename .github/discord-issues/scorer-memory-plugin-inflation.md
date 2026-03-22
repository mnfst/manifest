---
title: "routing: memory plugin context inflates scorer — simple queries always route to complex tier"
labels: bug, UX
---

## Description

When users run memory plugins (supermemory, etc.) alongside Manifest via OpenClaw, the plugin injects additional context into every prompt. This causes the routing scorer to consistently classify even trivial queries as "complex" or "reasoning" tier, wasting expensive model capacity on simple tasks.

## Root cause

The scorer evaluates the **full message content** including injected system/context messages. Memory plugins add retrieved context that triggers multiple scoring dimensions:

- **tokenCount** (weight 0.05): Injected context pushes token count well above 500 → score bump
- **large_context override**: >50,000 total tokens forces "complex" tier automatically
- **technicalTerms** (weight 0.07): Retrieved memory often contains technical keywords
- **domainSpecificity** (weight 0.05): Domain-specific terms in memory context inflate score
- **multiStep** (weight 0.07): Retrieved context may contain sequential instructions
- **conversationDepth** (weight 0.03): More messages = higher score

The scorer currently filters out `system` and `developer` roles before scoring (`SCORING_EXCLUDED_ROLES`), but memory plugins typically inject context as `user` or `assistant` messages, bypassing this filter.

## Report from Discord

**Anonymous user** ([Discord](https://discord.com/channels/1089907785178812499)):
> Naturally when using supermemory or a similar memory plugin with OpenClaw, we inject more context in each prompt. This causes Manifest to use the complex level on even the simplest queries. Is there any way to adjust or compensate for this? It seems likely that a lot of users will want to use a better memory system than default OpenClaw.

## Possible solutions

1. **Score only the last user message** for keyword/structural dimensions, use full context only for token count
2. **Add a `context_window_offset`** config that lets users declare how many tokens are typically injected by plugins, so the scorer can subtract that baseline
3. **Detect injected context patterns** (e.g., `<memory>`, `<context>` tags) and exclude them from keyword scoring
4. **Expose tier override** — let users pin a max tier or provide a scoring bias via request headers (e.g., `X-Manifest-Tier-Bias: -0.1`)

## Related issues

- #1172 — Inverse problem: short prompts bypass scoring and always route simple
