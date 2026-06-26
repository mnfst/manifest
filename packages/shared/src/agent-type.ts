export const AGENT_CATEGORIES = ['personal', 'app', 'coding'] as const;
export type AgentCategory = (typeof AGENT_CATEGORIES)[number];

export const AGENT_PLATFORMS = [
  'openclaw',
  'hermes',
  'nanobot',
  'craft',
  'claude-code',
  'opencode',
  'warp',
  'pi',
  'openai-sdk',
  'anthropic-sdk',
  'vercel-ai-sdk',
  'langchain',
  'curl',
  'other',
] as const;
export type AgentPlatform = (typeof AGENT_PLATFORMS)[number];

export const CATEGORY_LABELS: Readonly<Record<AgentCategory, string>> = {
  personal: 'AI agents',
  app: 'App AI SDK',
  coding: 'Coding Assistant',
};

export const PLATFORM_LABELS: Readonly<Record<AgentPlatform, string>> = {
  openclaw: 'OpenClaw',
  hermes: 'Hermes Agent',
  nanobot: 'Nanobot',
  craft: 'Craft Agent',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
  warp: 'Warp',
  pi: 'Pi',
  'openai-sdk': 'OpenAI SDK',
  'anthropic-sdk': 'Anthropic SDK',
  'vercel-ai-sdk': 'Vercel AI SDK',
  langchain: 'LangChain',
  curl: 'cURL',
  other: 'Other',
};

export const PLATFORMS_BY_CATEGORY: Readonly<Record<AgentCategory, readonly AgentPlatform[]>> = {
  personal: ['openclaw', 'hermes', 'nanobot', 'craft', 'other'],
  app: ['openai-sdk', 'anthropic-sdk', 'vercel-ai-sdk', 'langchain', 'other'],
  coding: ['claude-code', 'opencode', 'warp', 'pi', 'other'],
};

export const PLATFORM_ICONS: Readonly<Partial<Record<AgentPlatform, string>>> = {
  openclaw: '/icons/openclaw.svg',
  hermes: '/icons/hermes.svg',
  nanobot: '/icons/nanobot.png',
  craft: '/icons/craft.png',
  'claude-code': '/icons/providers/claude-code.svg',
  opencode: '/icons/providers/opencode.svg',
  warp: '/icons/other.svg',
  pi: '/icons/other.svg',
  'openai-sdk': '/icons/providers/openai.svg',
  'anthropic-sdk': '/icons/providers/anthropic.svg',
  'vercel-ai-sdk': '/icons/vercel.svg',
  langchain: '/icons/langchain.svg',
  other: '/icons/other.svg',
};

export function platformIcon(
  platform: string | null | undefined,
  category: string | null | undefined,
): string | undefined {
  if (!platform) return undefined;
  if (platform === 'other') {
    return category === 'personal' ? '/icons/other-agent.svg' : '/icons/other.svg';
  }
  // Object.hasOwn so a hostile string like "__proto__" or "constructor" can't
  // resolve to a value on Object.prototype.
  if (!Object.hasOwn(PLATFORM_ICONS, platform)) return undefined;
  return PLATFORM_ICONS[platform as AgentPlatform];
}
