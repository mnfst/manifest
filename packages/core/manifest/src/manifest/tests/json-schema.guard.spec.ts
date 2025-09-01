import { Test } from '@nestjs/testing'
import { JsonSchemaGuard } from '../guards/json-schema.guard'
import { SchemaService } from '../services/schema.service'
import { YamlService } from '../services/yaml.service'

describe('JsonSchemaGuard', () => {
  let jsonSchemaGuard: JsonSchemaGuard
  let schemaService: SchemaService
  let yamlService: YamlService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JsonSchemaGuard,
        {
          provide: SchemaService,
          useValue: {}
        },
        {
          provide: YamlService,
          useValue: {
            load: jest.fn()
          }
        }
      ]
    }).compile()

    jsonSchemaGuard = module.get<JsonSchemaGuard>(JsonSchemaGuard)
    schemaService = module.get<SchemaService>(SchemaService)
    yamlService = module.get<YamlService>(YamlService)
  })

  it('should be defined', () => {
    expect(new JsonSchemaGuard(schemaService, yamlService)).toBeDefined()
  })

  it('should throw an error if YAML file is invalid', () => {
    const context: any = {
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          body: {
            content: 'invalid content'
          }
        }))
      }))
    }
    expect(jsonSchemaGuard.canActivate(context)).rejects.toThrow()
  })

  it('should throw an error if the JSON Schema is invalid', () => {})

  it('should return true if the JSON Schema is valid', () => {})
})
