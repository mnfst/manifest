// Mock the compression package so we can assert that the SSE filter delegates
// to the package default for non-SSE responses.
jest.mock('compression', () => {
  const fn = jest.fn();
  // compression is `export = compression` with a `.filter` static.
  (fn as unknown as { filter: jest.Mock }).filter = jest.fn().mockReturnValue(true);
  return fn;
});

import type { Request, Response } from 'express';
import compression from 'compression';
import { shouldCompress } from './compression-filter';

const defaultFilterMock = (compression as unknown as { filter: jest.Mock }).filter;

function makeRes(contentType: unknown): Response {
  return {
    getHeader: jest.fn().mockReturnValue(contentType),
  } as unknown as Response;
}

const req = {} as Request;

describe('shouldCompress', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns false for an SSE (text/event-stream) response', () => {
    const res = makeRes('text/event-stream');
    expect(shouldCompress(req, res)).toBe(false);
    expect(defaultFilterMock).not.toHaveBeenCalled();
  });

  it('returns false for an SSE response with charset/whitespace suffix', () => {
    const res = makeRes('text/event-stream; charset=utf-8');
    expect(shouldCompress(req, res)).toBe(false);
  });

  it('matches case-insensitively', () => {
    const res = makeRes('Text/Event-Stream');
    expect(shouldCompress(req, res)).toBe(false);
  });

  it('delegates to the package default filter for JSON responses', () => {
    const res = makeRes('application/json');
    expect(shouldCompress(req, res)).toBe(true);
    expect(defaultFilterMock).toHaveBeenCalledTimes(1);
    expect(defaultFilterMock).toHaveBeenCalledWith(req, res);
  });

  it('returns the default filter result (false) when the default declines', () => {
    defaultFilterMock.mockReturnValueOnce(false);
    const res = makeRes('image/png');
    expect(shouldCompress(req, res)).toBe(false);
  });

  it('delegates when no Content-Type header is set', () => {
    const res = makeRes(undefined);
    expect(shouldCompress(req, res)).toBe(true);
    expect(defaultFilterMock).toHaveBeenCalledWith(req, res);
  });

  it('handles array-valued Content-Type headers (uses first entry)', () => {
    const res = makeRes(['text/event-stream', 'extra']);
    expect(shouldCompress(req, res)).toBe(false);
  });

  it('delegates for an empty array Content-Type', () => {
    const res = makeRes([]);
    expect(shouldCompress(req, res)).toBe(true);
    expect(defaultFilterMock).toHaveBeenCalledWith(req, res);
  });

  it('uses an injected default filter when provided', () => {
    const injected = jest.fn().mockReturnValue(false);
    const res = makeRes('application/json');
    expect(shouldCompress(req, res, injected)).toBe(false);
    expect(injected).toHaveBeenCalledWith(req, res);
    expect(defaultFilterMock).not.toHaveBeenCalled();
  });
});
