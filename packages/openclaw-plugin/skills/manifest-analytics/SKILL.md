---
name: manifest-analytics
description: Query token consumption and costs for this agent via the Manifest API.
tags:
  - analytics
  - costs
  - tokens
dependencies:
  plugins:
    - manifest
---

# Manifest Analytics

You have two tools to query your own telemetry data.

## Tools

### manifest_usage

Returns token consumption for a given period.

**Parameters:**
- `period`: `"today"` | `"week"` | `"month"` (default: `"today"`)

**Response:**
```json
{
  "range": "24h",
  "total_tokens": 45230,
  "input_tokens": 34500,
  "output_tokens": 10730,
  "cache_read_tokens": 15000,
  "message_count": 12,
  "trend_pct": -20
}
```

`trend_pct` compares to the previous equivalent period (e.g. today vs yesterday).

### manifest_costs

Returns cost in USD, broken down by model.

**Parameters:**
- `period`: `"today"` | `"week"` | `"month"` (default: `"week"`)

**Response:**
```json
{
  "range": "7d",
  "total_cost_usd": 2.45,
  "trend_pct": 15,
  "by_model": [
    { "model": "claude-sonnet-4-5", "cost_usd": 1.80, "input_tokens": 120000, "output_tokens": 35000 },
    { "model": "gpt-4o", "cost_usd": 0.65, "input_tokens": 50000, "output_tokens": 12000 }
  ]
}
```

## When to Use

- "How many tokens today?" -> `manifest_usage({ period: "today" })`
- "What did that cost?" -> `manifest_costs({ period: "today" })`
- "Monthly spending" -> `manifest_costs({ period: "month" })`
- "Am I using more tokens than yesterday?" -> `manifest_usage({ period: "today" })`, check `trend_pct`

## How to Present

Use real numbers. Example: "Today you've consumed 45,230 tokens (34.5k in, 10.7k out) across 12 messages. That's 20% less than yesterday. Cost so far: $0.38 — claude-sonnet-4-5 accounts for 73% of spend."
