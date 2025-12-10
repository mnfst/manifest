import { Test, TestingModule } from '@nestjs/testing'
import { UploadController } from '../controllers/upload.controller'
import { UploadService } from '../services/upload.service'

describe('UploadController', () => {
  let controller: UploadController
  let uploadService: UploadService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        {
          provide: UploadService,
          useValue: {
            storeFile: jest.fn(),
            storeImage: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<UploadController>(UploadController)
    uploadService = module.get<UploadService>(UploadService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('uploadFile', () => {
    it('should return the path of the uploaded file', async () => {
      const file = {
        buffer: Buffer.from('file content'),
        originalname: 'file.txt'
      }

      const entity = 'entity'
      const property = 'property'
      const path = 'path'

      jest
        .spyOn(uploadService, 'storeFile')
        .mockReturnValue(Promise.resolve(path))

      expect(await controller.uploadFile(file, entity, property)).toEqual({
        path
      })

      expect(uploadService.storeFile).toHaveBeenCalledWith({
        file,
        entity,
        property
      })
    })
  })
  describe('uploadImage', () => {
    it('should upload an image', async () => {
      const image = {
        buffer: Buffer.from('image content'),
        originalname: 'image.jpg'
      }

      const entity = 'entity'
      const property = 'property'
      const imagePaths = { thumbnail: 'path', medium: 'path' }

      jest
        .spyOn(uploadService, 'storeImage')
        .mockReturnValue(Promise.resolve(imagePaths))

      expect(await controller.uploadImage(image, entity, property)).toEqual(
        imagePaths
      )

      expect(uploadService.storeImage).toHaveBeenCalledWith({
        image,
        entity,
        property
      })
    })
  })
})
