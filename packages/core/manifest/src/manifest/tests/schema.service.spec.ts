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
        className: 'Cat',
        properties: [
          {
            name: 'name',
            type: 'string'
          },
          {
            name: 'age',
            type: 'number',
            default: 18
          }
        ]
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
    it('should throw error when relationship entities do not exist', () => {
      const manifestWithNonExistingRelationships: Manifest = {
        name: 'test app',
        entities: {
          Cat: {
            className: 'Cat',
            properties: [
              {
                name: 'name',
                type: 'string'
              },
              {
                name: 'age',
                type: 'number',
                default: 18
              }
            ],
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

    it('should throw error when group properties do not exist', () => {
      const manifestWithNonExistingGroups: Manifest = {
        name: 'test app',
        entities: {
          Cat: {
            className: 'Cat',
            properties: [
              {
                name: 'name',
                type: 'string'
              },
              {
                name: 'age',
                type: 'number',
                default: 18
              },
              {
                name: 'groupedProperty',
                type: 'group',
                options: { group: 'nonExistingGroup' }
              }
            ]
          }
        }
      }

      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })

      service.validateCustomLogic(manifestWithNonExistingGroups)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed')
      )
    })

    it('should throw an error when groups have groups properties', () => {
      const manifestWithGroupProperties: Manifest = {
        name: 'test app',
        entities: {
          Cat: {
            className: 'Cat',
            properties: [
              { name: 'name', type: 'string' },
              { name: 'age', type: 'number', default: 18 },
              {
                name: 'groupedProperty',
                type: 'group',
                options: { group: 'group1' }
              }
            ]
          }
        },
        groups: {
          group1: {
            properties: [
              { name: 'nestedProperty', type: 'string' },
              {
                name: 'groupedProperty',
                type: 'group',
                options: { group: 'group1' }
              }
            ]
          }
        }
      }

      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })
      service.validateCustomLogic(manifestWithGroupProperties)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed')
      )
    })

    it('should throw error when policy entities do not exist', () => {
      const manifestWithNonExistingPolicies: Manifest = {
        name: 'test app',
        entities: {
          Cat: {
            className: 'Cat',
            properties: [
              {
                name: 'name',
                type: 'string'
              },
              {
                name: 'age',
                type: 'number',
                default: 18
              }
            ],
            policies: {
              create: [{ access: 'restricted', allow: 'NonExistingEntity' }]
            }
          }
        }
      }

      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })

      service.validateCustomLogic(manifestWithNonExistingPolicies)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed')
      )
    })
  })
})
