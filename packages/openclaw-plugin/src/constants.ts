// Span names
export const SPANS = {
  REQUEST: "openclaw.request",
  AGENT_TURN: "openclaw.agent.turn",
  TOOL_PREFIX: "tool.",
} as const;

// Metric names
export const METRICS = {
  LLM_REQUESTS: "openclaw.llm.requests",
  LLM_TOKENS_INPUT: "openclaw.llm.tokens.input",
  LLM_TOKENS_OUTPUT: "openclaw.llm.tokens.output",
  LLM_TOKENS_CACHE_READ: "openclaw.llm.tokens.cache_read",
  LLM_DURATION: "openclaw.llm.duration",
  TOOL_CALLS: "openclaw.tool.calls",
  TOOL_ERRORS: "openclaw.tool.errors",
  TOOL_DURATION: "openclaw.tool.duration",
  MESSAGES_RECEIVED: "openclaw.messages.received",
} as const;

// Attribute keys
export const ATTRS = {
  SESSION_KEY: "openclaw.session.key",
  CHANNEL: "openclaw.message.channel",
  MODEL: "gen_ai.request.model",
  PROVIDER: "gen_ai.system",
  INPUT_TOKENS: "gen_ai.usage.input_tokens",
  OUTPUT_TOKENS: "gen_ai.usage.output_tokens",
  CACHE_READ_TOKENS: "gen_ai.usage.cache_read.input_tokens",
  CACHE_WRITE_TOKENS: "gen_ai.usage.cache_write.input_tokens",
  TOOL_NAME: "tool.name",
  TOOL_SUCCESS: "tool.success",
  AGENT_NAME: "openclaw.agent.name",
  ROUTING_TIER: "manifest.routing.tier",
} as const;

// Environment variable names (fallback when plugin config is missing)
export const ENV = {
  API_KEY: "MANIFEST_API_KEY",
  ENDPOINT: "MANIFEST_ENDPOINT",
} as const;

// API key prefix — must match the backend's API_KEY_PREFIX
export const API_KEY_PREFIX = "mnfst_" as const;

// Plugin defaults
export const DEFAULTS = {
  ENDPOINT: "https://app.manifest.build/otlp",
  SERVICE_NAME: "openclaw-gateway",
  METRICS_INTERVAL_MS: 30_000,
} as const;

export const LOCAL_DEFAULTS = {
  METRICS_INTERVAL_MS: 10_000,
} as const;

export const DEV_DEFAULTS = {
  METRICS_INTERVAL_MS: 10_000,
} as const;
