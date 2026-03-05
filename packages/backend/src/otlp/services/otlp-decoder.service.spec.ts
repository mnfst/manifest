import { UnsupportedMediaTypeException } from '@nestjs/common';
import * as protobuf from 'protobufjs';
import { OtlpDecoderService } from './otlp-decoder.service';
import { OTLP_PROTO_SCHEMA } from '../proto/otlp-proto-defs';

describe('OtlpDecoderService', () => {
  let service: OtlpDecoderService;

  beforeEach(() => {
    service = new OtlpDecoderService();
    service.onModuleInit();
  });

  describe('decodeTraces', () => {
    it('returns body as-is for application/json content type', () => {
      const body = { resourceSpans: [{ resource: { attributes: [] }, scopeSpans: [] }] };
      const result = service.decodeTraces('application/json', body);
      expect(result).toBe(body);
    });

    it('returns body as-is when content type is empty', () => {
      const body = { resourceSpans: [] };
      const result = service.decodeTraces('', body);
      expect(result).toBe(body);
    });

    it('returns body as-is when content type is undefined', () => {
      const body = { resourceSpans: [] };
      const result = service.decodeTraces(undefined, body);
      expect(result).toBe(body);
    });

    it('handles content type with charset parameter', () => {
      const body = { resourceSpans: [] };
      const result = service.decodeTraces('application/json; charset=utf-8', body);
      expect(result).toBe(body);
    });

    it('throws UnsupportedMediaTypeException for unsupported content type', () => {
      expect(() => service.decodeTraces('text/plain', {})).toThrow(UnsupportedMediaTypeException);
    });

    it('throws UnsupportedMediaTypeException for empty protobuf body', () => {
      expect(() => service.decodeTraces('application/x-protobuf', {}, Buffer.alloc(0))).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('throws UnsupportedMediaTypeException when rawBody is undefined for protobuf', () => {
      expect(() => service.decodeTraces('application/x-protobuf', {}, undefined)).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('decodes a valid protobuf body', () => {
      const { root } = protobuf.parse(OTLP_PROTO_SCHEMA);
      const TraceType = root.lookupType('ExportTraceServiceRequest');
      const payload = {
        resourceSpans: [
          {
            resource: { attributes: [] },
            scopeSpans: [
              {
                scope: { name: 'test-scope' },
                spans: [],
              },
            ],
          },
        ],
      };
      const errMsg = TraceType.verify(payload);
      expect(errMsg).toBeNull();
      const message = TraceType.create(payload);
      const buffer = Buffer.from(TraceType.encode(message).finish());
      expect(buffer.length).toBeGreaterThan(0);

      const result = service.decodeTraces('application/x-protobuf', {}, buffer);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('resourceSpans');
    });
  });

  describe('decodeMetrics', () => {
    it('returns body as-is for JSON content type', () => {
      const body = { resourceMetrics: [] };
      const result = service.decodeMetrics('application/json', body);
      expect(result).toBe(body);
    });

    it('throws for unsupported content type', () => {
      expect(() => service.decodeMetrics('text/xml', {})).toThrow(UnsupportedMediaTypeException);
    });
  });

  describe('decodeLogs', () => {
    it('returns body as-is for JSON content type', () => {
      const body = { resourceLogs: [] };
      const result = service.decodeLogs('application/json', body);
      expect(result).toBe(body);
    });

    it('handles case-insensitive content type', () => {
      const body = { resourceLogs: [] };
      const result = service.decodeLogs('Application/JSON', body);
      expect(result).toBe(body);
    });
  });
});
