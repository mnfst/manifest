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
    it('should throw an error when 2 relationships have the same name', () => {
      const manifestWithDuplicateBelongsToRelationships: Manifest = {
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
                name: 'owner',
                entity: 'User'
              },
              {
                name: 'owner',
                entity: 'User'
              }
            ]
          }
        }
      }
      const manifestWithDuplicateMixedRelationships: Manifest = {
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
                name: 'owner',
                entity: 'User'
              }
            ],
            belongsToMany: [
              {
                name: 'owner',
                entity: 'SomethingElse'
              }
            ]
          }
        }
      }
      const manifestWithDuplicateMixedSyntaxRelationships: Manifest = {
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
                name: 'owners',
                entity: 'User'
              }
            ],
            belongsToMany: ['owner'] // Gets pluralized
          }
        }
      }

      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })

      service.validateCustomLogic(manifestWithDuplicateBelongsToRelationships)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION FAILED')
      )

      service.validateCustomLogic(manifestWithDuplicateMixedRelationships)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION FAILED')
      )

      service.validateCustomLogic(manifestWithDuplicateMixedSyntaxRelationships)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION FAILED')
      )
    })

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
        expect.stringContaining('VALIDATION FAILED')
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
        expect.stringContaining('VALIDATION FAILED')
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
        expect.stringContaining('VALIDATION FAILED')
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
        expect.stringContaining('VALIDATION FAILED')
      )
    })

    it('should throw error when many-to-many relationship is declared on both sides', () => {
      const manifestWithDuplicateManyToMany: Manifest = {
        name: 'test app',
        entities: {
          User: {
            className: 'User',
            properties: [{ name: 'name', type: 'string' }],
            belongsToMany: ['Role']
          },
          Role: {
            className: 'Role',
            properties: [{ name: 'name', type: 'string' }],
            belongsToMany: ['User']
          }
        }
      }

      jest.spyOn(console, 'log').mockImplementation(() => {})
      jest.spyOn(process, 'exit').mockImplementation(() => {
        return null as never
      })

      service.validateCustomLogic(manifestWithDuplicateManyToMany)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VALIDATION FAILED')
      )
    })

    it('should allow many-to-many relationship declared on only one side', () => {
      const manifestWithCorrectManyToMany: Manifest = {
        name: 'test app',
        entities: {
          User: {
            className: 'User',
            properties: [{ name: 'name', type: 'string' }],
            belongsToMany: ['Role']
          },
          Role: {
            className: 'Role',
            properties: [{ name: 'name', type: 'string' }]
            // No belongsToMany declaration - this is correct
          }
        }
      }

      // Should not throw any errors
      expect(() =>
        service.validateCustomLogic(manifestWithCorrectManyToMany)
      ).not.toThrow()
    })
  })
})
