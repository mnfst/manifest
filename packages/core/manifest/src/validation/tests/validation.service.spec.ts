import { Test, TestingModule } from '@nestjs/testing'
import { ValidationService } from '../services/validation.service'
import { EntityManifest, PropType, PropertyManifest } from '@repo/types'

describe('ValidationService', () => {
  let service: ValidationService

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
      providers: [ValidationService]
    }).compile()

    service = module.get<ValidationService>(ValidationService)
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
