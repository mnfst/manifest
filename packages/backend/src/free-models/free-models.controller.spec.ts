import { FreeModelsController } from './free-models.controller';
import { FreeModelsService, FreeModelsResponse } from './free-models.service';

describe('FreeModelsController', () => {
  let controller: FreeModelsController;
  let service: FreeModelsService;

  const mockResponse: FreeModelsResponse = {
    providers: [
      {
        name: 'Cohere',
        logo: '/icons/cohere.svg',
        description: 'Free trial.',
        tags: ['No credit card required'],
        api_key_url: 'https://dashboard.cohere.com/api-keys',
        base_url: 'https://api.cohere.ai/compatibility/v1',
        warning: 'Trial keys only.',
        country: 'CA',
        flag: '\u{1F1E8}\u{1F1E6}',
        models: [
          {
            id: 'command-a-03-2025',
            name: 'Command A (111B)',
            context: '256K',
            max_output: '4K',
            modality: 'Text',
            rate_limit: '20 RPM',
          },
        ],
      },
    ],
    last_synced_at: '2026-04-17T00:00:00.000Z',
  };

  beforeEach(() => {
    service = { getAll: jest.fn().mockReturnValue(mockResponse) } as unknown as FreeModelsService;
    controller = new FreeModelsController(service);
  });

  describe('getFreeModels', () => {
    it('delegates to service.getAll()', () => {
      const result = controller.getFreeModels();
      expect(service.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });
});
