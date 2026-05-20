import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DeleteModelParamsBodyDto, SetModelParamsBodyDto } from '../model-params.dto';

describe('model-params DTOs', () => {
  describe('SetModelParamsBodyDto', () => {
    it('accepts a well-formed body with arbitrary param keys', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        scope: 'tier:default',
        provider: 'anthropic',
        authType: 'api_key',
        model: 'claude-sonnet-4-6',
        params: { thinking: { type: 'enabled', budget_tokens: 4096 } },
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejects unknown authType values', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        scope: 'tier:default',
        provider: 'deepseek',
        authType: 'bogus',
        model: 'deepseek-v4',
        params: { thinking: { type: 'disabled' } },
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });

    it('rejects when scope or params are missing', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });

    it('rejects params that are not a JSON object', () => {
      const dto = plainToInstance(SetModelParamsBodyDto, {
        scope: 'tier:default',
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { temperature: Number.NaN },
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });

    it('rejects params nested beyond the validator depth limit', () => {
      let params: Record<string, unknown> = { value: 'enabled' };
      for (let index = 0; index < 120; index += 1) {
        params = { nested: params };
      }

      const dto = plainToInstance(SetModelParamsBodyDto, {
        scope: 'tier:default',
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params,
      });

      expect(validateSync(dto).length).toBeGreaterThan(0);
    });
  });

  describe('DeleteModelParamsBodyDto', () => {
    it('accepts a scoped route identity body', () => {
      const dto = plainToInstance(DeleteModelParamsBodyDto, {
        scope: 'specificity:coding',
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
      });
      expect(validateSync(dto)).toHaveLength(0);
    });

    it('rejects empty scope or provider', () => {
      const dto = plainToInstance(DeleteModelParamsBodyDto, {
        scope: '',
        provider: '',
        authType: 'api_key',
        model: 'deepseek-v4',
      });
      expect(validateSync(dto).length).toBeGreaterThan(0);
    });
  });
});
