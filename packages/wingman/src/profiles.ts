// Verbatim system prompts captured from the real OpenClaw and Hermes CLIs
// (see mnfst/team-skills `agent-request/templates/`). Several KB each —
// kept in their own modules so profiles.ts stays scannable. Personal paths
// and the host name in the OpenClaw capture are redacted to generic values;
// everything else is byte-for-byte identical to what the gateway receives
// from a real client.
import { OPENCLAW_SYSTEM } from './templates/openclaw-system';
import { HERMES_SYSTEM } from './templates/hermes-system';

export type ProfileMode = 'agent' | 'sdk' | 'raw';
export type ProfileLang = 'typescript' | 'python' | 'bash';

export interface ProfileParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Profile {
  id: string;
  label: string;
  mode: ProfileMode;
  category: 'personal' | 'app' | 'raw';
  blurb: string;
  icon: string;
  langs: ProfileLang[];
  defaultLang: ProfileLang;
  defaultSystemPrompt?: string;
  /**
   * When true, the Headers panel is hidden — the profile simulates a real
   * SDK/agent fingerprint and arbitrary header editing would defeat that.
   * cURL and Raw set this to false because their whole point is hand-crafted
   * requests.
   */
  headersLocked?: boolean;
  /**
   * When true, the SDK code editor can actually drive the request: editing
   * the code and hitting Send executes it via stubbed SDKs. Currently only
   * the TypeScript SDK profiles can do this — Python needs Pyodide.
   */
  executable?: boolean;
  headers: (params: ProfileParams) => Record<string, string>;
  body: (params: ProfileParams) => Record<string, unknown>;
  code: (params: ProfileParams, lang: ProfileLang) => string;
}

function messages(params: ProfileParams) {
  const list: Array<{ role: string; content: string }> = [];
  if (params.systemPrompt.trim()) {
    list.push({ role: 'system', content: params.systemPrompt });
  }
  list.push({ role: 'user', content: params.userMessage });
  return list;
}

function jsonBody(body: unknown, indent = 2): string {
  return JSON.stringify(body, null, indent);
}

const stainlessJs = {
  'User-Agent': 'OpenAI/JS 6.26.0',
  'X-Stainless-Lang': 'js',
  'X-Stainless-Package-Version': '6.26.0',
  'X-Stainless-OS': 'Linux',
  'X-Stainless-Arch': 'x64',
  'X-Stainless-Runtime': 'node',
  'X-Stainless-Runtime-Version': 'v22.17.1',
  'X-Stainless-Retry-Count': '0',
  'accept-language': '*',
  'sec-fetch-mode': 'cors',
};

const stainlessPython = {
  'User-Agent': 'OpenAI/Python 2.31.0',
  'X-Stainless-Lang': 'python',
  'X-Stainless-Package-Version': '2.31.0',
  'X-Stainless-OS': 'Linux',
  'X-Stainless-Arch': 'x64',
  'X-Stainless-Runtime': 'CPython',
  'X-Stainless-Runtime-Version': '3.11.14',
  'X-Stainless-Async': 'false',
  'x-stainless-retry-count': '0',
  'x-stainless-read-timeout': '60.0',
};

export const PROFILES: Profile[] = [
  {
    id: 'openclaw',
    label: 'OpenClaw',
    mode: 'agent',
    category: 'personal',
    blurb: 'Personal AI agent — stainless JS headers + OpenClaw system prompt.',
    icon: '/icons/openclaw.png',
    langs: ['bash'],
    defaultLang: 'bash',
    defaultSystemPrompt: OPENCLAW_SYSTEM,
    headersLocked: true,
    headers: () => ({ ...stainlessJs }),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
      stream: false,
      store: false,
      max_completion_tokens: p.maxTokens ?? 8192,
    }),
    code: (p) => `# OpenClaw routes through its built-in OpenAI-compatible client.
# Configure once with the CLI:
openclaw config set models.providers.manifest '{"baseUrl":"${p.baseUrl}/v1","api":"openai-completions","apiKey":"${p.apiKey || 'mnfst_YOUR_KEY'}","models":[{"id":"${p.model}","name":"Manifest Auto"}]}'
openclaw config set agents.defaults.model.primary manifest/${p.model}
openclaw gateway restart`,
  },
  {
    id: 'hermes',
    label: 'Hermes Agent',
    mode: 'agent',
    category: 'personal',
    blurb: 'Personal AI agent — stainless Python headers + Hermes system prompt.',
    icon: '/icons/hermes.png',
    langs: ['bash'],
    defaultLang: 'bash',
    defaultSystemPrompt: HERMES_SYSTEM,
    headersLocked: true,
    headers: () => ({ ...stainlessPython }),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
      stream: false,
    }),
    code: (p) => `# Hermes reads its provider from ~/.hermes/config.yaml:
cat <<EOF > ~/.hermes/config.yaml
model:
  provider: custom
  base_url: ${p.baseUrl}/v1
  api_key: ${p.apiKey || 'mnfst_YOUR_KEY'}
  default: ${p.model}
EOF
hermes chat -q '${p.userMessage.replace(/'/g, "'\\''")}'`,
  },
  {
    id: 'openai-sdk',
    label: 'OpenAI SDK',
    mode: 'sdk',
    category: 'app',
    blurb: 'Official OpenAI client (TypeScript or Python).',
    icon: '/icons/providers/openai.svg',
    langs: ['typescript', 'python'],
    defaultLang: 'typescript',
    headersLocked: true,
    executable: true,
    headers: () => ({ ...stainlessJs }),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
    }),
    code: (p, lang) => {
      if (lang === 'python') {
        return `from openai import OpenAI

client = OpenAI(
    base_url="${p.baseUrl}/v1",
    api_key="${p.apiKey || 'mnfst_YOUR_KEY'}",
)

response = client.chat.completions.create(
    model="${p.model}",
    messages=${jsonBody(messages(p), 4).replace(/\n/g, '\n    ')},
)
print(response.choices[0].message.content)`;
      }
      return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${p.baseUrl}/v1",
  apiKey: "${p.apiKey || 'mnfst_YOUR_KEY'}",
});

