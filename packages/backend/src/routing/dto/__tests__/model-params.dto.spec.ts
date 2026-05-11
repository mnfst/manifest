import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DeleteModelParamsBodyDto,
  ModelParamsBodyDto,
  SetModelParamsBodyDto,
  ThinkingParamsDto,
} from '../model-params.dto';

describe('model-params DTOs', () => {
  describe('ThinkingParamsDto', () => {
    it('accepts the two known values', () => {
      for (const type of ['enabled', 'disabled']) {
        const dto = plainToInstance(ThinkingParamsDto, { type });
        expect(validateSync(dto)).toHaveLength(0);
      }
    });

    it('rejects unknown values', () => {
      const dto = plainToInstance(ThinkingParamsDto, { type: 'maybe' });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });
  });

  describe('SetModelParamsBodyDto', () => {
    it('accepts a well-formed body and constructs the nested ModelParamsBodyDto via @Type', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { thinking: { type: 'disabled' } },
      });
      // `params` is constructed by @Type(() => ModelParamsBodyDto) — proves
      // the factory function ran.
      expect(dto.params).toBeInstanceOf(ModelParamsBodyDto);
      expect(dto.params.thinking).toBeInstanceOf(ThinkingParamsDto);
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejects an invalid nested params payload', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { thinking: { type: 'bogus' } },
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });

    it('rejects unknown authType values (limited to AUTH_TYPES)', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'bogus',
        model: 'deepseek-v4',
        params: { thinking: { type: 'disabled' } },
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });

    it('rejects when params is missing (ValidateIf forces the field)', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });
  });

  describe('DeleteModelParamsBodyDto', () => {
    it('accepts a route identity body', () => {
      const dto = plainToInstance(DeleteModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejects empty provider', () => {
      const dto = plainToInstance(DeleteModelParamsBodyDto, {
        provider: '',
        authType: 'api_key',
        model: 'deepseek-v4',
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });
  });
});
