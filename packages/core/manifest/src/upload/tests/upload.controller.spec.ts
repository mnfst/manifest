import { Test, TestingModule } from '@nestjs/testing'
import { UploadController } from '../controllers/upload/upload.controller'

describe('UploadController', () => {
  let controller: UploadController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController]
    }).compile()

    controller = module.get<UploadController>(UploadController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('uploadFile', () => {
    it('should return the path of the uploaded file', () => {})

    it('creates unique file names', () => {})

    it('should return a 400 error if entity name or property is not provided', () => {})

    it('expect the file to be passed as "file" in a multipart/form-data', () => {})
  })
  describe('uploadImage', () => {
    it('should upload an image', () => {})

    it('should return a 400 error if entity name or property is not provided', () => {})

    it('expect the image to be passed as "image" in a multipart/form-data', () => {})
  })
})
