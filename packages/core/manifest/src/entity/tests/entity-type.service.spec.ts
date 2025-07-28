import { Test, TestingModule } from '@nestjs/testing'
import { EntityTypeService } from '../services/entity-type.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { AppManifest, PropType } from '../../../../types/src'
import { EntityTsTypeInfo } from '../types/entity-ts-type-info'

describe('EntityTypeService', () => {
  let service: EntityTypeService

  const appManifest: AppManifest = {
    name: 'TestApp',
    entities: {
      user: {
        className: 'User',
        nameSingular: 'user',
        namePlural: 'users',
        slug: 'users',
        mainProp: 'username',
        properties: [
          {
            name: 'username',
            type: PropType.String
          },
          {
            name: 'age',
            type: PropType.Number
          },
          {
            name: 'email',
            type: PropType.String
          },
          {
            name: 'date',
            type: PropType.Date
          },
          {
            name: 'category',
            type: PropType.Choice,
            options: {
              values: ['admin', 'user', 'guest']
            }
          },
          {
            name: 'avatar',
            type: PropType.Image,
            options: {
              sizes: {
                small: {
                  width: 50,
                  height: 50
                },
                medium: {
                  width: 100,
                  height: 100
                },
                large: {
                  width: 200,
                  height: 200
                }
              }
            }
          },
          {
            name: 'group',
            type: PropType.Nested,
            options: { group: 'NestedEntity', multiple: false }
          }
        ],
        relationships: [
          {
            name: 'posts',
            entity: 'Post',
            type: 'one-to-many'
          },
          {
            name: 'group',
            entity: 'Group',
            type: 'many-to-one'
          },
          {
            name: 'favoriteFruits',
            entity: 'Fruit',
            type: 'many-to-many'
          }
        ],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      },
      contributor: {
        className: 'Contributor',
        nameSingular: 'contributor',
        namePlural: 'contributors',
        slug: 'contributors',
        mainProp: 'name',
        authenticable: true,
        properties: [
          {
            name: 'name',
            type: PropType.String
          },
          {
            name: 'group',
            type: PropType.Nested,
            options: { group: 'NestedEntity' }
          }
        ],
        relationships: [],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      },
      nestedEntity: {
        className: 'NestedEntity',
        nameSingular: 'nestedEntity',
        namePlural: 'nestedEntities',
        slug: 'nested-entities',
        mainProp: 'title',
        properties: [
          {
            name: 'title',
            type: PropType.String
          }
        ],
        relationships: [],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        },
        nested: true
      }
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityTypeService,
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: () => appManifest
          }
        }
      ]
    }).compile()

    service = module.get<EntityTypeService>(EntityTypeService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateEntityTypeInfos', () => {
    it('should generate type infos for entities with properties', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      expect(entityTypeInfos).toHaveLength(4) // One for the entity and one for the DTO

      expect(entityTypeInfos[0].name).toBe('User')
      expect(entityTypeInfos[0].properties).toHaveLength(
        appManifest.entities.user.properties.length +
          appManifest.entities.user.relationships.length +
          1
      ) // +1 for the id property
    })

    it('should generate type infos for entities with relationships', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      expect(entityTypeInfos[0].properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'posts',
            type: 'Post[]',
            isRelationship: true
          }),
          expect.objectContaining({
            name: 'group',
            type: 'Group',
            isRelationship: true
          }),
          expect.objectContaining({
            name: 'favoriteFruits',
            type: 'Fruit[]',
            isRelationship: true
          })
        ])
      )
    })

    it('should generate type infos for multiple nested entities', () => {
      const entityTypeInfos: EntityTsTypeInfo[] =
        service.generateEntityTypeInfos()

      console.log(entityTypeInfos[1].properties)

      const nestedEntityInfo = entityTypeInfos.find(
        (info) => info.name === 'NestedEntity'
      )
      const parentEntityInfo = entityTypeInfos.find(
        (info) => info.name === 'Contributor'
      )

      // Nested entity should be included in the type infos.
      expect(nestedEntityInfo).toBeDefined()
      expect(nestedEntityInfo.nested).toBe(true)
      expect(nestedEntityInfo.properties).toHaveLength(2) // id + title

      const groupProperty = parentEntityInfo.properties.find(
        (prop) => prop.name === 'group'
      )
      expect(groupProperty).toBeDefined()
      expect(groupProperty.type).toBe('string') // Should be string as it will be overridden later.
      expect(groupProperty.manifestPropType).toBe(PropType.Nested)
    })

    it('should generate type infos for non multiple nested entities', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const userProperties = entityTypeInfos[0].properties
      const groupProperty = userProperties.find((prop) => prop.name === 'group')

      console.log(groupProperty)

      expect(groupProperty).toBeDefined()
      expect(groupProperty.type).toBe('string') // Should be string as it will be overridden later.
    })

    it('should include values in the property type is Choice (enum)', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const userProperties = entityTypeInfos[0].properties

      const categoryProperty = userProperties.find(
        (prop) => prop.name === 'category'
      )

      expect(categoryProperty).toBeDefined()
      expect(categoryProperty.values).toEqual(['admin', 'user', 'guest'])
    })

    it('should include sizes in the property type is Image', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const userProperties = entityTypeInfos[0].properties

      const avatarProperty = userProperties.find(
        (prop) => prop.name === 'avatar'
      )
      expect(avatarProperty).toBeDefined()
      expect(avatarProperty.sizes).toEqual({
        small: { width: 50, height: 50 },
        medium: { width: 100, height: 100 },
        large: { width: 200, height: 200 }
      })
    })

    it('should add authenticable properties if the entity is authenticable', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const contributorProperties = entityTypeInfos[1].properties

      const emailProperty = contributorProperties.find(
        (prop) => prop.name === 'email'
      )
      const passwordProperty = contributorProperties.find(
        (prop) => prop.name === 'password'
      )
      expect(emailProperty).toBeDefined()
      expect(emailProperty.type).toBe('string')
      expect(passwordProperty).toBeDefined()
      expect(passwordProperty.type).toBe('string')
    })

    it('should create DTO types for entities with properties', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      expect(entityTypeInfos[2].name).toBe('CreateUpdateUserDto')
      expect(entityTypeInfos[2].properties).toHaveLength(
        appManifest.entities.user.properties.length +
          appManifest.entities.user.relationships.filter(
            (relationship) => relationship.type !== 'one-to-many' // Exclude one-to-many relationships from DTOs as they are on the opposite side.
          ).length
      ) // No id property in DTO.
    })

    it('should not create DTO types for nested entities', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const nestedEntityInfo = entityTypeInfos.find(
        (info) => info.name === 'NestedEntity'
      )
      expect(nestedEntityInfo).toBeDefined()
      expect(nestedEntityInfo.nested).toBe(true)
      expect(nestedEntityInfo.properties).toHaveLength(2) // id + title
      expect(entityTypeInfos).not.toContainEqual(
        expect.objectContaining({ name: 'CreateUpdateNestedEntityDto' })
      )
    })

    it('should create DTO types for entities with relationships', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      expect(entityTypeInfos[2].properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'groupId',
            type: 'string',
            isRelationship: true,
            optional: true
          }),
          expect.objectContaining({
            name: 'favoriteFruitIds',
            type: 'string[]',
            isRelationship: true,
            optional: true
          })
        ])
      )
    })
  })

  describe('generateTSInterfaceFromEntityTypeInfo', () => {
    it('should generate a string representation of the TypeScript interface', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const tsInterface = service.generateTSInterfaceFromEntityTypeInfo(
        entityTypeInfos[0]
      )
      expect(tsInterface).toContain('export interface User {')
      expect(tsInterface).toContain('id: string;')
      expect(tsInterface).toContain('username: string;')
      expect(tsInterface).toContain('age: number;')
      expect(tsInterface).toContain('email: string;')
      expect(tsInterface).toContain('date: Date;')
      expect(tsInterface).toContain("category: 'admin' | 'user' | 'guest';")
      expect(tsInterface).toContain('avatar: {')
      expect(tsInterface).toContain('small: string;')
      expect(tsInterface).toContain('medium: string;')
      expect(tsInterface).toContain('large: string')
      expect(tsInterface).toContain('posts?: Post[];')
      expect(tsInterface).toContain('group?: Group;')
      expect(tsInterface).toContain('favoriteFruits?: Fruit[];')
    })
  })
})
