// Vendored Phoenix-compatible healing service.
//
// Upstream: /root/projects/phoenix-healer/heal.mjs (the user's private
// "phoenix-healer" service). This copy ships inside the Manifest repo so the
// self-hosted Auto-fix subsystem has a bundled healer. Vendored changes vs the
// upstream file:
//   1. The Express `app` is created and exported separately; `app.listen` only
//      runs when this module is executed directly (`node heal.mjs`), so
//      contract tests can import it and bind an ephemeral port.
//   2. POST /api/heal/observe — accepts a single observation object, an array
//      of observations, or the `{ observations: [...] }` envelope the Manifest
//      HttpHealingClient posts, and acks with `{ status: 'ok', observed: n }`.
//   3. Optional auth: when HEALER_API_KEY is set, every `/api/heal*` route
//      requires the matching `x-api-key` header (401 otherwise). Unset means
//      open access, preserving the original keyless contract.
// All existing endpoints/rules keep their original response shapes.

import express from 'express';
import crypto from 'crypto';
import { pathToFileURL } from 'node:url';

const app = express();
app.use(express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────
// Optional API-key auth (HEALER_API_KEY)
// ─────────────────────────────────────────────
// Protects the healing routes only. /api/health stays open so the backend's
// boot-time health probe keeps working without a key. When the env var is
// unset every request is allowed — byte-compatible with the original keyless
// service (existing installs send AUTOFIX_HEALING_API_KEY=dummy).
const HEALER_API_KEY = process.env.HEALER_API_KEY;

function isHealerPath(path) {
  // /api/heal, /api/heal/observe and /api/heal-attempts/:id all start with
  // "/api/heal"; /api/health shares that prefix too, so exclude it explicitly.
  if (path === '/api/health') return false;
  return path.startsWith('/api/heal');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

if (HEALER_API_KEY) {
  app.use((req, res, next) => {
    if (!isHealerPath(req.path)) return next();
    if (safeEqual(req.get('x-api-key') || '', HEALER_API_KEY)) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  });
}

// ─────────────────────────────────────────────
// In-memory issue registry (replace with DB if needed)
// ─────────────────────────────────────────────
const issues = new Map();
const attempts = new Map();

function getOrCreateIssue(fingerprint) {
  if (!issues.has(fingerprint)) {
    issues.set(fingerprint, {
      id: `issue_${crypto.randomUUID().slice(0, 8)}`,
      fingerprint,
      status: 'resolving',
      patches: [],
      createdAt: Date.now(),
    });
  }
  return issues.get(fingerprint);
}

function sanitizeToolSchemas(tools) {
  if (!Array.isArray(tools)) return tools;
  return tools.map((t) => {
    if (!t || typeof t !== 'object') return t;
    if (t.type === 'function' && t.function) {
      const fn = { ...t.function };
      if (
        !fn.parameters ||
        typeof fn.parameters !== 'object' ||
        fn.parameters.type === 'null' ||
        fn.parameters.type === 'NULL' ||
        !fn.parameters.type ||
        fn.parameters.type !== 'object'
      ) {
        fn.parameters = {
          type: 'object',
          properties: (fn.parameters && typeof fn.parameters === 'object' && fn.parameters.properties) || {},
        };
      }
      return { ...t, function: fn };
    }
    return t;
  });
}

// ─────────────────────────────────────────────
// Patch rules — add more as you encounter issues
// ─────────────────────────────────────────────
const RULES = [
  {
    name: 'invalid_function_schema',
    match: (req, res) => {
      // Proactive: check request body for tools with bad schemas
      const tools = req.request?.tools;
      if (Array.isArray(tools)) {
        for (const t of tools) {
          const fn = t?.function;
          if (fn && fn.parameters) {
            const p = fn.parameters;
            if (
              p.type === 'null' ||
              p.type === 'NULL' ||
              p.type === null ||
              (typeof p === 'object' && !p.type)
            ) {
              return true;
            }
          }
          if (fn && !fn.parameters) {
            // parameters undefined/null — the provider may reject it
            return true;
          }
        }
      }
      // Reactive: check error message
      const msg = res?.error?.message || '';
      return /schema must be a JSON Schema/i.test(msg) || /Invalid schema for function/i.test(msg);
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      if (fixed.tools) {
        fixed.tools = sanitizeToolSchemas(fixed.tools);
      }
      return fixed;
    },
    explanation: 'Sanitized tool function schemas to valid type: "object"',
    ops: [{ type: 'fix_param', from: 'tools', to: 'tools' }],
  },
  {
    name: 'top_p_zero',
    match: (req, res) => {
      const body = req.request || {};
      return body.top_p === 0;
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      delete fixed.top_p; // remove invalid param, let provider use default
      return fixed;
    },
    explanation: 'Removed top_p:0 (invalid range, must be >0)',
    ops: [{ type: 'remove_param', from: 'top_p', to: null }],
  },
  {
    name: 'top_p_negative',
    match: (req, res) => {
      const body = req.request || {};
      return typeof body.top_p === 'number' && body.top_p < 0;
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      delete fixed.top_p;
      return fixed;
    },
    explanation: 'Removed negative top_p value',
    ops: [{ type: 'remove_param', from: 'top_p', to: null }],
  },
  {
    name: 'temperature_zero_when_strict',
    match: (req, res) => {
      const body = req.request || {};
      const msg = res?.error?.message || '';
      return body.temperature === 0 && /temperature/i.test(msg);
    },
    patch: (body, _ctx) => {
      return { ...body, temperature: 1 };
    },
    explanation: 'Changed temperature:0 to temperature:1 (provider requires >0)',
    ops: [{ type: 'rename_param', from: 'temperature', to: 'temperature' }],
  },
  {
    name: 'max_tokens_to_max_completion_tokens',
    match: (req, res) => {
      const body = req.request || {};
      const msg = res?.error?.message || '';
      return body.max_tokens !== undefined && /max_completion_tokens|max_output_tokens/i.test(msg);
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      fixed.max_completion_tokens = fixed.max_tokens;
      delete fixed.max_tokens;
      return fixed;
    },
    explanation: 'Renamed max_tokens to max_completion_tokens',
    ops: [{ type: 'rename_param', from: 'max_tokens', to: 'max_completion_tokens' }],
  },
  {
    name: 'reasoning_content_missing',
    match: (req, res) => {
      const msg = res?.error?.message || '';
      return /reasoning_content.*must be passed/i.test(msg);
    },
    patch: (body, ctx) => {
      const cache = ctx?.reasoningContentCache || {};
      const fixed = { ...body };
      if (fixed.messages) {
        fixed.messages = fixed.messages.map((m) => {
          if (m.role === 'assistant' && m.reasoning_content === undefined) {
            // DeepSeek requires the ORIGINAL reasoning_content it returned on the
            // prior turn. Manifest caches it by the first tool_call id; use the
            // cached value when available, else fall back to empty string (still
            // satisfies the "must be passed" requirement, though the turn's
            // reasoning won't be replayed).
            const firstToolCallId =
              Array.isArray(m.tool_calls) && m.tool_calls[0] && typeof m.tool_calls[0].id === 'string'
                ? m.tool_calls[0].id
                : null;
            const content = (firstToolCallId && cache[firstToolCallId]) || '';
            return { ...m, reasoning_content: content };
          }
          return m;
        });
      }
      return fixed;
    },
    explanation: 'Restored missing reasoning_content from cache (or empty string when uncached) on assistant tool-call turns',
    ops: [{ type: 'add_param', from: null, to: 'reasoning_content' }],
  },
  {
    name: 'tool_choice_invalid',
    match: (req, res) => {
      const msg = res?.error?.message || '';
      return /tool_choice/i.test(msg) && /invalid|not supported|unsupported/i.test(msg);
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      delete fixed.tool_choice;
      return fixed;
    },
    explanation: 'Removed unsupported tool_choice parameter',
    ops: [{ type: 'remove_param', from: 'tool_choice', to: null }],
  },
  {
    name: 'response_format_invalid',
    match: (req, res) => {
      const msg = res?.error?.message || '';
      return /response_format/i.test(msg) && /invalid|not supported|unsupported/i.test(msg);
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      delete fixed.response_format;
      return fixed;
    },
    explanation: 'Removed unsupported response_format parameter',
    ops: [{ type: 'remove_param', from: 'response_format', to: null }],
  },
  {
    name: 'parallel_tool_calls_unsupported',
    match: (req, res) => {
      const msg = res?.error?.message || '';
      return /parallel_tool_calls/i.test(msg) && /not supported|unsupported|invalid/i.test(msg);
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      delete fixed.parallel_tool_calls;
      return fixed;
    },
    explanation: 'Removed unsupported parallel_tool_calls parameter',
    ops: [{ type: 'remove_param', from: 'parallel_tool_calls', to: null }],
  },
  {
    name: 'stream_options_unsupported',
    match: (req, res) => {
      const msg = res?.error?.message || '';
      return /stream_options/i.test(msg) && /not supported|unsupported|invalid/i.test(msg);
    },
    patch: (body, _ctx) => {
      const fixed = { ...body };
      delete fixed.stream_options;
      return fixed;
    },
    explanation: 'Removed unsupported stream_options parameter',
    ops: [{ type: 'remove_param', from: 'stream_options', to: null }],
  },
  {
    name: 'rotate_key_on_quota_or_key_failure',
    // Key/quota failures are a property of the credential, not the request
    // body: the request is fine, so the fix is to retry it with a different
    // API key. Kept LAST so more specific body-patch rules (which win on their
    // own patterns via first-match) are never shadowed — e.g. a
    // "schema must be a JSON Schema" error also containing "api key" still
    // gets the schema sanitizer, not a key rotation.
    match: (req, res) => {
      if (res?.statusCode === 429) return true;
      const msg = res?.error?.message || '';
      return /quota|rate limit|insufficient|api key|invalid key|invalid api|unauthorized|permission denied|billing|limit reached/i.test(msg);
    },
    patch: (body, _ctx) => {
      // The request itself is fine; the key is the problem. Return unchanged.
      return body;
    },
    explanation: 'Rotating to the next configured API key for this model',
    ops: [{ type: 'rotate_key', from: null, to: null }],
  },
];

// ─────────────────────────────────────────────
// POST /api/heal
// ─────────────────────────────────────────────
app.post('/api/heal', (req, res) => {
  const { traceId, provider, model, response: providerRes, request: requestBody, reasoningContentCache } = req.body;

  if (!traceId) {
    return res.status(400).json({ error: 'traceId is required' });
  }

  const statusCode = providerRes?.statusCode;
  const errorMsg = providerRes?.error?.message || '';

  // Only handle 4xx errors (auto-fix scope)
  if (!statusCode || statusCode < 400 || statusCode >= 500) {
    return res.json({
      status: 'no_patch',
      issueId: `issue_out_of_scope`,
    });
  }

  // Find matching rule
  const rule = RULES.find((r) => r.match(req.body, providerRes));

  if (!rule) {
    console.log(`[healer] No patch for: ${provider}/${model} — ${statusCode} ${errorMsg.slice(0, 100)}`);
    return res.json({
      status: 'no_patch',
      issueId: `issue_no_match_${crypto.randomUUID().slice(0, 6)}`,
    });
  }
  console.log(`[healer] Matched rule: ${rule.name} for ${provider}/${model} (${statusCode})`);
  console.log(`[healer]   msg snippet: ${(providerRes?.error?.message || '').slice(0, 120)}`);

  // Apply patch
  const healedBody = rule.patch(requestBody || {}, { reasoningContentCache: reasoningContentCache || {} });
  const fingerprint = `${provider}:${model}:${rule.name}`;
  const issue = getOrCreateIssue(fingerprint);
  const attemptId = `attempt_${crypto.randomUUID().slice(0, 8)}`;

  attempts.set(attemptId, {
    id: attemptId,
    issueId: issue.id,
    fingerprint,
    createdAt: Date.now(),
    status: 'pending',
  });

  console.log(`[healer] Patching: ${rule.name} for ${provider}/${model}`);

  return res.json({
    status: 'patched',
    issueId: issue.id,
    patchId: `patch_${rule.name}`,
    healAttemptId: attemptId,
    operations: rule.ops,
    explanation: {
      summary: rule.explanation,
      operations: rule.ops.map((op) => ({ type: op.type, detail: rule.explanation })),
      source: 'deterministic',
    },
    healedBody,
    retryAfterMs: 0,
  });
});

// ─────────────────────────────────────────────
// PATCH /api/heal-attempts/:id
// ─────────────────────────────────────────────
app.patch('/api/heal-attempts/:id', (req, res) => {
  const { id } = req.params;
  const { retryStatusCode, error } = req.body;

  const attempt = attempts.get(id);
  if (!attempt) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  attempt.status = retryStatusCode < 400 ? 'succeeded' : 'failed';
  attempt.retryStatusCode = retryStatusCode;
  attempt.error = error;

  console.log(`[healer] Attempt ${id}: ${attempt.status} (${retryStatusCode})`);

  return res.json({
    healAttemptId: id,
    status: attempt.status === 'succeeded' ? 'succeeded' : 'failed',
    issueStatus: attempt.status === 'succeeded' ? 'verified' : 'unverified',
  });
});

// ─────────────────────────────────────────────
// POST /api/heal/observe
// ─────────────────────────────────────────────
// Fire-and-forget evidence feed: the Manifest observation-reporter posts
// failed-forward payloads (HealRequest-shaped) here when
// AUTOFIX_REPORT_ALL_4XX=true. The HttpHealingClient sends a
// `{ observations: [...] }` envelope, but a bare array or a single object is
// accepted too — the feed is best-effort diagnostics, so nothing is rejected
// for schema pedantry and no scrubbing happens beyond what the client already
// did before sending. Stored in memory only; no DB.
const observations = [];
const MAX_OBSERVATIONS = 10000;

app.post('/api/heal/observe', (req, res) => {
  const body = req.body;
  let items;
  if (Array.isArray(body)) {
    items = body;
  } else if (body && typeof body === 'object' && Array.isArray(body.observations)) {
    items = body.observations;
  } else if (body && typeof body === 'object') {
    items = [body];
  } else {
    return res.status(400).json({ error: 'Expected an observation object or an array of observations' });
  }

  const accepted = items.filter((it) => it && typeof it === 'object');
  for (const item of accepted) {
    observations.push({ ...item, receivedAt: Date.now() });
  }
  // Hard cap so an unread fire-and-forget feed can't grow without bound in a
  // long-running container.
  if (observations.length > MAX_OBSERVATIONS) {
    observations.splice(0, observations.length - MAX_OBSERVATIONS);
  }

  return res.json({ status: 'ok', observed: accepted.length });
});

// ─────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    rulesLoaded: RULES.length,
    issuesTracked: issues.size,
    attemptsTracked: attempts.size,
  });
});

// ─────────────────────────────────────────────
// Start — only when executed directly (`node heal.mjs`), never on import, so
// contract tests can `import { app }` and bind their own ephemeral port.
// ─────────────────────────────────────────────
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const PORT = process.env.PORT || 3100;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[phoenix-healer] listening on :${PORT}`);
    console.log(`[phoenix-healer] ${RULES.length} rules loaded`);
  });
}

export { app };
