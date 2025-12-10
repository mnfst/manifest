import { Test, TestingModule } from '@nestjs/testing'
import { ManifestWriterService } from '../services/manifest-writer.service'

describe('ManifestWriterService', () => {
  let service: ManifestWriterService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManifestWriterService]
    }).compile()

    service = module.get<ManifestWriterService>(ManifestWriterService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('createManifestEntity', () => {
    it('should create a new manifest entity', () => {})

    it('should throw an error if creation fails', () => {})

    it('should throw an error if a duplicate entity is created', () => {})
  })

  describe('updateManifestEntity', () => {
    it('should update an existing manifest entity', () => {})

    it('should throw an error if the entity does not exist', () => {})

    it('should throw an error if the update fails', () => {})
  })

  describe('deleteManifestEntity', () => {
    it('should delete an existing manifest entity', () => {})

    it('should throw an error if the entity does not exist', () => {})

    it('should throw an error if the deletion fails', () => {})
  })
})
