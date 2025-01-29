import { Test, TestingModule } from '@nestjs/testing';
import { OpenApiEndpointService } from './open-api.endpoint.service';

describe('OpenApiEndpointService', () => {
  let service: OpenApiEndpointService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiEndpointService],
    }).compile();

    service = module.get<OpenApiEndpointService>(OpenApiEndpointService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
