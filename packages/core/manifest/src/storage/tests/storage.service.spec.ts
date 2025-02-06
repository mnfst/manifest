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

  jest.mock('fs')
  jest.mock('mkdirp')
  jest.mock('sharp')

  const entity = 'entity'
  const property = 'property'
  const file = {
    buffer: Buffer.from('file'),
    originalname: 'file.jpg'
  }
  const baseUrl: string = 'http://localhost:3333'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(baseUrl)
          }
        }
      ]
    }).compile()

    service = module.get<StorageService>(StorageService)

    fs.writeFileSync = jest.fn()
    mkdirp.sync = jest.fn()
  })

  it('should store a file', () => {
    const filePath = service.store(entity, property, file)
    expect(filePath).toBeDefined()
  })

  it('should slugify the file name', () => {
    file.originalname = 'file with spaces and #Sp€çIaLChar$.jpg'

    const filePath = service.store(entity, property, file)
    expect(filePath).toContain('file-with-spaces-and-SpeurocIaLChardollar')
  })

  it('should create the upload folder', () => {
    service.store(entity, property, file)
    service.storeImage(entity, property, file, DEFAULT_IMAGE_SIZES)

    expect(mkdirp.sync).toHaveBeenCalledTimes(2)
  })

  it('should store an image in several sizes', () => {
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
      .spyOn(sharp.prototype, 'toFile')
      .mockImplementation(() => 'imagePath.jpg')

    const filePaths = service.storeImage(entity, property, file, imageSizes)

    expect(filePaths).toBeDefined()
    expect(Object.keys(filePaths).length).toBe(2)
    expect(Object.keys(filePaths)).toMatchObject(Object.keys(imageSizes))
  })

  it('should prepend the storage url before the path', () => {
    const filePath: string = service.store(entity, property, file)
    const imagePaths: { [key: string]: string } = service.storeImage(
      entity,
      property,
      file,
      DEFAULT_IMAGE_SIZES
    )

    expect(filePath).toContain(baseUrl)
    Object.keys(imagePaths).forEach((key: string) => {
      expect(imagePaths[key]).toContain(baseUrl)
    })
  })
})
