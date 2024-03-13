import { Test, TestingModule } from '@nestjs/testing';
import { EntityMetaService } from './entity-meta.service';

describe('EntityMetaService', () => {
  let service: EntityMetaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityMetaService],
    }).compile();

    service = module.get<EntityMetaService>(EntityMetaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
