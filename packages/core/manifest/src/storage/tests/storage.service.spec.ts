import { Test, TestingModule } from '@nestjs/testing'
import { DEFAULT_IMAGE_SIZES } from '../../constants'
import { ImageSizesObject } from '../../../../types/src'
import { ConfigService } from '@nestjs/config'
import { StorageService } from '../services/storage.service'

const fs = require('fs')
const mkdirp = require('mkdirp')
const sharp = require('sharp')

describe('StorageService', () => {
  let service: StorageService
  let configService: ConfigService

  jest.mock('fs')
  jest.mock('mkdirp')
  jest.mock('sharp')

  const entity = 'entity'
  const property = 'property'
  const file = {
    buffer: Buffer.from('file'),
    originalname: 'file.jpg'
  }
  const base64Image =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/eb7jLwAAAAASUVORK5CYII='
  const image = {
    buffer: Buffer.from(base64Image, 'base64'),
    originalname: 'test.jpg'
  }

  const baseUrl: string = 'http://localhost:3333'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((setting) => {
              if (setting === 'baseUrl') {
                return baseUrl
              }
              return null
            })
          }
        }
      ]
    }).compile()

    service = module.get<StorageService>(StorageService)
    configService = module.get<ConfigService>(ConfigService)

    fs.writeFileSync = jest.fn()
    mkdirp.sync = jest.fn()
  })

  describe('local storage', () => {
    it('should store a file', async () => {
      const filePath = await service.store(entity, property, file)
      expect(filePath).toBeDefined()
    })

    it('should slugify the file name', async () => {
      file.originalname = 'file with spaces and #Sp€çIaLChar$.jpg'

      const filePath = await service.store(entity, property, file)
      expect(filePath).toContain('file-with-spaces-and-SpeurocIaLChardollar')
    })

    it('should create the upload folder', async () => {
      await service.store(entity, property, file)

      await service.storeImage(entity, property, image, DEFAULT_IMAGE_SIZES)

      expect(mkdirp.sync).toHaveBeenCalledTimes(2)
    })

    it('should store an image in several sizes', async () => {
      const imageSizes: ImageSizesObject = {
        tiny: {
          height: 100
        },
        huge: {
          width: 1000
        }
      }

      jest
        .spyOn(sharp.prototype, 'jpeg')
        .mockImplementation(() => sharp.prototype)
      jest
        .spyOn(sharp.prototype, 'resize')
        .mockImplementation(() => sharp.prototype)
      jest
        .spyOn(sharp.prototype, 'toBuffer')
        .mockImplementation(() => Promise.resolve(Buffer.from('')))

      const filePaths = await service.storeImage(
        entity,
        property,
        image,
        imageSizes
      )

      expect(filePaths).toBeDefined()
      expect(Object.keys(filePaths).length).toBe(2)
      expect(Object.keys(filePaths)).toMatchObject(Object.keys(imageSizes))
      expect(sharp.prototype.resize).toHaveBeenCalledTimes(2)
      expect(sharp.prototype.toBuffer).toHaveBeenCalledTimes(2)
    })

    it('should prepend the storage url before the path', async () => {
      const filePath: string = await service.store(entity, property, file)
      const imagePaths: { [key: string]: string } = await service.storeImage(
        entity,
        property,
        image,
        DEFAULT_IMAGE_SIZES
      )

      expect(filePath).toContain(baseUrl)
      Object.keys(imagePaths).forEach((key: string) => {
        expect(imagePaths[key]).toContain(baseUrl)
      })
    })
  })

  describe('S3 storage', () => {
    beforeEach(() => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        switch (key) {
          case 'storage.s3Bucket':
            return 'test-bucket'
          case 'storage.s3Endpoint':
            return 'http://localhost:4566'
          case 'storage.s3Region':
            return 'us-east-1'
          case 'storage.s3AccessKeyId':
            return 'test-access-key-id'
          case 'storage.s3SecretAccessKey':
            return 'test-secret-access-key'
          default:
            return null
        }
      })

      service = new StorageService(configService)
    })

    it('should initialize the S3 client', () => {
      expect(service['s3Client']).toBeDefined()
    })

    it('should upload a file to S3', async () => {
      const uploadToS3Spy = jest
        .spyOn(service as any, 'uploadToS3')
        .mockResolvedValue('s3-file-url')

      const filePath = await service.store(entity, property, file)
      expect(uploadToS3Spy).toHaveBeenCalled()
      expect(filePath).toBe('s3-file-url')
    })

    it('should upload an image to S3', async () => {
      const uploadToS3Spy = jest
        .spyOn(service as any, 'uploadToS3')
        .mockResolvedValue('s3-image-url')

      const imageSizes: ImageSizesObject = {
        tiny: {
          height: 100
        },
        huge: {
          width: 1000
        }
      }

      const filePaths = await service.storeImage(
        entity,
        property,
        image,
        imageSizes
      )
      expect(uploadToS3Spy).toHaveBeenCalledTimes(2)
      expect(filePaths.tiny).toBe('s3-image-url')
      expect(filePaths.huge).toBe('s3-image-url')
    })
  })
})
