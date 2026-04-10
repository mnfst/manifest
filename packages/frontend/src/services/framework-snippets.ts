export type FrameworkId = 'python' | 'typescript' | 'openclaw' | 'curl';

export interface FrameworkTab {
  id: FrameworkId;
  label: string;
}

export const FRAMEWORK_TABS: FrameworkTab[] = [
  { id: 'python', label: 'Python' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'openclaw', label: 'OpenClaw' },
  { id: 'curl', label: 'cURL' },
];

export type ToolkitId = 'openai-sdk' | 'vercel-ai-sdk' | 'langchain' | 'curl';
export type OpenAILangId = 'python' | 'typescript';

export interface ToolkitTab {
  id: ToolkitId;
  label: string;
  icon?: string;
}

export const TOOLKIT_TABS: ToolkitTab[] = [
  { id: 'openai-sdk', label: 'OpenAI SDK', icon: '/icons/providers/openai.svg' },
  { id: 'vercel-ai-sdk', label: 'Vercel AI SDK', icon: '/icons/vercel.svg' },
  { id: 'langchain', label: 'LangChain', icon: '/icons/langchain.png' },
  { id: 'curl', label: 'cURL' },
];

export interface OpenAILangTab {
  id: OpenAILangId;
  label: string;
  icon: string;
}

export const SDK_LANG_TOGGLE: OpenAILangTab[] = [
  { id: 'python', label: 'Python', icon: '/icons/python.svg' },
  { id: 'typescript', label: 'TypeScript', icon: '/icons/typescript.svg' },
];

/** @deprecated Use SDK_LANG_TOGGLE instead */
export const OPENAI_SDK_LANGS = SDK_LANG_TOGGLE;

export interface Snippet {
  title: string;
  code: string;
}

const STORAGE_KEY = 'manifest_setup_framework';
const TOOLKIT_STORAGE_KEY = 'manifest_setup_toolkit';
const OPENAI_LANG_STORAGE_KEY = 'manifest_setup_openai_lang';

export function getStoredFramework(): FrameworkId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FRAMEWORK_TABS.some((t) => t.id === stored)) return stored as FrameworkId;
  } catch {
    /* localStorage unavailable */
  }
  return 'python';
}

export function storeFramework(id: FrameworkId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* localStorage unavailable */
  }
}

export function getPythonSnippets(baseUrl: string, apiKey: string): Snippet[] {
  return [
    {
      title: 'LangChain',
      code: `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}",
    model="auto",
)`,
    },
    {
      title: 'OpenAI Python SDK',
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}",
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)`,
    },
  ];
}

export function getVercelPythonSnippet(baseUrl: string, apiKey: string): Snippet {
  return {
    title: 'Vercel AI SDK (Python)',
    code: `# pip install ai-sdk
from ai_sdk import AIClient

client = AIClient(
    base_url="${baseUrl}",
    api_key="${apiKey}",
)

response = client.generate_text(
    model="auto",
    prompt="Hello",
)`,
  };
}

export function getTypeScriptSnippets(baseUrl: string, apiKey: string): Snippet[] {
  return [
    {
      title: 'Vercel AI SDK',
      code: `import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const manifest = createOpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${apiKey}",
});

const { text } = await generateText({
  model: manifest("auto"),
  prompt: "Hello",
});`,
    },
    {
      title: 'OpenAI TypeScript SDK',
      code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${apiKey}",
});

const response = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});`,
    },
  ];
}

export function getOpenClawSnippet(baseUrl: string, apiKey: string): string {
  const providerJson = JSON.stringify({
    baseUrl,
    api: 'openai-completions',
    apiKey,
    models: [{ id: 'auto', name: 'Manifest Auto' }],
  });
  return `openclaw config set models.providers.manifest '${providerJson}'
openclaw config set agents.defaults.model.primary manifest/auto
openclaw gateway restart`;
}

export function getOpenClawDisableSnippet(model: string): string {
  return `openclaw config unset models.providers.manifest
openclaw config unset agents.defaults.models.manifest/auto
openclaw config set agents.defaults.model.primary ${model}
openclaw gateway restart`;
}

export function getCurlSnippet(baseUrl: string, apiKey: string): Snippet[] {
  return [
    {
      title: 'cURL',
      code: `curl -X POST ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    },
  ];
}

export function getSnippetsForFramework(
  id: FrameworkId,
  baseUrl: string,
  apiKey: string,
): Snippet[] {
  switch (id) {
    case 'python':
      return getPythonSnippets(baseUrl, apiKey);
    case 'typescript':
      return getTypeScriptSnippets(baseUrl, apiKey);
    case 'openclaw':
      return [{ title: 'OpenClaw CLI', code: getOpenClawSnippet(baseUrl, apiKey) }];
    case 'curl':
      return getCurlSnippet(baseUrl, apiKey);
  }
}

export function getStoredToolkit(): ToolkitId {
  try {
    const stored = localStorage.getItem(TOOLKIT_STORAGE_KEY);
    if (stored && TOOLKIT_TABS.some((t) => t.id === stored)) return stored as ToolkitId;
  } catch {
    /* localStorage unavailable */
  }
  return 'openai-sdk';
}

export function storeToolkit(id: ToolkitId): void {
  try {
    localStorage.setItem(TOOLKIT_STORAGE_KEY, id);
  } catch {
    /* localStorage unavailable */
  }
}

export function getStoredOpenAILang(): OpenAILangId {
  try {
    const stored = localStorage.getItem(OPENAI_LANG_STORAGE_KEY);
    if (stored === 'python' || stored === 'typescript') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'python';
}

export function storeOpenAILang(id: OpenAILangId): void {
  try {
    localStorage.setItem(OPENAI_LANG_STORAGE_KEY, id);
  } catch {
    /* localStorage unavailable */
  }
}

export function getSnippetForToolkit(
  id: ToolkitId,
  baseUrl: string,
  apiKey: string,
  openaiLang: OpenAILangId = 'python',
): Snippet {
  switch (id) {
    case 'openai-sdk':
      return openaiLang === 'python'
        ? getPythonSnippets(baseUrl, apiKey)[1]!
        : getTypeScriptSnippets(baseUrl, apiKey)[1]!;
    case 'vercel-ai-sdk':
      return openaiLang === 'python'
        ? getVercelPythonSnippet(baseUrl, apiKey)
        : getTypeScriptSnippets(baseUrl, apiKey)[0]!;
    case 'langchain':
      return getPythonSnippets(baseUrl, apiKey)[0]!;
    case 'curl':
      return getCurlSnippet(baseUrl, apiKey)[0]!;
  }
}

export function getLangForToolkit(id: ToolkitId, openaiLang?: OpenAILangId): string {
  switch (id) {
    case 'openai-sdk':
      return openaiLang === 'typescript' ? 'typescript' : 'python';
    case 'vercel-ai-sdk':
      return openaiLang === 'typescript' ? 'typescript' : 'python';
    case 'langchain':
      return 'python';
    case 'curl':
      return 'bash';
  }
}

export function getOpenClawWizardSnippet(): string {
  return 'openclaw onboard';
}
