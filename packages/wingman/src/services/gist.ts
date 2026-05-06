import type { SendResult } from '../send';

export interface GistContext {
  profileLabel: string;
  profileCategory: string;
  systemPrompt: string;
  userMessage: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const NEW_GIST_URL = 'https://gist.github.com/';

function redactApiKey(key: string): string {
  if (!key) return '(none)';
  if (key.length <= 8) return '***';
  return `${key.slice(0, 8)}…${key.slice(-2)}`;
}

function redactAuthHeader(value: string): string {
  return value.replace(/(Bearer\s+)([^\s]+)/i, (_, p1, token: string) => p1 + redactApiKey(token));
}

function formatHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return '(none)';
  return entries
    .map(([k, v]) => {
      const value = k.toLowerCase() === 'authorization' ? redactAuthHeader(v) : v;
      return `${k}: ${value}`;
    })
    .join('\n');
}

function prettyJson(raw: string, parsed: unknown): string {
  if (parsed && typeof parsed === 'object') {
    return JSON.stringify(parsed, null, 2);
  }
  return raw || '(empty)';
}

function extractAssistantText(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const choices = (json as Record<string, unknown>).choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
    if (first?.message && typeof first.message.content === 'string') return first.message.content;
    if (typeof first?.text === 'string') return first.text;
  }
  return null;
}

function extractUsage(json: unknown): { in?: number; out?: number; total?: number } | null {
  if (!json || typeof json !== 'object') return null;
  const usage = (json as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    in: num(u.prompt_tokens) ?? num(u.input_tokens),
    out: num(u.completion_tokens) ?? num(u.output_tokens),
    total: num(u.total_tokens),
  };
}

function extractModel(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const m = (json as Record<string, unknown>).model;
  return typeof m === 'string' ? m : null;
}

function statusEmoji(result: SendResult): string {
  if (result.status === 0) return '🌐';
  if (result.ok) return '✅';
  if (result.status >= 500) return '🔥';
  return '⚠️';
}

export function buildMarkdownReport(ctx: GistContext, result: SendResult): string {
  const usage = extractUsage(result.responseJson);
  const model = extractModel(result.responseJson);
  const assistant = extractAssistantText(result.responseJson);
  const statusLine =
    result.status === 0
      ? '`NETWORK` — request did not reach the server'
      : `\`${result.status} ${result.statusText}\``;
  const tokens =
    usage && (usage.in !== undefined || usage.out !== undefined || usage.total !== undefined)
      ? `${usage.total ?? '—'} total · ${usage.in ?? '—'} in / ${usage.out ?? '—'} out`
      : '—';
  const requestHeadersRedacted: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.requestHeaders)) {
    requestHeadersRedacted[k] = k.toLowerCase() === 'authorization' ? redactAuthHeader(v) : v;
  }

  const lines: string[] = [];
  lines.push(`# Manifest Wingman — request report`);
  lines.push('');
  lines.push(`${statusEmoji(result)} **${ctx.profileLabel}** → ${result.url}`);
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push(`| **Profile** | ${ctx.profileLabel} _(${ctx.profileCategory})_ |`);
  lines.push(`| **Status** | ${statusLine} |`);
  lines.push(`| **Latency** | ${result.durationMs.toFixed(0)} ms |`);
  lines.push(`| **Model returned** | ${model ? `\`${model}\`` : '—'} |`);
  lines.push(`| **Tokens** | ${tokens} |`);
  lines.push(`| **Base URL** | \`${ctx.baseUrl}\` |`);
  lines.push(`| **Model requested** | \`${ctx.model}\` |`);
  lines.push(`| **API key** | \`${redactApiKey(ctx.apiKey)}\` |`);
  lines.push(`| **Captured at** | ${new Date().toISOString()} |`);
  lines.push('');

  if (result.error) {
    lines.push('## Error');
    lines.push('');
    lines.push('```');
    lines.push(result.error);
    lines.push('```');
    lines.push('');
  }

  if (assistant) {
    lines.push('## Assistant message');
    lines.push('');
    lines.push(
      assistant
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n'),
    );
    lines.push('');
  }

  if (ctx.systemPrompt.trim()) {
    lines.push('## System prompt');
    lines.push('');
    lines.push('```');
    lines.push(ctx.systemPrompt);
    lines.push('```');
    lines.push('');
  }

  lines.push('## User message');
  lines.push('');
  lines.push('```');
  lines.push(ctx.userMessage);
  lines.push('```');
  lines.push('');

  lines.push('## Request');
  lines.push('');
  lines.push('### Headers');
  lines.push('');
  lines.push('```http');
  lines.push(formatHeaders(requestHeadersRedacted));
  lines.push('```');
  lines.push('');
  lines.push('### Body');
  lines.push('');
  lines.push('```json');
  lines.push(result.requestBody || '(empty)');
  lines.push('```');
  lines.push('');

  lines.push('## Response');
  lines.push('');
  lines.push('### Headers');
  lines.push('');
  lines.push('```http');
  lines.push(formatHeaders(result.responseHeaders));
  lines.push('```');
  lines.push('');
  lines.push('### Body');
  lines.push('');
  lines.push('```json');
  lines.push(prettyJson(result.responseBody, result.responseJson));
  lines.push('```');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(
    '_Generated by [Manifest Wingman](https://manifest.build) — gateway tester for contributors._',
  );
  return lines.join('\n');
}

export const NEW_GIST_TARGET_URL = NEW_GIST_URL;
