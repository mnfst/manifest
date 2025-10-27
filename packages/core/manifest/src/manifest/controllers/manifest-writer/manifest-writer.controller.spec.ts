import { Test, TestingModule } from '@nestjs/testing';
import { ManifestWriterController } from './manifest-writer.controller';

describe('ManifestWriterController', () => {
  let controller: ManifestWriterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestWriterController],
    }).compile();

    controller = module.get<ManifestWriterController>(ManifestWriterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
