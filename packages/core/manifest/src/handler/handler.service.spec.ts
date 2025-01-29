import { Test, TestingModule } from '@nestjs/testing';
import { HandlerService } from './handler.service';

describe('HandlerService', () => {
  let service: HandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HandlerService],
    }).compile();

    service = module.get<HandlerService>(HandlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
