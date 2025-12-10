import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiSchemaService } from '../services/open-api-schema.service'
import {
  EntityTsTypeInfo,
  PropertyTsTypeInfo
} from '../../entity/types/entity-ts-type-info'
import { PropType } from '../../../../types/src'
import { propTypeFormats } from '../schemas/prop-type-formats'

describe('OpenApiSchemaService', () => {
  let service: OpenApiSchemaService

  const entityTsTypeInfos: EntityTsTypeInfo[] = [
    {
      name: 'Dog',
      properties: [
        { name: 'id', type: 'string', manifestPropType: PropType.String },
        { name: 'name', type: 'string', manifestPropType: PropType.String },
        { name: 'excerpt', type: 'string', manifestPropType: PropType.Text },
        {
          name: 'description',
          type: 'string',
          manifestPropType: PropType.RichText
        },
        { name: 'age', type: 'number', manifestPropType: PropType.Number },
        { name: 'website', type: 'string', manifestPropType: PropType.Link },
        { name: 'price', type: 'number', manifestPropType: PropType.Money },
        { name: 'birthdate', type: 'Date', manifestPropType: PropType.Date },
        {
          name: 'isGoodBoy',
          type: 'boolean',
          manifestPropType: PropType.Boolean
        },
        {
          name: 'acquiredAt',
          type: 'Date',
          manifestPropType: PropType.Timestamp
        },
        {
          name: 'password',
          type: 'string',
          manifestPropType: PropType.Password
        },
        { name: 'email', type: 'string', manifestPropType: PropType.Email },
        {
          name: 'favoriteToy',
          type: 'string',
          manifestPropType: PropType.Choice,
          values: ['ball', 'frisbee', 'bone']
        },
        {
          name: 'location',
          type: '{ lat: number; lng: number }',
          manifestPropType: PropType.Location
        },
        {
          name: 'certificate',
          type: 'string',
          manifestPropType: PropType.File
        },
        {
          name: 'photo',
          type: `{
            small: string;
            big: string;
          }`,
          manifestPropType: PropType.Image,
          sizes: {
            small: {
              width: 20,
              height: 20
            },
            big: {
              width: 1000,
              height: 1000
            }
          }
        },
        {
          name: 'trainer',
          type: 'Trainer',
          isRelationship: true,
          optional: true
        },
        {
          name: 'friends',
          type: 'Dog[]',
          isRelationship: true,
          optional: true
        }
      ]
    },
    {
      name: 'CreateUpdateDogDto',
      properties: [
        { name: 'id', type: 'string', manifestPropType: PropType.String },
        { name: 'name', type: 'string', manifestPropType: PropType.String },
        { name: 'excerpt', type: 'string', manifestPropType: PropType.Text },
        {
          name: 'description',
          type: 'string',
          manifestPropType: PropType.RichText
        },
        { name: 'age', type: 'number', manifestPropType: PropType.Number },
        { name: 'website', type: 'string', manifestPropType: PropType.Link },
        { name: 'price', type: 'number', manifestPropType: PropType.Money },
        { name: 'birthdate', type: 'Date', manifestPropType: PropType.Date },
        {
          name: 'isGoodBoy',
          type: 'boolean',
          manifestPropType: PropType.Boolean
        },
        {
          name: 'acquiredAt',
          type: 'Date',
          manifestPropType: PropType.Timestamp
        },
        {
          name: 'password',
          type: 'string',
          manifestPropType: PropType.Password
        },
        { name: 'email', type: 'string', manifestPropType: PropType.Email },
        {
          name: 'favoriteToy',
          type: 'string',
          manifestPropType: PropType.Choice,
          values: ['ball', 'frisbee', 'bone']
        },
        {
          name: 'location',
          type: '{ lat: number; lng: number }',
          manifestPropType: PropType.Location
        },
        {
          name: 'certificate',
          type: 'string',
          manifestPropType: PropType.File
        },
        {
          name: 'photo',
          type: '{[key:string]: string}',
          manifestPropType: PropType.Image,
          sizes: {
            small: {
              width: 20,
              height: 20
            },
            big: {
              width: 1000,
              height: 1000
            }
          }
        },
        {
          name: 'trainerId',
          type: 'string',
          isRelationship: true,
          optional: true
        },
        {
          name: 'friendIds',
          type: 'string[]',
          isRelationship: true,
          optional: true
        }
      ]
    }
  ]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiSchemaService]
    }).compile()

    service = module.get<OpenApiSchemaService>(OpenApiSchemaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getGeneralSchemas', () => {
    it('should return general schemas', () => {
      const schemas = service.getGeneralSchemas()
      expect(schemas).toBeDefined()
      expect(Object.keys(schemas)).toEqual(
        expect.arrayContaining([
          'Paginator',
          'SelectOption',
          'AppManifest',
          'EntityManifest',
          'RelationshipManifest',
          'PropertyManifest'
        ])
      )
    })
  })

  describe('generateEntitySchemas', () => {
    it('should generate schemas for entities with properties', () => {
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)
      expect(schemas).toBeDefined()
      expect(Object.keys(schemas)).toEqual(
        expect.arrayContaining(['Dog', 'CreateUpdateDogDto'])
      )
      expect(schemas.Dog).toBeDefined()
      expect(schemas.Dog.type).toBe('object')
      expect(schemas.Dog.description).toBe('Dog entity schema')
      expect(schemas.Dog.properties).toBeDefined()
    })

    it('should include type, example and description for each property', () => {
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)

      const properties = schemas.Dog.properties
      ;[
        'id',
        'name',
        'excerpt',
        'description',
        'age',
        'website',
        'price',
        'birthdate',
        'isGoodBoy',
        'acquiredAt',
        'password',
        'email',
        'favoriteToy',
        'location',
        'certificate',
        'photo'
      ].forEach((propName) => {
        expect(properties[propName]).toBeDefined()
        expect(properties[propName]['type']).toBeDefined()
        expect(properties[propName]['example']).toBeDefined()
        expect(properties[propName]['description']).toBeDefined()
      })
    })

    it('should include format for properties with specific types', () => {
      const propertiesThatExpectFormat: PropertyTsTypeInfo[] =
        entityTsTypeInfos[0].properties.filter(
          (property) =>
            propTypeFormats[property.manifestPropType] !== null &&
            !property.isRelationship
        )
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)

      const properties = schemas.Dog.properties
      propertiesThatExpectFormat.forEach((property) => {
        expect(properties[property.name]).toBeDefined()
        expect(properties[property.name]['format']).toBeDefined()
      })
    })

    it('should generate schemas for entities with relationships with reference to related entity', () => {
      const relationshipProperties: PropertyTsTypeInfo[] =
        entityTsTypeInfos[0].properties.filter(
          (property) => property.isRelationship
        )
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)

      const properties = schemas.Dog.properties
      relationshipProperties.forEach((property) => {
        expect(properties[property.name]).toBeDefined()

        const propertyType: string = property.type as string // Only Images are objects, others are strings.s

        const isArray = propertyType.endsWith('[]')

        if (isArray) {
          expect(properties[property.name]['type']).toEqual('array')
          expect(properties[property.name]['items']).toBeDefined()
          expect(properties[property.name]['items']['$ref']).toBeDefined()
          expect(properties[property.name]['items']['$ref']).toEqual(
            `#/components/schemas/${propertyType.replace('[]', '')}`
          )
        } else {
          expect(properties[property.name]['$ref']).toBeDefined()
          expect(properties[property.name]['$ref']).toEqual(
            `#/components/schemas/${propertyType}`
          )
        }
      })
    })

    it('should include values in the property type is Choice (enum)', () => {
      const choiceProperty = entityTsTypeInfos[0].properties.find(
        (property) => property.manifestPropType === PropType.Choice
      )

      expect(choiceProperty).toBeDefined()
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)
      const properties = schemas.Dog.properties
      expect(properties[choiceProperty.name]).toBeDefined()
      expect(properties[choiceProperty.name]['type']).toEqual('string')
      expect(properties[choiceProperty.name]['enum']).toEqual(
        choiceProperty.values
      )
      expect(properties[choiceProperty.name]['example']).toEqual(
        choiceProperty.values[0]
      )
      expect(properties[choiceProperty.name]['description']).toBeDefined()
    })

    it('should include sizes in the property type is Image', () => {
      const imageProperty = entityTsTypeInfos[0].properties.find(
        (property) => property.manifestPropType === PropType.Image
      )

      expect(imageProperty).toBeDefined()
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)
      const properties = schemas.Dog.properties

      expect(properties[imageProperty.name]).toBeDefined()
      expect(properties[imageProperty.name]['type']).toEqual('object')
      expect(properties[imageProperty.name]['properties']).toBeDefined()
      expect(properties[imageProperty.name]['properties']).toEqual(
        expect.objectContaining({
          small: {
            type: 'string',
            description: expect.stringMatching(/small/i), // The description should contain image size info
            example: 'https://example.com/image-small.jpg',
            format: 'uri'
          },
          big: {
            type: 'string',
            description: expect.stringMatching(/big/i), // The description should contain image size info
            example: 'https://example.com/image-big.jpg',
            format: 'uri'
          }
        })
      )
    })

    it('should not include the ID when the entity is nested', () => {
      const nestedEntityTsTypeInfos: EntityTsTypeInfo[] = [
        {
          name: 'NestedEntity',
          properties: [
            { name: 'name', type: 'string', manifestPropType: PropType.String },
            {
              name: 'description',
              type: 'string',
              manifestPropType: PropType.Text
            }
          ]
        }
      ]
      const schemas = service.generateEntitySchemas(nestedEntityTsTypeInfos)
      expect(schemas).toBeDefined()
      expect(schemas.NestedEntity).toBeDefined()
      expect(schemas.NestedEntity.type).toBe('object')
      expect(schemas.NestedEntity.properties).toBeDefined()
      expect(schemas.NestedEntity.properties.id).toBeUndefined()
    })

    it('should throw an error if the TS type is not found', () => {
      const invalidEntityTsTypeInfos: EntityTsTypeInfo[] = [
        {
          name: 'InvalidEntity',
          properties: [
            {
              name: 'name',
              type: 'InvalidType',
              manifestPropType: PropType.String
            }
          ]
        }
      ]

      expect(() => {
        service.generateEntitySchemas(invalidEntityTsTypeInfos)
      }).toThrow()
    })

    it('should create DTO types', () => {
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)

      expect(schemas).toBeDefined()
      expect(schemas.CreateUpdateDogDto).toBeDefined()
      expect(schemas.CreateUpdateDogDto.type).toBe('object')
      expect(schemas.CreateUpdateDogDto.description).toEqual(
        expect.stringContaining('CreateUpdateDogDto')
      )
      expect(schemas.CreateUpdateDogDto.properties).toBeDefined()
    })

    it('should include type, example and description for each property in DTO', () => {
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)
      const properties = schemas.CreateUpdateDogDto.properties
      ;[
        'id',
        'name',
        'excerpt',
        'description',
        'age',
        'website',
        'price',
        'birthdate',
        'isGoodBoy',
        'acquiredAt',
        'password',
        'email',
        'favoriteToy',
        'location',
        'certificate',
        'photo'
      ].forEach((propName) => {
        expect(properties[propName]).toBeDefined()
        expect(properties[propName]['type']).toBeDefined()
        expect(properties[propName]['example']).toBeDefined()
        expect(properties[propName]['description']).toBeDefined()
      })
    })

    it('should create DTO types for entities with relationships', () => {
      const relationshipProperties: PropertyTsTypeInfo[] =
        entityTsTypeInfos[1].properties.filter(
          (property) => property.isRelationship
        )
      const schemas = service.generateEntitySchemas(entityTsTypeInfos)
      const properties = schemas.CreateUpdateDogDto.properties
      relationshipProperties.forEach((property) => {
        const propertyType: string = property.type as string // Only Images are objects, others are strings.

        const isArray = propertyType.endsWith('[]')

        if (isArray) {
          expect(properties[property.name]).toBeDefined()
          expect(properties[property.name]['type']).toEqual('array')
          expect(properties[property.name]['items']).toBeDefined()
          expect(properties[property.name]['items']['type']).toEqual('string')
          expect(properties[property.name]['items']['format']).toEqual('uuid')
        } else {
          expect(properties[property.name]).toBeDefined()
          expect(properties[property.name]['type']).toEqual('string')
          expect(properties[property.name]['format']).toEqual('uuid')
        }
      })
    })
  })
})
