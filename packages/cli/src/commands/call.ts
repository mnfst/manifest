import { CliIo, printJson } from '../context';
import { CliError } from '../errors';
import { parseArgs } from '../args';
import { slugifyAgentName } from '../slug';
import { resolveAgentKey } from './agent';
import { resolveDiscoveryAgent } from './provider';

const CALL_TIMEOUT_MS = 120_000;

/**
 * Make an LLM call through Manifest — the shortest path from "an agent needs
 * a completion" to routed, observed, fallback-protected traffic:
 *
 *   mnfst call "explain this error: ..."             # routed (model=auto)
 *   mnfst call --model grok-4.5 "hard question"      # explicit model
 *   mnfst call --tier thorough "escalate this one"   # custom tier header
 *   cat diff.patch | mnfst call "review this patch"  # stdin joins the prompt
 *
 * Output: the assistant text on stdout (pipe-clean); routing facts (model,
 * provider, tokens, cost) on stderr so every call shows what Manifest did.
 * --json prints the full API response instead.
 */
export async function call(io: CliIo, argv: string[]): Promise<void> {
  const args = parseArgs(argv, {
    strings: ['url', 'agent', 'model', 'tier', 'system'],
    booleans: ['json'],
  });
  const agent = args.strings['agent']
    ? slugifyAgentName(args.strings['agent'])
    : await resolveDiscoveryAgent(io, args);

  let prompt = args.positionals.join(' ').trim();
  if (!prompt) {
    prompt = (await io.readStdin()).trim();
  }
  if (!prompt) {
    throw new CliError(
      'missing_prompt',
      'Nothing to send — pass a prompt argument or pipe it on stdin',
      'Example: mnfst call "summarize the release notes"',
    );
  }

  const resolved = await resolveAgentKey(io, args, agent);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  let response: Response;
  try {
    response = await io.fetchImpl(`${resolved.origin}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolved.key}`,
        'Content-Type': 'application/json',
        ...(args.strings['tier'] ? { 'x-manifest-tier': args.strings['tier'] } : {}),
      },
      body: JSON.stringify({
        model: args.strings['model'] ?? 'auto',
        messages: [
          ...(args.strings['system'] ? [{ role: 'system', content: args.strings['system'] }] : []),
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new CliError(
      'network_error',
      `Could not reach ${resolved.origin}: ${error instanceof Error ? error.message : String(error)}`,
      'Check the URL and that the Manifest server is running',
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* non-JSON body falls through to the generic error below */
  }

  if (!response.ok) {
    const err = (parsed['error'] as { message?: string } | undefined)?.message;
    throw new CliError(
      'call_failed',
      err ?? `Call failed with HTTP ${response.status}`,
      undefined,
      response.status,
    );
  }

  const choice = (parsed['choices'] as Array<Record<string, unknown>> | undefined)?.[0];
  const message = choice?.['message'] as { content?: string } | undefined;
  const content = message?.content ?? '';

  // The proxy wraps some Manifest-side failures as HTTP 200 with the error
  // text in the assistant message. A CLI must not present those as answers.
  if (/^\[🦚 Manifest M\d+\]/.test(content)) {
    throw new CliError('call_failed', content, 'See mnfst routing status <agent>');
  }

  if (args.booleans['json']) {
    printJson(io, parsed);
    return;
  }

  const usage = parsed['usage'] as
    { prompt_tokens?: number; completion_tokens?: number; cost?: number } | undefined;
  const facts = [
    `agent=${agent}`,
    `model=${typeof parsed['model'] === 'string' ? parsed['model'] : 'auto'}`,
    ...(usage?.prompt_tokens !== undefined
      ? [`tokens=${(usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)}`]
      : []),
  ];
  io.stderr(`↳ ${facts.join(' ')}`);
  io.stdout(content);
}
