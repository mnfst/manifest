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
/**
 * Which Manifest entry point the profile targets. Defaults to chat completions
 * for back-compat. `messages` targets `/v1/messages` (Anthropic Messages API)
 * so Anthropic-SDK clients can be tested against the proxy.
 */
export type ProfileApiMode = 'chat_completions' | 'messages';

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
  /**
   * Manifest entry point this profile hits. Omitting defaults to
   * `chat_completions` (the `/v1/chat/completions` path). Set to `messages`
   * for Anthropic-shape clients that hit `/v1/messages`.
   */
  apiMode?: ProfileApiMode;
  headers: (params: ProfileParams) => Record<string, string>;
  body: (params: ProfileParams) => Record<string, unknown>;
  code: (params: ProfileParams, lang: ProfileLang) => string;
}

/** Returns the proxy path for a profile, defaulting to chat completions. */
export function profilePath(profile: Pick<Profile, 'apiMode'>): string {
  return profile.apiMode === 'messages' ? '/v1/messages' : '/v1/chat/completions';
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

function anthropicBody(params: ProfileParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? 1024,
    messages: [{ role: 'user', content: params.userMessage }],
  };
  if (params.systemPrompt.trim()) {
    body.system = params.systemPrompt;
  }
  if (params.temperature !== undefined) {
    body.temperature = params.temperature;
  }
  return body;
}

const anthropicSdkHeaders = {
  // Mirror the stainless fingerprint @anthropic-ai/sdk sends. Anthropic doesn't
  // require these for forwarding; they make Manifest's request log look like
  // what a real SDK client would produce.
  'User-Agent': 'Anthropic/JS 0.40.1',
  'X-Stainless-Lang': 'js',
  'X-Stainless-Package-Version': '0.40.1',
  'X-Stainless-OS': 'Linux',
  'X-Stainless-Arch': 'x64',
  'X-Stainless-Runtime': 'node',
  'X-Stainless-Runtime-Version': 'v22.17.1',
  'X-Stainless-Retry-Count': '0',
  'anthropic-version': '2023-06-01',
  'accept-language': '*',
  'sec-fetch-mode': 'cors',
};

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
    blurb: 'AI agent — stainless JS headers + OpenClaw system prompt.',
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
    blurb: 'AI agent — stainless Python headers + Hermes system prompt.',
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
    id: 'anthropic-sdk',
    label: 'Anthropic SDK',
    mode: 'sdk',
    category: 'app',
    blurb: 'Official Anthropic client (TypeScript or Python). Targets /v1/messages.',
    icon: '/icons/providers/anthropic.svg',
    langs: ['typescript', 'python'],
    defaultLang: 'typescript',
    headersLocked: true,
    apiMode: 'messages',
    headers: () => ({ ...anthropicSdkHeaders }),
    body: anthropicBody,
    code: (p, lang) => {
      if (lang === 'python') {
        // Anthropic's SDK has two auth options: api_key (sends X-Api-Key) and
        // auth_token (sends Authorization: Bearer). Manifest's proxy reads
        // Authorization, so use auth_token — api_key wouldn't reach the
        // AgentKeyAuthGuard at all.
        return `from anthropic import Anthropic

client = Anthropic(
    base_url="${p.baseUrl}",
    auth_token="${p.apiKey || 'mnfst_YOUR_KEY'}",
)

response = client.messages.create(
    model="${p.model}",
    max_tokens=${p.maxTokens ?? 1024},
    ${p.systemPrompt.trim() ? `system=${JSON.stringify(p.systemPrompt)},\n    ` : ''}messages=[{"role": "user", "content": ${JSON.stringify(p.userMessage)}}],
)
print(response.content[0].text)`;
      }
      return `import Anthropic from "@anthropic-ai/sdk";

// Manifest accepts the API key via Authorization: Bearer. The Anthropic SDK's
// apiKey option maps to X-Api-Key — use authToken instead to hit Bearer.
const client = new Anthropic({
  baseURL: "${p.baseUrl}",
  authToken: "${p.apiKey || 'mnfst_YOUR_KEY'}",
});

const response = await client.messages.create({
  model: "${p.model}",
  max_tokens: ${p.maxTokens ?? 1024},
  ${p.systemPrompt.trim() ? `system: ${JSON.stringify(p.systemPrompt)},\n  ` : ''}messages: [{ role: "user", content: ${JSON.stringify(p.userMessage)} }],
});
console.log(response.content[0].type === "text" ? response.content[0].text : "");`;
    },
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
