import { Test, TestingModule } from '@nestjs/testing';
import { ManifestFileController } from './manifest-file.controller';

describe('ManifestFileController', () => {
  let controller: ManifestFileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestFileController],
    }).compile();

    controller = module.get<ManifestFileController>(ManifestFileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
