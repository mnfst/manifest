import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiManifestService } from '../services/open-api-manifest.service'
import { AppManifest, PropType } from '../../../../types/src'
import { API_PATH } from '../../constants'

describe('OpenApiManifestService', () => {
  let service: OpenApiManifestService

  const dummyAppManifest: AppManifest = {
    name: 'test app',
    entities: {
      Cat: {
        className: 'Cat',
        nameSingular: 'cat',
        namePlural: 'cats',
        slug: 'cats',
        mainProp: 'name',
        seedCount: 50,
        relationships: [],
        properties: [
          {
            name: 'name',
            type: PropType.String
          }
        ],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      }
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiManifestService]
    }).compile()

    service = module.get<OpenApiManifestService>(OpenApiManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should generate a route for the main app manifest', () => {
    const paths = service.generateManifestPaths(dummyAppManifest)

    const generatedPath = `/${API_PATH}/manifest`

    expect(paths[generatedPath]).toBeDefined()
    expect(paths[generatedPath].get).toBeDefined()
  })

  it('should generate a route for each entity', () => {
    const paths = service.generateManifestPaths(dummyAppManifest)

    const generatedPath = `/${API_PATH}/manifest/entities/${dummyAppManifest.entities.Cat.slug}`

    expect(paths[generatedPath]).toBeDefined()
    expect(paths[generatedPath].get).toBeDefined()
  })
})