const response = await client.chat.completions.create({
  model: "${p.model}",
  messages: ${jsonBody(messages(p), 2).replace(/\n/g, '\n  ')},
});
console.log(response.choices[0].message.content);`;
    },
  },
  {
    id: 'vercel-ai-sdk',
    label: 'Vercel AI SDK',
    mode: 'sdk',
    category: 'app',
    blurb: 'Vercel AI SDK with the OpenAI provider pointed at Manifest.',
    icon: '/icons/vercel.svg',
    langs: ['typescript'],
    defaultLang: 'typescript',
    headersLocked: true,
    executable: true,
    headers: () => ({
      'User-Agent': 'ai-sdk/5.0.0 (Node.js v22.17.1)',
    }),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
    }),
    code: (p) => `import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const manifest = createOpenAI({
  baseURL: "${p.baseUrl}/v1",
  apiKey: "${p.apiKey || 'mnfst_YOUR_KEY'}",
});

const { text } = await generateText({
  model: manifest("${p.model}"),
  ${p.systemPrompt ? `system: ${JSON.stringify(p.systemPrompt)},\n  ` : ''}prompt: ${JSON.stringify(p.userMessage)},
});
console.log(text);`,
  },
  {
    id: 'langchain',
    label: 'LangChain',
    mode: 'sdk',
    category: 'app',
    blurb: 'LangChain with the OpenAI-compatible chat model.',
    icon: '/icons/langchain.png',
    langs: ['python', 'typescript'],
    defaultLang: 'python',
    headersLocked: true,
    executable: true,
    headers: () => ({
      'User-Agent': 'langchain-python/0.3.0',
    }),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
    }),
    code: (p, lang) => {
      if (lang === 'typescript') {
        return `import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  model: "${p.model}",
  apiKey: "${p.apiKey || 'mnfst_YOUR_KEY'}",
  configuration: { baseURL: "${p.baseUrl}/v1" },
});

const response = await llm.invoke(${JSON.stringify(messages(p), null, 2).replace(/\n/g, '\n  ')});
console.log(response.content);`;
      }
      return `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="${p.baseUrl}/v1",
    api_key="${p.apiKey || 'mnfst_YOUR_KEY'}",
    model="${p.model}",
)

response = llm.invoke(${jsonBody(messages(p), 4).replace(/\n/g, '\n    ')})
print(response.content)`;
    },
  },
  {
    id: 'curl',
    label: 'cURL',
    mode: 'sdk',
    category: 'app',
    blurb: 'Raw HTTP via cURL — no SDK fingerprint.',
    icon: '/icons/other.svg',
    langs: ['bash'],
    defaultLang: 'bash',
    headers: () => ({
      'User-Agent': 'curl/8.6.0',
    }),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
    }),
    code: (p) => `curl -sS -X POST ${p.baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${p.apiKey || 'mnfst_YOUR_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '${jsonBody(
    {
      model: p.model,
      messages: messages(p),
    },
    2,
  ).replace(/'/g, "'\\''")}'`,
  },
  {
    id: 'raw',
    label: 'Raw / None',
    mode: 'raw',
    category: 'raw',
    blurb: 'Minimal fetch — no SDK headers. Useful for baseline measurements.',
    icon: '/icons/other-agent.svg',
    langs: ['bash'],
    defaultLang: 'bash',
    headers: () => ({}),
    body: (p) => ({
      model: p.model,
      messages: messages(p),
    }),
    code: (p) => `# Plain fetch — no User-Agent override.
fetch("${p.baseUrl}/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${p.apiKey || 'mnfst_YOUR_KEY'}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${jsonBody({ model: p.model, messages: messages(p) }, 2).replace(/\n/g, '\n  ')}),
});`,
  },
];

export const PROFILE_BY_ID: Record<string, Profile> = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
);
