import type { Repository } from 'typeorm';
import {
  SubscriptionQuotaService,
  parseAnthropicUsage,
  parseKimiUsage,
  parseOpenAiUsage,
  parseMinimaxUsage,
  parseXaiUsage,
  grpcWebDataFrames,
  grpcWebTrailerFields,
  validateGrpcStatusFields,
  resolveQuotaPollIntervalMs,
  DEFAULT_QUOTA_POLL_INTERVAL_MS,
  MIN_QUOTA_POLL_INTERVAL_MS,
} from './subscription-quota.service';
import type { TenantProvider } from '../entities/tenant-provider.entity';
import type { AnthropicOauthService } from './oauth/anthropic/anthropic-oauth.service';
import type { OpenaiOauthService } from './oauth/openai/openai-oauth.service';
import type { MinimaxOauthService } from './oauth/minimax/minimax-oauth.service';
import type { XaiOauthService } from './oauth/xai/xai-oauth.service';

// decrypt is identity in tests — rows carry their "raw" token directly.
jest.mock('../common/utils/crypto.util', () => ({
  decrypt: jest.fn((value: string) => value),
  getEncryptionSecret: jest.fn(() => 'test-secret'),
}));

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const LATER = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 1000).toISOString();

// OpenAI windows report reset_at in epoch seconds; MiniMax in epoch ms.
const FUTURE_SEC = Math.floor(Date.parse(FUTURE) / 1000);
const LATER_SEC = Math.floor(Date.parse(LATER) / 1000);
const FUTURE_MS = Date.parse(FUTURE);
const LATER_MS = Date.parse(LATER);

const anthropicUsage = (utilization: number, resetsAt: string | null = FUTURE) => ({
  five_hour: { utilization: 12, resets_at: LATER },
  seven_day: { utilization, resets_at: resetsAt },
  seven_day_sonnet: { utilization: 5, resets_at: LATER },
  seven_day_opus: { utilization: 5, resets_at: LATER },
  seven_day_oauth_apps: { utilization: 5, resets_at: LATER },
  extra_usage: { is_enabled: false, used: 0, limit: 0 },
});

const kimiUsage = (overrides: Record<string, unknown> = {}) => ({
  usage: { used: '10', limit: '100', resetTime: FUTURE },
  limits: [
    {
      window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
      detail: { used: '1', limit: '50', resetTime: FUTURE },
    },
  ],
  totalQuota: { limit: '1000', remaining: '900' },
  ...overrides,
});

const row = (overrides: Partial<TenantProvider>): TenantProvider =>
  ({
    id: 'tp-1',
    tenant_id: 'user-1',
    agent_id: 'agent-1',
    provider: 'anthropic',
    api_key_encrypted: 'raw-token',
    auth_type: 'subscription',
    label: 'Default',
    is_active: true,
    ...overrides,
  }) as TenantProvider;

const okResponse = (data: unknown) => ({ ok: true, json: async () => data }) as unknown as Response;

/* ── gRPC-web/protobuf fixture helpers (ported from the upstream PR's spec) ── */

const varint = (value: number): number[] => {
  let remaining = value;
  const bytes: number[] = [];
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);
  return bytes;
};

const floatLE = (value: number): number[] => {
  const buf = Buffer.alloc(4);
  buf.writeFloatLE(value, 0);
  return [...buf];
};

/** field 1 fixed32 percent + field 2 varint reset, like the PR's helper. */
const protobufPayload = (usedPercent: number, resetEpoch: number): Uint8Array =>
  Uint8Array.from([0x0d, ...floatLE(usedPercent), 0x10, ...varint(resetEpoch)]);

const grpcFrame = (payload: Uint8Array, flags = 0): Uint8Array => {
  const frame = new Uint8Array(5 + payload.length);
  frame[0] = flags;
  frame[1] = (payload.length >>> 24) & 0xff;
  frame[2] = (payload.length >>> 16) & 0xff;
  frame[3] = (payload.length >>> 8) & 0xff;
  frame[4] = payload.length & 0xff;
  frame.set(payload, 5);
  return frame;
};

const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const binaryResponse = (
  body: Uint8Array,
  init: { status?: number; headers?: Record<string, string> } = {},
) => {
  const status = init.status ?? 200;
  const headers = init.headers ?? {};
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as unknown as Response;
};

