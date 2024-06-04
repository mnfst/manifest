import { Test, TestingModule } from '@nestjs/testing'
import { PropertyService } from './property.service'

describe('PropertyService', () => {
  let service: PropertyService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PropertyService]
    }).compile()

    service = module.get<PropertyService>(PropertyService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return the seed value for a property', () => {
    const propertyManifest = {
      type: 'string',
      options: {
        minLength: 5,
        maxLength: 10
      }
    } as any

    expect(service.getSeedValue(propertyManifest)).not.toBeNull()
  })
})
