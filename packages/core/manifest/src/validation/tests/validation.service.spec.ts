import { Test, TestingModule } from '@nestjs/testing'
import { ValidationService } from '../services/validation.service'
import { EntityManifest, PropType, PropertyManifest } from '@repo/types'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('ValidationService', () => {
  let service: ValidationService
  let entityManifestService: EntityManifestService

  const catDto = {
    name: 'Fluffy',
    age: 3,
    breed: 'Persian'
  }

  const catManifest: EntityManifest = {
    className: 'Cat',
    properties: [
      {
        name: 'name',
        type: PropType.String
      },
      {
        name: 'age',
        type: PropType.Number
      },
      {
        name: 'breed',
        type: PropType.String
      }
    ]
  } as EntityManifest

  const numberPropertyManifest: PropertyManifest = {
    name: 'count',
    type: PropType.Number
  }

  const numberPropertyManifestWithValidation: PropertyManifest = {
    name: 'count',
    type: PropType.Number,
    validation: {
      min: 3
    }
  }

  const optionalPropertyManifest: PropertyManifest = {
    name: 'website',
    type: PropType.Link,
    validation: {
      contains: '.com',
      isOptional: true
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn().mockReturnValue(catManifest)
          }
        }
      ]
    }).compile()

    service = module.get<ValidationService>(ValidationService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('validate', () => {
    it('should validate each property', () => {
      jest.spyOn(service, 'validateProperty').mockImplementation(() => [])

      const validation = service.validate(catDto, catManifest)

      expect(validation).toEqual([])
      expect(service.validateProperty).toHaveBeenCalledTimes(
        Object.keys(catDto).length
      )
    })

    it('should return an array of errors', () => {
      jest.spyOn(service, 'validateProperty').mockImplementation(() => [
        {
          property: 'propName',
          constraints: {
            test: 'error'
          }
        }
      ])

      const validation = service.validate(catDto, catManifest)

      validation.every((error) => {
        expect(error).toMatchObject({
          property: 'propName',
          constraints: {
            test: 'error'
          }
        })
      })
    })

    it('should validate nested entities', () => {
      const parentEntityManifest: EntityManifest = {
        className: 'ParentEntity',
        nameSingular: 'parent',
        namePlural: 'parents',
        slug: 'parents',
        mainProp: 'title',
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        },
        properties: [
          {
            name: 'title',
            type: PropType.String
          }
        ],
        relationships: [
          {
            name: 'child',
            type: 'one-to-one',
            entity: 'ChildEntity',
            nested: true
          },
          {
            name: 'children',
            type: 'one-to-many',
            entity: 'ChildEntity',
            nested: true
          }
        ]
      } as EntityManifest

      const childEntityManifest: EntityManifest = {
        className: 'ChildEntity',
        nameSingular: 'child',
        namePlural: 'children',
        slug: 'children',
        mainProp: 'name',
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        },
        relationships: [
          {
            name: 'parent',
            type: 'one-to-one',
            entity: 'ParentEntity',
            nested: true
          },
          {
            name: 'parents',
            type: 'one-to-many',
            entity: 'ParentEntity',
            nested: true
          }
        ],
        properties: [
          {
            name: 'name',
            type: PropType.String
          },
          {
            name: 'age',
            type: PropType.Number,
            validation: { min: 99 }
          }
        ]
      } as EntityManifest

      const parentDto = {
        title: 'Parent Title',
        child: {
          name: 'Child Name',
          age: 5
        },
        children: [
          {
            name: 'Child 1',
            age: 3
          },
          {
            name: 'Child 2',
            age: 100 // This one passes validation.
          },
          {
            name: 'Child 3',
            age: 2
          }
        ]
      }

      jest
        .spyOn(entityManifestService, 'getEntityManifest')
        .mockReturnValue(childEntityManifest)

      const validation = service.validate(parentDto, parentEntityManifest)

      expect(validation.length).toBe(3)
      expect(validation[0].property).toBe('child.age')
      expect(validation[0].constraints.min).toBeDefined()

      // Validate children array with correct indices.
      expect(validation[1].property).toBe('children[0].age')
      expect(validation[1].constraints.min).toBeDefined()
      expect(validation[2].property).toBe('children[2].age')
      expect(validation[2].constraints.min).toBeDefined()
    })
  })

  describe('validateProperty', () => {
    it('should validate the property type if value is defined', () => {
      const passingValidation = service.validateProperty(
        3,
        numberPropertyManifest
      )
      const failingValidation = service.validateProperty(
        '3',
        numberPropertyManifest
      )

      expect(passingValidation).toEqual([])

      expect(failingValidation.length).toBe(1)
      expect(failingValidation[0].constraints.type).toEqual(expect.any(String))
    })

    it('should skip type validation if value is undefined', () => {
      const errorsWhenUndefined = service.validateProperty(
        undefined,
        numberPropertyManifest
      )
      const errorsWhenNull = service.validateProperty(
        null,
        numberPropertyManifest
      )

      expect(errorsWhenUndefined).toEqual([])
      expect(errorsWhenNull).toEqual([])
    })

    it('should validate the property against a validation schema', () => {
      const validationErrors = service.validateProperty(
        2,
        numberPropertyManifestWithValidation
      )

      expect(validationErrors.length).toBe(1)
      expect(validationErrors[0].constraints.min).toEqual(expect.any(String))
    })

    it('should skip custom validation if the "isOptional" validation rule is set', () => {
      const errorsWhenUndefined = service.validateProperty(
        undefined,
        optionalPropertyManifest
      )
      const errorsWhenNull = service.validateProperty(
        null,
        optionalPropertyManifest
      )
      const errorsWhenWrongValue = service.validateProperty(
        'https://example.org',
        optionalPropertyManifest
      )

      expect(errorsWhenUndefined).toEqual([])
      expect(errorsWhenNull).toEqual([])
      expect(errorsWhenWrongValue.length).toBe(1)
      expect(errorsWhenWrongValue[0].constraints.contains).toEqual(
        expect.any(String)
      )
    })
  })
})
