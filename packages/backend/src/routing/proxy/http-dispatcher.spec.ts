// Mock undici so we can assert how the Agent is constructed and that the
// dispatcher is installed, without opening real sockets.
jest.mock('undici', () => {
  const AgentMock = jest.fn().mockImplementation((opts: unknown) => ({ __agent: true, opts }));
  return {
    Agent: AgentMock,
    setGlobalDispatcher: jest.fn(),
  };
});

import { Agent, setGlobalDispatcher } from 'undici';
import { buildDispatcher, installGlobalDispatcher, DISPATCHER_DEFAULTS } from './http-dispatcher';

const AgentMock = Agent as unknown as jest.Mock;
const setGlobalDispatcherMock = setGlobalDispatcher as unknown as jest.Mock;

const UNDICI_ENV_KEYS = [
  'UNDICI_CONNECTIONS',
  'UNDICI_KEEP_ALIVE_TIMEOUT_MS',
  'UNDICI_KEEP_ALIVE_MAX_TIMEOUT_MS',
  'UNDICI_CONNECT_TIMEOUT_MS',
];

describe('http-dispatcher', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of UNDICI_ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of UNDICI_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe('buildDispatcher', () => {
    it('builds an Agent with the documented defaults', () => {
      buildDispatcher();

      expect(AgentMock).toHaveBeenCalledTimes(1);
      expect(AgentMock).toHaveBeenCalledWith({
        connections: DISPATCHER_DEFAULTS.connections,
        keepAliveTimeout: DISPATCHER_DEFAULTS.keepAliveTimeout,
        keepAliveMaxTimeout: DISPATCHER_DEFAULTS.keepAliveMaxTimeout,
        connect: { timeout: DISPATCHER_DEFAULTS.connectTimeout },
      });
    });

    it('exposes the expected default values', () => {
      expect(DISPATCHER_DEFAULTS).toEqual({
        connections: 128,
        keepAliveTimeout: 30_000,
        keepAliveMaxTimeout: 600_000,
        connectTimeout: 10_000,
      });
    });

    it('honours UNDICI_* env overrides', () => {
      process.env.UNDICI_CONNECTIONS = '8';
      process.env.UNDICI_KEEP_ALIVE_TIMEOUT_MS = '5000';
      process.env.UNDICI_KEEP_ALIVE_MAX_TIMEOUT_MS = '90000';
      process.env.UNDICI_CONNECT_TIMEOUT_MS = '2500';

      buildDispatcher();

      expect(AgentMock).toHaveBeenCalledWith({
        connections: 8,
        keepAliveTimeout: 5000,
        keepAliveMaxTimeout: 90000,
        connect: { timeout: 2500 },
      });
    });

    it('falls back to defaults for non-numeric overrides', () => {
      process.env.UNDICI_CONNECTIONS = 'not-a-number';
      buildDispatcher();
      expect(AgentMock).toHaveBeenCalledWith(
        expect.objectContaining({ connections: DISPATCHER_DEFAULTS.connections }),
      );
    });

    it('falls back to defaults for zero / negative overrides', () => {
      process.env.UNDICI_CONNECTIONS = '0';
      process.env.UNDICI_CONNECT_TIMEOUT_MS = '-1';
      buildDispatcher();
      expect(AgentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          connections: DISPATCHER_DEFAULTS.connections,
          connect: { timeout: DISPATCHER_DEFAULTS.connectTimeout },
        }),
      );
    });
  });

  describe('installGlobalDispatcher', () => {
    it('builds an agent and installs it as the global dispatcher', () => {
      const agent = installGlobalDispatcher();

      expect(AgentMock).toHaveBeenCalledTimes(1);
      expect(setGlobalDispatcherMock).toHaveBeenCalledTimes(1);
      expect(setGlobalDispatcherMock).toHaveBeenCalledWith(agent);
    });
  });
});
