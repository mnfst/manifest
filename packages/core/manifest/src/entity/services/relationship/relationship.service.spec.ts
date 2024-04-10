import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipService } from './relationship.service';

describe('RelationshipService', () => {
  let service: RelationshipService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RelationshipService],
    }).compile();

    service = module.get<RelationshipService>(RelationshipService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
