import { Test, TestingModule } from '@nestjs/testing';
import { ManifestService } from './manifest.service';

describe('ManifestService', () => {
  let service: ManifestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManifestService],
    }).compile();

    service = module.get<ManifestService>(ManifestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
