import { Test, TestingModule } from '@nestjs/testing'
import { BackendSDK } from './backend-sdk'
import { CrudService } from '../crud/services/crud.service'
import { UploadService } from '../upload/services/upload.service'
import { base64ToBlob } from '../../../common/src'

describe('SdkService', () => {
  let sdk: BackendSDK
  let crudService: CrudService
  let uploadService: UploadService

  const dummyItem = { id: 1, name: 'Timiaou', color: 'brown' } as any
  const dummySlug = 'cats'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackendSDK,
        {
          provide: CrudService,
          useValue: {
            findAll: jest.fn(() => Promise.resolve([dummyItem])),
            findOne: jest.fn(() => Promise.resolve(dummyItem)),
            store: jest.fn((slug, itemDto) => itemDto),
            update: jest.fn((params) =>
              params.partialReplacement
                ? Object.assign(dummyItem, params.itemDto)
                : params.itemDto
            ),
            delete: jest.fn(() => Promise.resolve(dummyItem))
          }
        },
        {
          provide: UploadService,
          useValue: {
            storeFile: jest.fn(() => 'file-path'),
            storeImage: jest.fn(() => ({ original: 'file-path' }))
          }
        }
      ]
    }).compile()

    sdk = module.get<BackendSDK>(BackendSDK)
    crudService = module.get<CrudService>(CrudService)
    uploadService = module.get<UploadService>(UploadService)
  })

  it('should be defined', () => {
    expect(sdk).toBeDefined()
  })

  describe('CRUD singles', () => {
    it('should return a single entity', async () => {
      const result = await sdk.single('homePage').get()

      expect(result).toEqual(dummyItem)
      expect(crudService.findOne).toHaveBeenCalledWith({
        entitySlug: 'homePage',
        id: 1,
        fullVersion: true
      })
    })

    it('should update a single entity', async () => {
      const newName = 'new name'

      const result = await sdk.single('homePage').update({
        name: newName
      })

      expect(result).toEqual({ name: newName })
    })

    it('should patch a single entity', async () => {
      const newName = 'new name'

      const result = await sdk.single('homePage').update({
        name: newName
      })

      expect(result['name']).toEqual(newName)
    })
  })

  describe('CRUD collections', () => {
    it('should return a collection of entities', async () => {
      const result = await sdk.from(dummySlug).find()

      expect(result).toEqual([dummyItem])
    })

    it('should return a single entity from a collection', async () => {
      const result = await sdk.from(dummySlug).findOneById(1)

      expect(result).toEqual(dummyItem)
    })

    it('should create a new entity in a collection', async () => {
      const entity = { name: 'test' }

      const result = await sdk.from(dummySlug).create(entity)

      expect(result).toEqual(entity)
      expect(crudService.store).toHaveBeenCalledWith(dummySlug, entity)
    })

    it('should update an entity in a collection', async () => {
      const result = await sdk.from(dummySlug).update(1, { name: 'new name' })

      expect(result).toEqual({ name: 'new name' })
    })

    it('should patch an entity in a collection', async () => {
      const result = await sdk.from(dummySlug).patch(1, { name: 'new name' })

      expect(result).toEqual({ name: 'new name', color: 'brown', id: 1 })
    })

    it('should delete an entity in a collection', async () => {
      const result = await sdk.from(dummySlug).delete(1)

      expect(result).toEqual(dummyItem)
      expect(crudService.delete).toHaveBeenCalledWith(dummySlug, 1)
    })
  })

  describe('Upload', () => {
    it('should upload a file', async () => {
      const file = new Blob(['Hello, this is a test file!'], {
        type: 'text/plain'
      })
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)

      const response = sdk.from(dummySlug).upload('test', {
        buffer: fileBuffer,
        originalname: 'test333.txt'
      })
      expect(response).toBeDefined()
      expect(uploadService.storeFile).toHaveBeenCalledWith({
        entity: dummySlug,
        property: 'test',
        file: { buffer: fileBuffer, originalname: 'test333.txt' }
      })
    })

    it('should upload an image', async () => {
      const base64Image =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/eb7jLwAAAAASUVORK5CYII='
      const image: Blob = base64ToBlob(base64Image, 'image/png')
      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const response = sdk.from(dummySlug).uploadImage('test', {
        buffer,
        originalname: 'test333.png'
      })
      expect(response).toBeDefined()
      expect(uploadService.storeImage).toHaveBeenCalledWith({
        entity: dummySlug,
        property: 'test',
        image: { buffer, originalname: 'test333.png' }
      })
    })
  })
})