/**
 * Real production capture (HTTP 200, 115 bytes, trailer grpc-status:0) from a
 * GetGrokCreditsConfig call where the user had used 4% of their credits. The
 * weekly reset varint at path [1,5,1] decodes to 1787523556
 * (2026-08-23T22:19:16.000Z); the other in-range varint (1786918756) is in
 * the past and must be filtered out.
 */
const XAI_PROD_FIXTURE_HEX =
  '000000005a0a580d0000804012001a00220c08e4ee88d40610e8bd8dc003' +
  '2a0c08e4e3add40610e8bd8dc0033a07080215000080403a020805' +
  '421e0802120c08e4ee88d40610e8bd8dc0031a0c08e4e3add40610e8bd8dc003' +
  '580162006801800000000f677270632d7374617475733a300d0a';
const XAI_PROD_RESET_ISO = '2026-08-23T22:19:16.000Z';

describe('parseAnthropicUsage', () => {
  it('is not exhausted when every window is below 100', () => {
    expect(parseAnthropicUsage(anthropicUsage(99))).toEqual({
      exhausted: false,
      resetsAt: null,
    });
  });

  it('is exhausted when any window hits 100', () => {
    const result = parseAnthropicUsage(anthropicUsage(100));
    expect(result.exhausted).toBe(true);
    expect(result.resetsAt).toBe(FUTURE);
  });

  it('picks the earliest resets_at among the exhausted windows', () => {
    const result = parseAnthropicUsage({
      five_hour: { utilization: 100, resets_at: LATER },
      seven_day: { utilization: 100, resets_at: FUTURE },
      seven_day_sonnet: { utilization: 10, resets_at: PAST },
    });
    expect(result).toEqual({ exhausted: true, resetsAt: FUTURE });
  });

  it('returns resetsAt null when the exhausted window has no reset time', () => {
    const result = parseAnthropicUsage({
      five_hour: { utilization: 100, resets_at: null },
    });
    expect(result).toEqual({ exhausted: true, resetsAt: null });
  });

  it('fails open on missing or malformed data', () => {
    expect(parseAnthropicUsage(null)).toEqual({ exhausted: false, resetsAt: null });
    expect(parseAnthropicUsage({})).toEqual({ exhausted: false, resetsAt: null });
    expect(parseAnthropicUsage({ five_hour: { utilization: '100' } })).toEqual({
      exhausted: false,
      resetsAt: null,
    });
  });
});

