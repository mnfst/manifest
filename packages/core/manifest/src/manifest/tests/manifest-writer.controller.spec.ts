import { Test, TestingModule } from '@nestjs/testing'
import { ManifestWriterController } from '../controllers/manifest-writer.controller'

describe('ManifestWriterController', () => {
  let controller: ManifestWriterController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestWriterController]
    }).compile()

    controller = module.get<ManifestWriterController>(ManifestWriterController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  // TODO: Test that endpoints are restricted to authorized users only.
})
