import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProviderParamSpecEntity } from '../../../entities/provider-param-spec.entity';
import { ProviderParamSpecService } from '../provider-param-spec.service';

describe('ProviderParamSpecService', () => {
  let service: ProviderParamSpecService;
  let repo: { find: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderParamSpecService,
        { provide: getRepositoryToken(ProviderParamSpecEntity), useValue: repo },
      ],
    }).compile();
    service = module.get(ProviderParamSpecService);
  });

  it('resolves base specs by provider/auth and caches the registry', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'deepseek-api-key-base-thinking',
        provider: 'deepseek',
        auth_type: 'api_key',
        model_name: null,
        param_key: 'thinking',
        control_kind: 'toggle',
        label: 'Thinking mode',
        default_value: 'enabled',
        values: ['enabled', 'disabled'],
        min_value: null,
        max_value: null,
        step_value: null,
        serializer: null,
        sort_order: 10,
      },
    ]);

    await expect(service.getSpecs('DeepSeek', 'api_key', 'deepseek-v4')).resolves.toEqual([
      {
        key: 'thinking',
        control: {
          kind: 'toggle',
          label: 'Thinking mode',
          values: ['enabled', 'disabled'],
          default: 'enabled',
        },
      },
    ]);
    await expect(service.getSpecs('deepseek', 'api_key', 'other-model')).resolves.toHaveLength(1);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('uses model rows as wholesale overrides when present', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'unit-base-temperature',
        provider: 'unit',
        auth_type: 'api_key',
        model_name: null,
        param_key: 'temperature',
        control_kind: 'slider',
        label: 'Temperature',
        default_value: 1,
        values: null,
        min_value: 0,
        max_value: 2,
        step_value: null,
        serializer: null,
        sort_order: 10,
      },
      {
        id: 'unit-special-reasoning',
        provider: 'unit',
        auth_type: 'api_key',
        model_name: 'unit/special:model',
        param_key: 'reasoning_effort',
        control_kind: 'select',
        label: 'Reasoning effort',
        default_value: 'medium',
        values: ['low', 'medium', 'high'],
        min_value: null,
        max_value: null,
        step_value: null,
        serializer: null,
        sort_order: 10,
      },
    ]);

    await expect(
      service
        .getSpecs('unit', 'api_key', 'unit/special:model')
        .then((specs) => specs.map((s) => s.key)),
    ).resolves.toEqual(['reasoning_effort']);
    await expect(
      service.getSpecs('unit', 'api_key', 'other-model').then((specs) => specs.map((s) => s.key)),
    ).resolves.toEqual(['temperature']);
  });
});
