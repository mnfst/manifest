import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DeleteModelParamsBodyDto,
  ModelParamsBodyDto,
  SetModelParamsBodyDto,
} from '../model-params.dto';

describe('model-params DTOs', () => {
  describe('SetModelParamsBodyDto', () => {
    it('accepts a well-formed body and preserves arbitrary params keys for registry validation', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { thinking: 'disabled', temperature: 0.7 },
      });
      expect(dto).toBeInstanceOf(ModelParamsBodyDto);
      expect(dto.params).toEqual({ thinking: 'disabled', temperature: 0.7 });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('does not recurse into params values; the controller registry gate validates them', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { thinking: { type: 'bogus' } },
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejects unknown authType values (limited to AUTH_TYPES)', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'bogus',
        model: 'deepseek-v4',
        params: { thinking: 'disabled' },
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
