export const AGENT_CATEGORIES = ['personal', 'app'] as const;
export type AgentCategory = (typeof AGENT_CATEGORIES)[number];

export const AGENT_PLATFORMS = [
  'openclaw',
  'hermes',
  'openai-sdk',
  'vercel-ai-sdk',
  'langchain',
  'curl',
  'other',
] as const;
export type AgentPlatform = (typeof AGENT_PLATFORMS)[number];

export const CATEGORY_LABELS: Readonly<Record<AgentCategory, string>> = {
  personal: 'Personal AI Agent',
  app: 'App AI SDK',
};

export const PLATFORM_LABELS: Readonly<Record<AgentPlatform, string>> = {
  openclaw: 'OpenClaw',
  hermes: 'Hermes Agent',
  'openai-sdk': 'OpenAI SDK',
  'vercel-ai-sdk': 'Vercel AI SDK',
  langchain: 'LangChain',
  curl: 'cURL',
  other: 'Other',
};

export const PLATFORMS_BY_CATEGORY: Readonly<Record<AgentCategory, readonly AgentPlatform[]>> = {
  personal: ['openclaw', 'hermes', 'other'],
  app: ['openai-sdk', 'vercel-ai-sdk', 'langchain', 'other'],
};

export const PLATFORM_ICONS: Readonly<Partial<Record<AgentPlatform, string>>> = {
  openclaw: '/icons/openclaw.png',
  hermes: '/icons/hermes.png',
  'openai-sdk': '/icons/providers/openai.svg',
  'vercel-ai-sdk': '/icons/vercel.svg',
  langchain: '/icons/langchain.png',
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
  return PLATFORM_ICONS[platform as AgentPlatform];
}
