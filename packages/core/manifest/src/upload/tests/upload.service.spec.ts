import { Test, TestingModule } from '@nestjs/testing'
import { UploadService } from '../services/upload.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { StorageService } from '../../storage/services/storage.service'
import { PropType, PropertyManifest } from '../../../../types/src'
import { DEFAULT_IMAGE_SIZES } from '../../constants'

describe('UploadService', () => {
  let service: UploadService
  let storageService: StorageService
  let entityManifestService: EntityManifestService

  const dummyImageProp: PropertyManifest = {
    name: 'avatar',
    type: PropType.Image,
    options: {
      sizes: DEFAULT_IMAGE_SIZES
    }
  }
  const imagePaths = { large: 'imagePaths' }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: StorageService,
          useValue: {
            store: jest.fn(),
            storeImage: jest.fn(() => imagePaths)
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(() => ({
              properties: [
                dummyImageProp,
                {
                  name: 'not-an-image',
                  type: PropType.String,
                  options: { required: true }
                }
              ]
            }))
          }
        }
      ]
    }).compile()

    service = module.get<UploadService>(UploadService)
    storageService = module.get<StorageService>(StorageService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('storeFile', () => {
    it('should store a file', async () => {
      const file = {
        buffer: Buffer.from('file content'),
        originalname: 'file.txt'
      }

      const entity = 'entity'
      const property = 'property'
      const path = 'path'

      jest.spyOn(storageService, 'store').mockReturnValue(Promise.resolve(path))

      expect(await service.storeFile({ file, entity, property })).toEqual(path)

      expect(storageService.store).toHaveBeenCalledWith(entity, property, file)
    })
  })

  describe('store image', () => {
    it('should store an image', () => {
      const image = {
        buffer: Buffer.from('image content'),
        originalname: 'image.jpg'
      }

      const entity = 'entity'

      const result = service.storeImage({
        image,
        entity,
        property: dummyImageProp.name
      })

      expect(result).toEqual(imagePaths)

      expect(storageService.storeImage).toHaveBeenCalledWith(
        entity,
        dummyImageProp.name,
        image,
        dummyImageProp.options.sizes
      )
    })

    it('should fail if property is not an image', () => {
      const image = {
        buffer: Buffer.from('image content'),
        originalname: 'image.jpg'
      }

      const entity = 'entity'

      expect(() =>
        service.storeImage({
          image,
          entity,
          property: 'not-an-image'
        })
      ).toThrow()
    })
  })
})