describe('parseKimiUsage', () => {
  it('fails open when quota strings are malformed or partially numeric', () => {
    const result = parseKimiUsage(
      kimiUsage({ usage: { used: '0oops', limit: '100', resetTime: FUTURE } }),
    );
    expect(result).toEqual({ exhausted: false, resetsAt: null });

    const result2 = parseKimiUsage(
      kimiUsage({ usage: { used: ' ', limit: '100', resetTime: FUTURE } }),
    );
    expect(result2).toEqual({ exhausted: false, resetsAt: null });
  });
  it('is not exhausted when all windows have headroom', () => {
    expect(parseKimiUsage(kimiUsage())).toEqual({ exhausted: false, resetsAt: null });
  });

  it('is exhausted when the weekly window is full (string numbers)', () => {
    const result = parseKimiUsage(
      kimiUsage({ usage: { used: '100', limit: '100', resetTime: FUTURE } }),
    );
    expect(result).toEqual({ exhausted: true, resetsAt: FUTURE });
  });

  it('is exhausted when the 5h rolling window is full', () => {
    const result = parseKimiUsage(
      kimiUsage({
        limits: [
          {
            window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
            detail: { used: '50', limit: '50', resetTime: FUTURE },
          },
        ],
      }),
    );
    expect(result).toEqual({ exhausted: true, resetsAt: FUTURE });
  });

  it('selects the 5h window by duration 300 minutes, not by position', () => {
    const result = parseKimiUsage(
      kimiUsage({
        limits: [
          {
            window: { duration: 1440, timeUnit: 'TIME_UNIT_MINUTE' },
            detail: { used: '99', limit: '100', resetTime: LATER },
          },
          {
            window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
            detail: { used: '50', limit: '50', resetTime: FUTURE },
          },
        ],
      }),
    );
    expect(result).toEqual({ exhausted: true, resetsAt: FUTURE });
  });

  it('falls back to limits[0] when no 300-minute window exists', () => {
    const result = parseKimiUsage(
      kimiUsage({
        limits: [
          {
            window: { duration: 1440, timeUnit: 'TIME_UNIT_MINUTE' },
            detail: { used: '100', limit: '100', resetTime: LATER },
          },
        ],
      }),
    );
    expect(result).toEqual({ exhausted: true, resetsAt: LATER });
  });

  it('is exhausted when the monthly quota has nothing remaining', () => {
    const result = parseKimiUsage(kimiUsage({ totalQuota: { limit: '1000', remaining: '0' } }));
    // Monthly carries no reset time.
    expect(result).toEqual({ exhausted: true, resetsAt: null });
  });

  it('picks the earliest reset among exhausted windows', () => {
    const result = parseKimiUsage(
      kimiUsage({
        usage: { used: '100', limit: '100', resetTime: LATER },
        limits: [
          {
            window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
            detail: { used: '50', limit: '50', resetTime: FUTURE },
          },
        ],
      }),
    );
    expect(result).toEqual({ exhausted: true, resetsAt: FUTURE });
  });

  it('ignores windows with a zero limit', () => {
    const result = parseKimiUsage(
      kimiUsage({
        usage: { used: '0', limit: '0', resetTime: FUTURE },
        limits: [],
        totalQuota: { limit: '0', remaining: '0' },
      }),
    );
    expect(result).toEqual({ exhausted: false, resetsAt: null });
  });

  it('fails open on missing or malformed data', () => {
    expect(parseKimiUsage(null)).toEqual({ exhausted: false, resetsAt: null });
    expect(parseKimiUsage({})).toEqual({ exhausted: false, resetsAt: null });
    expect(parseKimiUsage({ usage: { used: 'abc', limit: 'def' } })).toEqual({
      exhausted: false,
      resetsAt: null,
    });
  });

  it('never treats missing or corrupt numbers as zero (fail-open)', () => {
    // A missing/corrupt monthly remaining must NOT read as remaining <= 0.
    expect(parseKimiUsage(kimiUsage({ totalQuota: { limit: '1000' } }))).toEqual({
      exhausted: false,
      resetsAt: null,
    });
    expect(parseKimiUsage(kimiUsage({ totalQuota: { limit: '1000', remaining: 'abc' } }))).toEqual({
      exhausted: false,
      resetsAt: null,
    });
    // Corrupt weekly used / 5h limit likewise cannot exhaust.
    expect(
      parseKimiUsage(kimiUsage({ usage: { used: 'abc', limit: '100', resetTime: FUTURE } })),
    ).toEqual({ exhausted: false, resetsAt: null });
    expect(
      parseKimiUsage(
        kimiUsage({
          limits: [
            {
              window: { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' },
              detail: { used: '5', resetTime: FUTURE },
            },
          ],
        }),
      ),
    ).toEqual({ exhausted: false, resetsAt: null });
  });

  it('still parses a legitimate "0" string as zero and can exhaust on it', () => {
    // remaining "0" with a positive limit is a real exhaustion signal.
    const result = parseKimiUsage(kimiUsage({ totalQuota: { limit: '1000', remaining: '0' } }));
    expect(result.exhausted).toBe(true);
  });
});

describe('parseOpenAiUsage', () => {
  const openAiUsage = (primaryPercent: number, secondaryPercent = 10) => ({
    rate_limit: {
      primary_window: { used_percent: primaryPercent, reset_at: FUTURE_SEC },
      secondary_window: { used_percent: secondaryPercent, reset_at: LATER_SEC },
    },
    credits: { unlimited: false, balance: 5 },
  });

  it('is not exhausted when every window is below 100', () => {
    expect(parseOpenAiUsage(openAiUsage(99, 42))).toEqual({ exhausted: false, resetsAt: null });
  });

  it('is exhausted when any window hits 100, converting epoch seconds to ISO', () => {
    expect(parseOpenAiUsage(openAiUsage(100))).toEqual({
      exhausted: true,
      resetsAt: new Date(FUTURE_SEC * 1000).toISOString(),
    });
  });

  it('picks the earliest reset_at among the exhausted windows', () => {
    const result = parseOpenAiUsage({
      rate_limit: {
        primary_window: { used_percent: 100, reset_at: LATER_SEC },
        secondary_window: { used_percent: 100, reset_at: FUTURE_SEC },
      },
    });
    expect(result).toEqual({
      exhausted: true,
      resetsAt: new Date(FUTURE_SEC * 1000).toISOString(),
    });
  });

  it('is not exhausted when the windows are missing', () => {
    expect(parseOpenAiUsage({ rate_limit: {} })).toEqual({ exhausted: false, resetsAt: null });
    expect(parseOpenAiUsage({})).toEqual({ exhausted: false, resetsAt: null });
  });

  it('fails open on missing or malformed data', () => {
    expect(parseOpenAiUsage(null)).toEqual({ exhausted: false, resetsAt: null });
    expect(
      parseOpenAiUsage({ rate_limit: { primary_window: { used_percent: '100', reset_at: 1 } } }),
    ).toEqual({ exhausted: false, resetsAt: null });
  });
});

describe('parseMinimaxUsage', () => {
  const minimaxEntry = (overrides: Record<string, unknown> = {}) => ({
    model_name: 'general',
    current_interval_remaining_percent: 99,
    end_time: FUTURE_MS,
    current_weekly_remaining_percent: 99,
    weekly_end_time: LATER_MS,
    current_interval_total_count: 0,
    current_interval_usage_count: 0,
    ...overrides,
  });
  const minimaxUsage = (entries: Record<string, unknown>[]) => ({
    model_remains: entries,
    base_resp: { status_code: 0, status_msg: 'success' },
  });

  it('is not exhausted when the remaining percents are above zero', () => {
    expect(parseMinimaxUsage(minimaxUsage([minimaxEntry()]))).toEqual({
      exhausted: false,
      resetsAt: null,
    });
  });

  it('is exhausted when the interval remaining percent hits 0', () => {
    expect(
      parseMinimaxUsage(minimaxUsage([minimaxEntry({ current_interval_remaining_percent: 0 })])),
    ).toEqual({ exhausted: true, resetsAt: new Date(FUTURE_MS).toISOString() });
  });

  it('is exhausted when the weekly remaining percent hits 0', () => {
    expect(
      parseMinimaxUsage(minimaxUsage([minimaxEntry({ current_weekly_remaining_percent: 0 })])),
    ).toEqual({ exhausted: true, resetsAt: new Date(LATER_MS).toISOString() });
  });

  it('picks the earliest reset when both windows are exhausted', () => {
    expect(
      parseMinimaxUsage(
        minimaxUsage([
          minimaxEntry({
            current_interval_remaining_percent: 0,
            current_weekly_remaining_percent: 0,
          }),
        ]),
      ),
    ).toEqual({ exhausted: true, resetsAt: new Date(FUTURE_MS).toISOString() });
  });

  it("selects the 'general' entry over other models", () => {
    const result = parseMinimaxUsage(
      minimaxUsage([
        minimaxEntry({
          model_name: 'video',
          current_interval_remaining_percent: 0,
          current_weekly_remaining_percent: 0,
        }),
        minimaxEntry(),
      ]),
    );
    expect(result).toEqual({ exhausted: false, resetsAt: null });
  });

  it("falls back to the first entry when no 'general' entry exists", () => {
    const result = parseMinimaxUsage(
      minimaxUsage([minimaxEntry({ model_name: 'video', current_weekly_remaining_percent: 0 })]),
    );
    expect(result).toEqual({ exhausted: true, resetsAt: new Date(LATER_MS).toISOString() });
  });

  it('throws on a non-zero base_resp.status_code (business error)', () => {
    expect(() =>
      parseMinimaxUsage({
        model_remains: [],
        base_resp: { status_code: 2062, status_msg: 'no active plan' },
      }),
    ).toThrow('2062');
  });

  it('treats missing percent fields as not exhausted', () => {
    const entry = minimaxEntry();
    delete (entry as Record<string, unknown>).current_interval_remaining_percent;
    delete (entry as Record<string, unknown>).current_weekly_remaining_percent;
    expect(parseMinimaxUsage(minimaxUsage([entry]))).toEqual({
      exhausted: false,
      resetsAt: null,
    });
  });

  it('returns resetsAt null when the exhausted window lacks a reset time', () => {
    expect(
      parseMinimaxUsage(
        minimaxUsage([minimaxEntry({ current_interval_remaining_percent: 0, end_time: null })]),
      ),
    ).toEqual({ exhausted: true, resetsAt: null });
  });

  it('fails open on missing or malformed data', () => {
    expect(parseMinimaxUsage(null)).toEqual({ exhausted: false, resetsAt: null });
    expect(parseMinimaxUsage({})).toEqual({ exhausted: false, resetsAt: null });
    expect(parseMinimaxUsage(minimaxUsage([]))).toEqual({ exhausted: false, resetsAt: null });
  });
});

describe('parseXaiUsage', () => {
  it('parses a framed protobuf payload (percent + reset)', () => {
    expect(parseXaiUsage(grpcFrame(protobufPayload(42.5, FUTURE_SEC)))).toEqual({
      usedPercent: 42.5,
      resetsAt: new Date(FUTURE_SEC * 1000).toISOString(),
    });
  });

  it('accepts a bare protobuf payload without gRPC-web framing', () => {
    expect(parseXaiUsage(protobufPayload(25, FUTURE_SEC))).toEqual({
      usedPercent: 25,
      resetsAt: new Date(FUTURE_SEC * 1000).toISOString(),
    });
  });

  it('throws when the response carries no protobuf payload (trailer-only)', () => {
    expect(() => parseXaiUsage(grpcFrame(Buffer.from('grpc-status: 0\r\n'), 0x80))).toThrow(
      'no protobuf payload',
    );
  });

  it('throws when neither a percent nor a plausible reset is found', () => {
    // field 1, length 0 — a valid but empty message.
    expect(() => parseXaiUsage(grpcFrame(Uint8Array.from([0x0a, 0x00])))).toThrow(
      'Could not parse Grok web billing usage',
    );
  });

  it('prefers the reset at path [1,5,1] over an earlier candidate', () => {
    const inner = Uint8Array.from([
      0x0d,
      ...floatLE(50), // [1,1] percent 50
      0x48,
      ...varint(FUTURE_SEC), // [1,9] earlier future reset
      0x2a,
      1 + varint(LATER_SEC).length,
      0x08,
      ...varint(LATER_SEC), // [1,5,1] later reset
    ]);
    const payload = Uint8Array.from([0x0a, inner.length, ...inner]);
    expect(parseXaiUsage(grpcFrame(payload))).toEqual({
      usedPercent: 50,
      resetsAt: new Date(LATER_SEC * 1000).toISOString(),
    });
  });

  it('falls back to the earliest future reset when no [1,5,1] candidate exists', () => {
    const inner = Uint8Array.from([
      0x0d,
      ...floatLE(50), // [1,1] percent 50
      0x48,
      ...varint(LATER_SEC), // [1,9] later
      0x50,
      ...varint(FUTURE_SEC), // [1,10] earlier
    ]);
    const payload = Uint8Array.from([0x0a, inner.length, ...inner]);
    expect(parseXaiUsage(grpcFrame(payload)).resetsAt).toBe(
      new Date(FUTURE_SEC * 1000).toISOString(),
    );
  });

  it('parses the production capture: usedPercent 4.0, weekly reset, grpc-status 0', () => {
    const data = Uint8Array.from(Buffer.from(XAI_PROD_FIXTURE_HEX, 'hex'));
    expect(data.length).toBe(115);
    // Trailer validates cleanly.
    const fields = grpcWebTrailerFields(data);
    expect(fields['grpc-status']).toBe('0');
    expect(() => validateGrpcStatusFields(fields)).not.toThrow();
    // 4% used; the only future in-range reset varint sits at path [1,5,1].
    expect(parseXaiUsage(data)).toEqual({
      usedPercent: 4.0,
      resetsAt: XAI_PROD_RESET_ISO,
    });
  });
});

describe('grpc-web framing helpers', () => {
  it('grpcWebDataFrames returns null for malformed input', () => {
    expect(grpcWebDataFrames(new Uint8Array())).toBeNull();
    expect(grpcWebDataFrames(Uint8Array.from([0]))).toBeNull();
    expect(grpcWebDataFrames(Uint8Array.from([0x02, 0, 0, 0, 0]))).toBeNull();
    expect(grpcWebDataFrames(Uint8Array.from([0, 0, 0, 0, 2, 1]))).toBeNull();
  });

  it('grpcWebDataFrames returns only data frames, skipping trailers', () => {
    const data = concatBytes(
      grpcFrame(protobufPayload(10, FUTURE_SEC)),
      grpcFrame(Buffer.from('grpc-status:0\r\n'), 0x80),
    );
    const frames = grpcWebDataFrames(data);
    expect(frames).toHaveLength(1);
    expect(Array.from(frames![0])).toEqual(Array.from(protobufPayload(10, FUTURE_SEC)));
  });

  it('grpcWebTrailerFields decodes trailer lines and percent-encoding', () => {
    const trailer = grpcFrame(Buffer.from('grpc-status: 7\r\ngrpc-message: bad%20req\r\n'), 0x80);
    expect(grpcWebTrailerFields(trailer)).toEqual({
      'grpc-status': '7',
      'grpc-message': 'bad req',
    });
  });

  it('validateGrpcStatusFields accepts missing or zero status, throws otherwise', () => {
    expect(() => validateGrpcStatusFields({})).not.toThrow();
    expect(() => validateGrpcStatusFields({ 'grpc-status': '0' })).not.toThrow();
    expect(() =>
      validateGrpcStatusFields({ 'grpc-status': '7', 'grpc-message': 'bad%ZZ' }),
    ).toThrow('gRPC 7: bad%ZZ');
    expect(() => validateGrpcStatusFields({ 'grpc-status': '4' })).toThrow('gRPC 4: ');
  });
});

describe('resolveQuotaPollIntervalMs', () => {
  it('rejects values beyond the maximum timeout limit', () => {
    expect(resolveQuotaPollIntervalMs('2147483648')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('999999999999999999999999999999')).toBe(
      DEFAULT_QUOTA_POLL_INTERVAL_MS,
    );
  });
  it('defaults to 60s when unset or invalid', () => {
    expect(resolveQuotaPollIntervalMs(undefined)).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('not-a-number')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('-5000')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
  });

  it('rejects numeric prefixes with trailing junk (digits-only)', () => {
    expect(resolveQuotaPollIntervalMs('60000junk')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('60_000')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('6e4')).toBe(DEFAULT_QUOTA_POLL_INTERVAL_MS);
  });

  it('trims surrounding whitespace', () => {
    expect(resolveQuotaPollIntervalMs(' 45000 ')).toBe(45_000);
  });

  it('clamps to the 30s minimum', () => {
    expect(resolveQuotaPollIntervalMs('100')).toBe(MIN_QUOTA_POLL_INTERVAL_MS);
    expect(resolveQuotaPollIntervalMs('30000')).toBe(MIN_QUOTA_POLL_INTERVAL_MS);
  });

  it('honors values above the minimum', () => {
    expect(resolveQuotaPollIntervalMs('120000')).toBe(120_000);
  });
});

describe('SubscriptionQuotaService', () => {
  let providerRepo: { find: jest.Mock };
  let anthropicOauth: { unwrapToken: jest.Mock };
  let openaiOauth: { unwrapToken: jest.Mock };
  let minimaxOauth: { unwrapToken: jest.Mock };
  let xaiOauth: { unwrapToken: jest.Mock };
  let svc: SubscriptionQuotaService;
  let fetchMock: jest.Mock;
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    providerRepo = { find: jest.fn().mockResolvedValue([]) };
    anthropicOauth = { unwrapToken: jest.fn().mockResolvedValue('anthropic-access-token') };
    openaiOauth = { unwrapToken: jest.fn().mockResolvedValue('openai-access-token') };
    minimaxOauth = { unwrapToken: jest.fn().mockResolvedValue({ t: 'minimax-access-token' }) };
    xaiOauth = { unwrapToken: jest.fn().mockResolvedValue('xai-access-token') };
    svc = new SubscriptionQuotaService(
      providerRepo as unknown as Repository<TenantProvider>,
      anthropicOauth as unknown as AnthropicOauthService,
      openaiOauth as unknown as OpenaiOauthService,
      minimaxOauth as unknown as MinimaxOauthService,
      xaiOauth as unknown as XaiOauthService,
    );
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    svc.onModuleDestroy();
  });

  const poll = () => (svc as unknown as { pollSafely(): Promise<void> }).pollSafely();

  it('isQuotaExhausted is false when no data exists for the connection', () => {
    expect(svc.isQuotaExhausted('tp-unknown')).toBe(false);
    expect(svc.getQuotaState('tp-unknown')).toBeUndefined();
  });

  it('polls anthropic subscriptions through the OAuth unwrap path', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    fetchMock.mockResolvedValue(okResponse(anthropicUsage(100)));

    await poll();

    expect(anthropicOauth.unwrapToken).toHaveBeenCalledWith(
      'raw-token',
      'agent-1',
      'user-1',
      'Default',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/api/oauth/usage');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer anthropic-access-token',
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'claude-code/2.1.0',
    });
    expect(svc.isQuotaExhausted('tp-1')).toBe(true);
    expect(svc.getQuotaState('tp-1')).toMatchObject({ exhausted: true, resetsAt: FUTURE });
  });

  it('polls moonshot subscriptions with the raw token and no unwrap', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-kimi', provider: 'moonshot' })]);
    fetchMock.mockResolvedValue(
      okResponse(kimiUsage({ usage: { used: '100', limit: '100', resetTime: FUTURE } })),
    );

    await poll();

    expect(anthropicOauth.unwrapToken).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.kimi.com/coding/v1/usages');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer raw-token' });
    expect(svc.isQuotaExhausted('tp-kimi')).toBe(true);
  });

  it('skips providers without a quota endpoint', async () => {
    providerRepo.find.mockResolvedValue([row({ provider: 'gemini' })]);
    await poll();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls openai subscriptions through the OpenAI unwrap path', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-openai', provider: 'openai' })]);
    fetchMock.mockResolvedValue(
      okResponse({
        rate_limit: {
          primary_window: { used_percent: 100, reset_at: FUTURE_SEC },
          secondary_window: { used_percent: 10, reset_at: LATER_SEC },
        },
      }),
    );

    await poll();

    expect(openaiOauth.unwrapToken).toHaveBeenCalledWith(
      'raw-token',
      'agent-1',
      'user-1',
      'Default',
    );
    expect(anthropicOauth.unwrapToken).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://chatgpt.com/backend-api/wham/usage');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer openai-access-token',
      'User-Agent': 'Manifest',
    });
    expect(svc.isQuotaExhausted('tp-openai')).toBe(true);
  });

  it('polls minimax subscriptions against the resource-URL origin', async () => {
    minimaxOauth.unwrapToken.mockResolvedValue({
      t: 'minimax-access-token',
      u: 'https://api.minimaxi.com/anthropic/v1',
    });
    providerRepo.find.mockResolvedValue([row({ id: 'tp-minimax', provider: 'minimax' })]);
    fetchMock.mockResolvedValue(
      okResponse({
        model_remains: [
          {
            model_name: 'general',
            current_interval_remaining_percent: 0,
            end_time: FUTURE_MS,
            current_weekly_remaining_percent: 50,
            weekly_end_time: LATER_MS,
          },
        ],
        base_resp: { status_code: 0, status_msg: 'success' },
      }),
    );

    await poll();

    expect(minimaxOauth.unwrapToken).toHaveBeenCalledWith(
      'raw-token',
      'agent-1',
      'user-1',
      'Default',
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimaxi.com/v1/token_plan/remains');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer minimax-access-token',
      'Content-Type': 'application/json',
    });
    expect(svc.isQuotaExhausted('tp-minimax')).toBe(true);
  });

  it('falls back to the default MiniMax base URL when the blob has no resource URL', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-minimax', provider: 'minimax' })]);
    fetchMock.mockResolvedValue(okResponse({ model_remains: [], base_resp: { status_code: 0 } }));

    await poll();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.minimax.io/v1/token_plan/remains');
    expect(svc.isQuotaExhausted('tp-minimax')).toBe(false);
  });

  it('treats a MiniMax business error (non-zero status_code) as a fetch failure', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-minimax', provider: 'minimax' })]);
    fetchMock.mockResolvedValue(
      okResponse({ model_remains: [], base_resp: { status_code: 2062, status_msg: 'no plan' } }),
    );

    await poll();

    expect(svc.isQuotaExhausted('tp-minimax')).toBe(false);
    expect(svc.getQuotaState('tp-minimax')?.error).toContain('2062');
  });

  it('polls xai subscriptions via gRPC-web and the xAI unwrap path', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-xai', provider: 'xai' })]);
    fetchMock.mockResolvedValue(
      binaryResponse(
        concatBytes(
          grpcFrame(protobufPayload(100, FUTURE_SEC)),
          grpcFrame(Buffer.from('grpc-status:0\r\n'), 0x80),
        ),
      ),
    );

    await poll();

    expect(xaiOauth.unwrapToken).toHaveBeenCalledWith('raw-token', 'agent-1', 'user-1', 'Default');
    expect(anthropicOauth.unwrapToken).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer xai-access-token',
      Origin: 'https://grok.com',
      Referer: 'https://grok.com/?_s=usage',
      'Content-Type': 'application/grpc-web+proto',
      'x-grpc-web': '1',
      'x-user-agent': 'connect-es/2.1.1',
      'User-Agent': 'Manifest',
    });
    expect(Array.from(init.body as Uint8Array)).toEqual([0, 0, 0, 0, 0]);
    expect(svc.isQuotaExhausted('tp-xai')).toBe(true);
    expect(svc.getQuotaState('tp-xai')).toMatchObject({
      exhausted: true,
      resetsAt: new Date(FUTURE_SEC * 1000).toISOString(),
    });
  });

  it('treats a non-zero grpc-status trailer as a fetch failure (fail-open)', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-xai', provider: 'xai' })]);
    fetchMock.mockResolvedValue(
      binaryResponse(
        concatBytes(
          grpcFrame(protobufPayload(100, FUTURE_SEC)),
          grpcFrame(Buffer.from('grpc-status:7\r\ngrpc-message:denied\r\n'), 0x80),
        ),
      ),
    );

    await poll();

    expect(svc.isQuotaExhausted('tp-xai')).toBe(false);
    expect(svc.getQuotaState('tp-xai')?.error).toContain('gRPC 7');
  });

  it('treats a non-zero grpc-status response header as a fetch failure', async () => {
    providerRepo.find.mockResolvedValue([row({ id: 'tp-xai', provider: 'xai' })]);
    fetchMock.mockResolvedValue(
      binaryResponse(new Uint8Array(), { status: 200, headers: { 'grpc-status': '16' } }),
    );

    await poll();

    expect(svc.isQuotaExhausted('tp-xai')).toBe(false);
    expect(svc.getQuotaState('tp-xai')?.error).toContain('gRPC 16');
  });

  it('fails open when the fetch errors, storing a non-exhausted state', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    fetchMock.mockRejectedValue(new Error('network down'));

    await poll();

    expect(svc.isQuotaExhausted('tp-1')).toBe(false);
    expect(svc.getQuotaState('tp-1')).toMatchObject({
      exhausted: false,
      error: 'network down',
    });
  });

  it('fails open when the endpoint returns a non-OK status', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await poll();

    expect(svc.isQuotaExhausted('tp-1')).toBe(false);
    expect(svc.getQuotaState('tp-1')?.error).toContain('401');
  });

  it('fails open when the fetch times out (abort)', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    await poll();

    expect(svc.isQuotaExhausted('tp-1')).toBe(false);
  });

  it('keeps the previous verdict when a later refresh fails', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    fetchMock.mockResolvedValueOnce(okResponse(anthropicUsage(100)));
    await poll();
    expect(svc.isQuotaExhausted('tp-1')).toBe(true);

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await poll();

    const state = svc.getQuotaState('tp-1');
    expect(state).toMatchObject({ exhausted: true, resetsAt: FUTURE, error: 'network down' });
    expect(svc.isQuotaExhausted('tp-1')).toBe(true);
  });

  it('treats an unwrap failure as a fetch failure (fail-open)', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    anthropicOauth.unwrapToken.mockResolvedValue(null);

    await poll();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(svc.isQuotaExhausted('tp-1')).toBe(false);
  });

  it('prunes state for connections no longer returned by the poll', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    fetchMock.mockResolvedValue(okResponse(anthropicUsage(100)));
    await poll();
    expect(svc.getQuotaState('tp-1')).toBeDefined();

    // The connection is deleted/deactivated before the next poll.
    providerRepo.find.mockResolvedValue([]);
    await poll();
    expect(svc.getQuotaState('tp-1')).toBeUndefined();
    expect(svc.isQuotaExhausted('tp-1')).toBe(false);
  });

  it('reads a connection as not exhausted once its resetsAt has passed', async () => {
    providerRepo.find.mockResolvedValue([row({})]);
    fetchMock.mockResolvedValue(okResponse(anthropicUsage(100, PAST)));

    await poll();

    expect(svc.getQuotaState('tp-1')).toMatchObject({ exhausted: true, resetsAt: PAST });
    expect(svc.isQuotaExhausted('tp-1')).toBe(false);
  });

  it('starts and clears the poll timer with the module lifecycle', () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    try {
      svc.onModuleInit();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      svc.onModuleDestroy();
    } finally {
      setIntervalSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
