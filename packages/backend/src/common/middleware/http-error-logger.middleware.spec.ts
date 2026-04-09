import { httpErrorLogger } from './http-error-logger.middleware';
import { EventEmitter } from 'events';

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    originalUrl: '/v1/chat/completions',
    headers: { 'user-agent': 'test-agent/1.0' },
    ip: '127.0.0.1',
    ...overrides,
  } as never;
}

function mockRes(statusCode: number) {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { statusCode }) as never;
}

describe('httpErrorLogger', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(jest.requireActual('@nestjs/common').Logger.prototype, 'warn');
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('logs a warning for 4xx responses', () => {
    const req = mockReq();
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('400 POST /v1/chat/completions');
  });

  it('logs a warning for 5xx responses', () => {
    const req = mockReq({ method: 'GET', originalUrl: '/api/v1/health' });
    const res = mockRes(500);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('500 GET /api/v1/health');
  });

  it('does not log for successful responses', () => {
    const req = mockReq();
    const res = mockRes(200);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not log for 3xx responses', () => {
    const req = mockReq();
    const res = mockRes(301);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('includes user-agent in the log', () => {
    const req = mockReq({ headers: { 'user-agent': 'custom-ua/2.0' } });
    const res = mockRes(404);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy.mock.calls[0][0]).toContain('ua=custom-ua/2.0');
  });

  it('uses x-forwarded-for when present', () => {
    const req = mockReq({
      headers: { 'user-agent': 'ua', 'x-forwarded-for': '1.2.3.4' },
    });
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy.mock.calls[0][0]).toContain('ip=1.2.3.4');
  });

  it('uses first entry when x-forwarded-for is an array', () => {
    const req = mockReq({
      headers: { 'user-agent': 'ua', 'x-forwarded-for': ['5.6.7.8', '9.0.1.2'] },
    });
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy.mock.calls[0][0]).toContain('ip=5.6.7.8');
  });

  it('falls back to req.ip when no x-forwarded-for', () => {
    const req = mockReq({ ip: '10.0.0.1' });
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy.mock.calls[0][0]).toContain('ip=10.0.0.1');
  });

  it('handles missing user-agent header', () => {
    const req = mockReq({ headers: {} });
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy.mock.calls[0][0]).toContain('ua=');
  });

  it('truncates long user-agent strings', () => {
    const longUa = 'x'.repeat(200);
    const req = mockReq({ headers: { 'user-agent': longUa } });
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    const logMessage = warnSpy.mock.calls[0][0] as string;
    const uaPart = logMessage.split('ua=')[1];
    expect(uaPart.length).toBeLessThanOrEqual(120);
  });

  it('handles missing ip gracefully', () => {
    const req = mockReq({ ip: undefined, headers: { 'user-agent': 'ua' } });
    const res = mockRes(400);
    const next = jest.fn();

    httpErrorLogger(req, res, next);
    (res as unknown as EventEmitter).emit('finish');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('ip=');
  });
});
