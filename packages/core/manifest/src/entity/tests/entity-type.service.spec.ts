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
          }
        ],
        relationships: [
          {
            name: 'posts',
            entity: 'Post',
            type: 'one-to-many'
          },
          {
            name: 'widget',
            entity: 'NestedEntity',
            nested: true,
            type: 'one-to-one'
          },
          {
            name: 'testimonials',
            entity: 'Testimonial',
            type: 'one-to-many',
            nested: true
          },
          {
            name: 'favoriteFruits',
            entity: 'Fruit',
            type: 'many-to-many'
          },
          {
            name: 'parent',
            entity: 'Parent',
            type: 'many-to-one'
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
      expect(entityTypeInfos).toHaveLength(5) // One for the entity and one for the DTO (unless nested entity that has no DTO)

      const userEntityTypeInfo = entityTypeInfos.find(
        (e: EntityTsTypeInfo) => e.name === 'User'
      )

      expect(userEntityTypeInfo.properties).toHaveLength(
        appManifest.entities.user.properties.length +
          appManifest.entities.user.relationships.length +
          1
      ) // +1 for the id property
    })

    it('should generate type infos for entities with relationships', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()

      const userEntityTypeInfo = entityTypeInfos.find(
        (e: EntityTsTypeInfo) => e.name === 'User'
      )

      expect(userEntityTypeInfo.properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'posts',
            type: 'Post[]',
            isRelationship: true
          }),
          expect.objectContaining({
            name: 'widget',
            type: 'NestedEntity',
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

      const nestedEntityInfo = entityTypeInfos.find(
        (info) => info.name === 'NestedEntity'
      )
      const userEntityTypeInfo = entityTypeInfos.find(
        (e: EntityTsTypeInfo) => e.name === 'User'
      )

      // Nested entity should be included in the type infos.
      expect(nestedEntityInfo).toBeDefined()
      expect(nestedEntityInfo.nested).toBe(true)
      expect(nestedEntityInfo.properties).toHaveLength(2) // id + title

      const groupProperty = userEntityTypeInfo.properties.find(
        (prop) => prop.name === 'testimonials'
      )
      expect(groupProperty).toBeDefined()
      expect(groupProperty.type).toBe('Testimonial[]')
      expect(groupProperty.manifestPropType).toBeUndefined() // Should not have a manifestPropType as it is a nested entity.
    })

    it('should generate type infos for non multiple nested entities', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()

      const userEntityTypeInfo = entityTypeInfos.find(
        (e: EntityTsTypeInfo) => e.name === 'User'
      )

      const userProperties = userEntityTypeInfo.properties
      const groupProperty = userProperties.find(
        (prop) => prop.name === 'widget'
      )

      expect(groupProperty).toBeDefined()
      expect(groupProperty.type).toBe('NestedEntity')
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

      const userDtoEntityTypeInfo = entityTypeInfos.find(
        (e: EntityTsTypeInfo) => e.name === 'CreateUpdateUserDto'
      )
      expect(userDtoEntityTypeInfo).toBeDefined()
      expect(userDtoEntityTypeInfo.properties).toHaveLength(
        appManifest.entities.user.properties.length +
          appManifest.entities.user.relationships.filter(
            (relationship) =>
              relationship.type !== 'one-to-many' || relationship.nested
          ).length
      )
    })

    it('should create DTO types for entities with relationships', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()

      const userDtoEntityTypeInfo = entityTypeInfos.find(
        (e: EntityTsTypeInfo) => e.name === 'CreateUpdateUserDto'
      )

      expect(userDtoEntityTypeInfo).toBeDefined()
      expect(userDtoEntityTypeInfo.properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'parentId',
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

    it('should create DTO types for entities with multiple nested entities', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()

      const parentEntityInfo = entityTypeInfos.find(
        (info) => info.name === 'User'
      )

      const groupProperty = parentEntityInfo.properties.find(
        (prop) => prop.name === 'widget'
      )
      expect(groupProperty).toBeDefined()
      expect(groupProperty.type).toBe('NestedEntity')
    })

    it('should create DTO types for non multiple nested entities', () => {
      const entityTypeInfos = service.generateEntityTypeInfos()
      const parentEntityInfo = entityTypeInfos.find(
        (info) => info.name === 'User'
      )

      const groupProperty = parentEntityInfo.properties.find(
        (prop) => prop.name === 'testimonials'
      )
      expect(groupProperty).toBeDefined()
      expect(groupProperty.type).toBe('Testimonial[]')
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
      expect(tsInterface).toContain('widget?: NestedEntity;')
      expect(tsInterface).toContain('testimonials?: Testimonial[];')
      expect(tsInterface).toContain('favoriteFruits?: Fruit[];')
      expect(tsInterface).toContain('parent?: Parent;')
    })
  })
})
