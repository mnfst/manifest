import { Test, TestingModule } from '@nestjs/testing'
import { SchemaService } from '../services/schema.service'
import schemas from '@repo/json-schema'
import { Manifest } from '../../../../types/src'

describe('SchemaService', () => {
  let service: SchemaService

  const manifest: Manifest = {
    name: 'test app',
    entities: {
      Cat: {
        className: 'Cat'
      }
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaService]
    }).compile()

    service = module.get<SchemaService>(SchemaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should validate a manifest', () => {
    expect(service.validate(manifest)).toBe(true)
  })

  describe('Validate against schema', () => {
    it('should console log errors when schema validation fails', () => {
      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })

      service.validateAgainstSchema('wrong manifest' as any, schemas[0])

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed')
      )
    })
  })

  describe('Validate custom logic', () => {
    it('should console log errors when relationship entities do not exist', () => {
      const manifestWithNonExistingRelationships: Manifest = {
        name: 'test app',
        entities: {
          Cat: {
            className: 'Cat',
            belongsTo: [
              {
                name: 'Dragon',
                entity: 'Dragon'
              }
            ]
          }
        }
      }

      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })

      service.validateCustomLogic(manifestWithNonExistingRelationships)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed')
      )
    })
  })
})
