import { Test, TestingModule } from '@nestjs/testing';
import { ManifestController } from './manifest.controller';

describe('ManifestController', () => {
  let controller: ManifestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestController],
    }).compile();

    controller = module.get<ManifestController>(ManifestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
