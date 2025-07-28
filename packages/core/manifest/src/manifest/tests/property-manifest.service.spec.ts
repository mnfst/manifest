import { Test, TestingModule } from '@nestjs/testing'
import { PropertyManifestService } from '../services/property-manifest.service'
import { PropertySchema } from '../../../../types/src'

describe('PropertyManifestService', () => {
  let service: PropertyManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PropertyManifestService]
    }).compile()

    service = module.get<PropertyManifestService>(PropertyManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should transform short-syntax property schema into a string property manifest', () => {
    const propSchema = 'title'
    const entitySchema = {
      validation: {
        title: { required: true }
      }
    }

    const result = service.transformPropertyManifest(propSchema, entitySchema)

    expect(result).toEqual({
      name: 'title',
      type: 'string',
      hidden: false,
      validation: { required: true }
    })
  })

  it('should transform long-syntax property schema into a full property manifest', () => {
    const propSchema: PropertySchema = {
      name: 'description',
      type: 'text',
      hidden: true,
      options: { maxLength: 500 },
      validation: { required: true },
      helpText: 'This is a description field.',
      default: 'Default description'
    }
    const entitySchema = {
      validation: {}
    }

    const result = service.transformPropertyManifest(propSchema, entitySchema)

    expect(result).toEqual({
      name: 'description',
      type: 'text',
      hidden: true,
      options: { maxLength: 500 },
      validation: { required: true },
      helpText: 'This is a description field.',
      default: 'Default description'
    })
  })

  it('should add default image sizes for image properties', () => {
    const propSchema: PropertySchema = {
      name: 'profileImage',
      type: 'image'
    }
    const entitySchema = {
      validation: {}
    }

    const result = service.transformPropertyManifest(propSchema, entitySchema)

    expect(result).toEqual({
      name: 'profileImage',
      type: 'image',
      hidden: false,
      options: {
        sizes: expect.objectContaining({
          thumbnail: { width: 80, height: 80 },
          medium: { width: 160, height: 160 }
        })
      },
      validation: {},
      helpText: '',
      default: undefined
    })
  })

  it('should create an empty options object if not provided', () => {
    const propSchema: PropertySchema = {
      name: 'stringProp',
      type: 'string'
    }
    const entitySchema = {
      validation: {}
    }

    const result = service.transformPropertyManifest(propSchema, entitySchema)

    expect(JSON.stringify(result.options)).toBe('{}')
  })
})
