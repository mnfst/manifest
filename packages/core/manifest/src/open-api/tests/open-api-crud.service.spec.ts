import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { EntityManifest, PropType } from '@mnfst/types'

describe('OpenApiCrudService', () => {
  let service: OpenApiCrudService

  const dummyEntityManifest: EntityManifest = {
    className: 'Cat',
    nameSingular: 'cat',
    namePlural: 'cats',
    slug: 'cats',
    mainProp: 'name',
    seedCount: 50,
    belongsTo: [],
    properties: [
      {
        name: 'name',
        type: PropType.String
      }
    ]
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiCrudService]
    }).compile()

    service = module.get<OpenApiCrudService>(OpenApiCrudService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should generate all 6 entity paths', () => {
    const paths = service.generateEntityPaths(dummyEntityManifest)

    expect(paths).toBeDefined()
    expect(paths.length).toBe(6)

    expect(service.generateListPath).toHaveBeenCalled()
    expect(service.generateListSelectOptionsPath).toHaveBeenCalled()
    expect(service.generateCreatePath).toHaveBeenCalled()
    expect(service.generateDetailPath).toHaveBeenCalled()
    expect(service.generateUpdatePath).toHaveBeenCalled()
    expect(service.generateDeletePath).toHaveBeenCalled()
  })
})
