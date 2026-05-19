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

  it('maps grouped Anthropic thinking rows with conditional visibility and serializer', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'anthropic-api-key-base-thinking-type',
        provider: 'anthropic',
        auth_type: 'api_key',
        model_name: null,
        param_key: 'type',
        group_key: 'thinking',
        group_label: 'Thinking',
        control_kind: 'select',
        label: 'Thinking mode',
        default_value: 'disabled',
        values: ['disabled', 'adaptive', 'enabled'],
        min_value: null,
        max_value: null,
        step_value: null,
        serializer: 'anthropic_thinking',
        depends_on_key: null,
        depends_on_value: null,
        sort_order: 50,
      },
      {
        id: 'anthropic-api-key-base-thinking-budget-tokens',
        provider: 'anthropic',
        auth_type: 'api_key',
        model_name: null,
        param_key: 'budget_tokens',
        group_key: 'thinking',
        group_label: 'Thinking',
        control_kind: 'number',
        label: 'Budget tokens',
        default_value: 4096,
        values: null,
        min_value: 1024,
        max_value: null,
        step_value: null,
        serializer: 'anthropic_thinking',
        depends_on_key: 'type',
        depends_on_value: 'enabled',
        sort_order: 60,
      },
    ]);

    const specs = await service.getSpecs('anthropic', 'api_key', 'claude-sonnet-4-6');

    expect(specs).toMatchObject([
      {
        key: 'type',
        group: { key: 'thinking', label: 'Thinking' },
        control: {
          kind: 'select',
          label: 'Thinking mode',
          values: ['disabled', 'adaptive', 'enabled'],
          default: 'disabled',
        },
      },
      {
        key: 'budget_tokens',
        group: { key: 'thinking', label: 'Thinking' },
        visibleWhen: { key: 'type', equals: 'enabled' },
        control: { kind: 'number', label: 'Budget tokens', min: 1024, default: 4096 },
      },
    ]);
    expect(specs[0].group?.serialize?.({ type: 'adaptive' })).toEqual({
      thinking: { type: 'adaptive' },
    });
    expect(specs[0].group?.serialize?.({ type: 'enabled', budget_tokens: 4096 })).toEqual({
      thinking: { type: 'enabled', budget_tokens: 4096 },
    });
    expect(specs[0].group?.serialize?.({ type: 'disabled' })).toEqual({});
  });

  it('maps provider param dependency metadata', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'anthropic-api-key-base-top-k',
        provider: 'anthropic',
        auth_type: 'api_key',
        model_name: null,
        param_key: 'top_k',
        group_key: null,
        group_label: null,
        control_kind: 'number',
        label: 'Top K',
        default_value: 0,
        values: null,
        min_value: 0,
        max_value: null,
        step_value: null,
        serializer: null,
        depends_on_key: null,
        depends_on_value: null,
        dependencies: [
          {
            effect: 'disable',
            when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
          },
          {
            effect: 'omit',
            when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
          },
        ],
        sort_order: 40,
      },
    ]);

    await expect(service.getSpecs('anthropic', 'api_key', 'claude-sonnet-4-6')).resolves.toEqual([
      {
        key: 'top_k',
        control: { kind: 'number', label: 'Top K', min: 0, default: 0 },
        dependencies: [
          {
            effect: 'disable',
            when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
          },
          {
            effect: 'omit',
            when: { key: 'thinking.type', values: ['adaptive', 'enabled'] },
          },
        ],
      },
    ]);
  });
});
