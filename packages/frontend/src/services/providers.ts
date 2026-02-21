/* ── LLM Provider definitions (shared by Settings + Routing) ── */

export interface ProviderDef {
  id: string;
  name: string;
  color: string;
  initial: string;
  inputType: "apiKey" | "baseUrl";
  inputLabel: string;
  placeholder: string;
  subtitle: string;
  docsUrl: string;
  models: { label: string; value: string }[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    color: "#10a37f",
    initial: "O",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "sk-...",
    subtitle: "GPT-4o, GPT-4.1, o3, o4",
    docsUrl: "https://platform.openai.com/api-keys",
    models: [
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "GPT-4o Mini", value: "gpt-4o-mini" },
      { label: "GPT-4o (2024-11-20)", value: "gpt-4o-2024-11-20" },
      { label: "GPT-4.1", value: "gpt-4.1" },
      { label: "GPT-4.1 Mini", value: "gpt-4.1-mini" },
      { label: "GPT-4.1 Nano", value: "gpt-4.1-nano" },
      { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
      { label: "GPT-4 Turbo (2024-04-09)", value: "gpt-4-turbo-2024-04-09" },
      { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
      { label: "o3", value: "o3" },
      { label: "o3 Mini", value: "o3-mini" },
      { label: "o4 Mini", value: "o4-mini" },
      { label: "o1", value: "o1" },
      { label: "o1 Mini", value: "o1-mini" },
      { label: "o1 Preview", value: "o1-preview" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    color: "#d97757",
    initial: "A",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "sk-ant-...",
    subtitle: "Claude Opus 4, Sonnet 4.5, Haiku",
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { label: "Claude Opus 4.6", value: "claude-opus-4-6" },
      { label: "Claude Opus 4", value: "claude-opus-4" },
      { label: "Claude Opus 4 (2025-05-14)", value: "claude-opus-4-20250514" },
      { label: "Claude Sonnet 4.5", value: "claude-sonnet-4-5" },
      { label: "Claude Sonnet 4.5", value: "claude-sonnet-4-5-20250929" },
      { label: "Claude Sonnet 4.5 (2025-04-14)", value: "claude-sonnet-4-5-20250414" },
      { label: "Claude Sonnet 4", value: "claude-sonnet-4" },
      { label: "Claude Sonnet 4 (2025-05-14)", value: "claude-sonnet-4-20250514" },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5" },
      { label: "Claude Haiku 4.5 (2025-10-01)", value: "claude-haiku-4-5-20251001" },
      { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-latest" },
      { label: "Claude 3.5 Sonnet (2024-10-22)", value: "claude-3-5-sonnet-20241022" },
      { label: "Claude 3.5 Sonnet (2024-06-20)", value: "claude-3-5-sonnet-20240620" },
      { label: "Claude 3.5 Haiku", value: "claude-3-5-haiku-latest" },
      { label: "Claude 3.5 Haiku (2024-10-22)", value: "claude-3-5-haiku-20241022" },
      { label: "Claude 3 Opus", value: "claude-3-opus-latest" },
      { label: "Claude 3 Opus (2024-02-29)", value: "claude-3-opus-20240229" },
      { label: "Claude 3 Sonnet", value: "claude-3-sonnet-20240229" },
      { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    color: "#4285f4",
    initial: "G",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "AIza...",
    subtitle: "Gemini 2.5, Gemini 2.0 Flash",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
      { label: "Gemini 2.5 Pro (Preview)", value: "gemini-2.5-pro-preview-05-06" },
      { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
      { label: "Gemini 2.5 Flash (Preview)", value: "gemini-2.5-flash-preview-04-17" },
      { label: "Gemini 2.5 Flash Lite", value: "gemini-2.5-flash-lite" },
      { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
      { label: "Gemini 2.0 Flash Lite", value: "gemini-2.0-flash-lite" },
      { label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" },
      { label: "Gemini 1.5 Pro (002)", value: "gemini-1.5-pro-002" },
      { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
      { label: "Gemini 1.5 Flash (002)", value: "gemini-1.5-flash-002" },
      { label: "Gemini 1.5 Flash-8B", value: "gemini-1.5-flash-8b" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    color: "#4d6bfe",
    initial: "D",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "sk-...",
    subtitle: "DeepSeek V3, R1",
    docsUrl: "https://platform.deepseek.com/api_keys",
    models: [
      { label: "DeepSeek V3", value: "deepseek-chat" },
      { label: "DeepSeek V3", value: "deepseek-v3" },
      { label: "DeepSeek V3 (0324)", value: "deepseek-chat-0324" },
      { label: "DeepSeek R1", value: "deepseek-reasoner" },
      { label: "DeepSeek R1", value: "deepseek-r1" },
      { label: "DeepSeek R1 (0528)", value: "deepseek-reasoner-0528" },
      { label: "DeepSeek Coder V2", value: "deepseek-coder" },
      { label: "DeepSeek R1 Distill Qwen 32B", value: "deepseek-r1-distill-qwen-32b" },
      { label: "DeepSeek R1 Distill Llama 70B", value: "deepseek-r1-distill-llama-70b" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    color: "#f97316",
    initial: "M",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "...",
    subtitle: "Mistral Large, Codestral, Pixtral",
    docsUrl: "https://console.mistral.ai/api-keys",
    models: [
      { label: "Mistral Large", value: "mistral-large" },
      { label: "Mistral Large (25.01)", value: "mistral-large-latest" },
      { label: "Mistral Large (24.11)", value: "mistral-large-2411" },
      { label: "Mistral Small", value: "mistral-small" },
      { label: "Mistral Small (25.01)", value: "mistral-small-latest" },
      { label: "Mistral Small (24.09)", value: "mistral-small-2409" },
      { label: "Mistral Medium", value: "mistral-medium-latest" },
      { label: "Codestral", value: "codestral" },
      { label: "Codestral (25.01)", value: "codestral-latest" },
      { label: "Codestral Mamba", value: "codestral-mamba-latest" },
      { label: "Mistral Nemo", value: "open-mistral-nemo" },
      { label: "Pixtral Large", value: "pixtral-large-latest" },
      { label: "Pixtral 12B", value: "pixtral-12b-2409" },
      { label: "Mistral 7B", value: "open-mistral-7b" },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    color: "#000000",
    initial: "X",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "xai-...",
    subtitle: "Grok 3, Grok 2",
    docsUrl: "https://console.x.ai/",
    models: [
      { label: "Grok 3", value: "grok-3" },
      { label: "Grok 3 Mini", value: "grok-3-mini" },
      { label: "Grok 3 Fast", value: "grok-3-fast" },
      { label: "Grok 3 Mini Fast", value: "grok-3-mini-fast" },
      { label: "Grok 2", value: "grok-2" },
      { label: "Grok 2 Mini", value: "grok-2-mini" },
    ],
  },
  {
    id: "qwen",
    name: "Qwen",
    color: "#6236ff",
    initial: "Qw",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "sk-...",
    subtitle: "Qwen3, Qwen2.5, QwQ",
    docsUrl: "https://dashscope.console.aliyun.com/apiKey",
    models: [
      { label: "Qwen3 235B A22B", value: "qwen3-235b-a22b" },
      { label: "Qwen3 32B", value: "qwen3-32b" },
      { label: "Qwen3 14B", value: "qwen3-14b" },
      { label: "Qwen3 8B", value: "qwen3-8b" },
      { label: "Qwen3 4B", value: "qwen3-4b" },
      { label: "Qwen3 1.7B", value: "qwen3-1.7b" },
      { label: "Qwen3 0.6B", value: "qwen3-0.6b" },
      { label: "Qwen2.5 72B Instruct", value: "qwen2.5-72b-instruct" },
      { label: "Qwen2.5 72B Instruct", value: "qwen-2.5-72b-instruct" },
      { label: "Qwen2.5 32B Instruct", value: "qwen2.5-32b-instruct" },
      { label: "Qwen2.5 Coder 32B", value: "qwen2.5-coder-32b-instruct" },
      { label: "Qwen2.5 Coder 32B", value: "qwen-2.5-coder-32b-instruct" },
      { label: "QwQ 32B (Reasoning)", value: "qwq-32b" },
    ],
  },
  {
    id: "moonshot",
    name: "Kimi",
    color: "#1a1a2e",
    initial: "Ki",
    inputType: "apiKey",
    inputLabel: "API Key",
    placeholder: "sk-...",
    subtitle: "Kimi k2, Moonshot v1",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    models: [
      { label: "Kimi k2", value: "kimi-k2" },
      { label: "Moonshot v1 128K", value: "moonshot-v1-128k" },
      { label: "Moonshot v1 32K", value: "moonshot-v1-32k" },
      { label: "Moonshot v1 8K", value: "moonshot-v1-8k" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    color: "#808080",
    initial: "OL",
    inputType: "baseUrl",
    inputLabel: "Base URL",
    placeholder: "http://localhost:11434",
    subtitle: "Run models locally",
    docsUrl: "https://ollama.com/download",
    models: [],
  },
];

/* ── Pipeline stage definitions ────────────────────── */

export interface StageDef {
  id: string;
  step: number;
  label: string;
  desc: string;
}

export const STAGES: StageDef[] = [
  {
    id: "simple",
    step: 1,
    label: "Simple",
    desc: "Repetitive, low-cost tasks that any model can handle.",
  },
  {
    id: "standard",
    step: 2,
    label: "Standard",
    desc: "General-purpose requests that need a good balance of quality and cost.",
  },
  {
    id: "complex",
    step: 3,
    label: "Complex",
    desc: "Tasks requiring high quality, nuance, or multi-step reasoning.",
  },
  {
    id: "reasoning",
    step: 4,
    label: "Reasoning",
    desc: "Advanced reasoning, planning, and critical decision-making.",
  },
];

/* ── localStorage schema ──────────────────────────── */

export interface StageConfig {
  providerId: string;
  model: string;
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface RoutingData {
  providers: Record<string, ProviderConfig>;
  pipeline: Record<string, unknown>;
}

function storageKey(agentName: string): string {
  return `manifest_routing_${agentName}`;
}

export function loadRouting(agentName: string): RoutingData {
  try {
    const raw = localStorage.getItem(storageKey(agentName));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { providers: parsed.providers ?? {}, pipeline: parsed.pipeline ?? {} };
    }
  } catch {
    // ignore
  }
  return { providers: {}, pipeline: {} };
}

export function saveRouting(agentName: string, data: RoutingData): void {
  localStorage.setItem(storageKey(agentName), JSON.stringify(data));
}

/* ── Helpers ──────────────────────────────────────── */

export function isProviderActive(data: RoutingData, provId: string): boolean {
  const cfg = data.providers[provId];
  return !!(cfg && (cfg.apiKey || cfg.baseUrl));
}

export function activeProviderIds(data: RoutingData): string[] {
  return PROVIDERS.filter((p) => isProviderActive(data, p.id)).map((p) => p.id);
}

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function getModelLabel(providerId: string, modelValue: string): string {
  const prov = getProvider(providerId);
  if (!prov) return modelValue;
  // Exact match
  const exact = prov.models.find((m) => m.value === modelValue);
  if (exact) return exact.label;
  // Strip date suffix (e.g. "-20250929") and try again
  const stripped = modelValue.replace(/-\d{8}$/, "");
  if (stripped !== modelValue) {
    const m = prov.models.find((m) => m.value === stripped);
    if (m) return m.label;
  }
  // Prefix match: modelValue starts with a known value
  const prefix = prov.models.find((m) => modelValue.startsWith(m.value + "-"));
  if (prefix) return prefix.label;
  return modelValue;
}

/* ── Auto-assignment ─────────────────────────────── */

/** Best model per tier per provider (cheapest capable model for the tier). */
const TIER_PICKS: Record<string, Record<string, string>> = {
  openai: {
    simple: "gpt-4.1-nano",
    standard: "gpt-4o-mini",
    complex: "gpt-4.1",
    reasoning: "o3",
  },
  anthropic: {
    simple: "claude-haiku-4-5",
    standard: "claude-sonnet-4",
    complex: "claude-sonnet-4-5",
    reasoning: "claude-opus-4",
  },
  gemini: {
    simple: "gemini-2.0-flash-lite",
    standard: "gemini-2.0-flash",
    complex: "gemini-2.5-flash",
    reasoning: "gemini-2.5-pro",
  },
  deepseek: {
    simple: "deepseek-chat",
    standard: "deepseek-chat",
    complex: "deepseek-chat",
    reasoning: "deepseek-reasoner",
  },
  mistral: {
    simple: "mistral-small-latest",
    standard: "open-mistral-nemo",
    complex: "mistral-large-latest",
    reasoning: "mistral-large-latest",
  },
  xai: {
    simple: "grok-3-mini-fast",
    standard: "grok-3-mini",
    complex: "grok-3-fast",
    reasoning: "grok-3",
  },
  qwen: {
    simple: "qwen3-4b",
    standard: "qwen3-14b",
    complex: "qwen3-32b",
    reasoning: "qwen3-235b-a22b",
  },
  moonshot: {
    simple: "moonshot-v1-8k",
    standard: "moonshot-v1-32k",
    complex: "kimi-k2",
    reasoning: "kimi-k2",
  },
};

/** Provider ordering by rough cost (cheapest first). */
const COST_ORDER: string[] = [
  "deepseek", "qwen", "moonshot", "gemini", "mistral", "openai", "xai", "anthropic",
];

/**
 * For each tier, returns the cheapest recommended model across all connected
 * providers. Returns a map of stageId → StageConfig.
 */
export function getAutoAssignment(data: RoutingData): Record<string, StageConfig> {
  const active = activeProviderIds(data);
  const sorted = COST_ORDER.filter((id) => active.includes(id));
  const result: Record<string, StageConfig> = {};

  for (const stage of STAGES) {
    for (const provId of sorted) {
      const modelValue = TIER_PICKS[provId]?.[stage.id];
      if (modelValue) {
        result[stage.id] = { providerId: provId, model: modelValue };
        break;
      }
    }
  }
  return result;
}
