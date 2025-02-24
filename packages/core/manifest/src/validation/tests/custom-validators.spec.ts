import { Test, TestingModule } from '@nestjs/testing'
import { PropType } from '@repo/types'
import { ValidationService } from '../services/validation.service'

describe('Custom validators', () => {
  let service: ValidationService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService]
    }).compile()

    service = module.get<ValidationService>(ValidationService)
  })

  it('equals type expects a value equal to that of comparing', async () => {
    const goodValues = [3]
    const badValues = [1]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { equals: 3 }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { equals: 3 }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('notEquals type expects a value not equal to that of comparing', async () => {
    const goodValues = [1]
    const badValues = [3]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { notEquals: 3 }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { notEquals: 3 }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('min type expects a value greater than or equal to the min value', async () => {
    const goodValues = [3, 4, 5]
    const badValues = [1, 2]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { min: 3 }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { min: 3 }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('max type expects a value less than or equal to the max value', async () => {
    const goodValues = [1, 2, 3]
    const badValues = [4, 5]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { max: 3 }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.Number,
        validation: { max: 3 }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isEmpty type expects a value to be empty', async () => {
    const goodValues = [undefined, null, '']
    const badValues = [1, 'test']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isEmpty: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isEmpty: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isNotEmpty type expects a value to not be empty', async () => {
    const goodValues = ['1', 'test']
    const badValues = [undefined, null, '']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isNotEmpty: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isNotEmpty: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('required type expect a value to not be empty (same as isNotEmpty)', async () => {
    const goodValues = ['1', 'test']
    const badValues = [undefined, null]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { required: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { required: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isDefined type expects a value to be defined', async () => {
    const goodValues = ['1', 'test']
    const badValues = [undefined, null]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isDefined: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isDefined: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  // TODO: equals and not equals.

  it('isIn type expects a value to be in the list of values', async () => {
    const goodValues = ['1', 'test']
    const badValues = ['bad', 'value']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isIn: ['1', 'test'] }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isIn: ['1', 'test'] }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isNotIn type expects a value to not be in the list of values', async () => {
    const goodValues = ['bad', 'value']
    const badValues = ['1', 'test']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isNotIn: ['1', 'test'] }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isNotIn: ['1', 'test'] }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('contains type expects a value to contain the seed', async () => {
    const goodValues = ['test', 'testing']
    const badValues = ['bad', 'value']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { contains: 'test' }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { contains: 'test' }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('notContains type expects a value to not contain the seed', async () => {
    const goodValues = ['bad', 'value']
    const badValues = ['test', 'testing']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { notContains: 'test' }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { notContains: 'test' }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isAlpha type expects a value to contain only letters', async () => {
    const goodValues = ['test', 'TestinG']
    const badValues = ['bad1', 'value2']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isAlpha: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isAlpha: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isAlphanumeric type expects a value to contain only letters and numbers', async () => {
    const goodValues = ['test1', 'TestinG2']
    const badValues = ['bad1!', 'value2@']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isAlphanumeric: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isAlphanumeric: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isAscii type expects a value to contain only ASCII characters', async () => {
    const goodValues = ['test', 'TestinG']
    const badValues = ['bad1€', 'value2✗']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isAscii: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isAscii: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isEmail type expects a value to be a valid email address', async () => {
    const goodValues = ['test@test.com', 'example@test.io']
    const badValues = ['bad', 'value']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isEmail: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isEmail: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isJSON type expects a value to be a valid JSON string', async () => {
    const goodValues = ['{"test": "value"}', '{"test": 1}']
    const badValues = ['bad', 'value']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isJSON: true }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { isJSON: true }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('minLength type expects a value to be at least the min length', async () => {
    const goodValues = ['test', 'testing']
    const badValues = ['bad', 'value']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { minLength: 4 }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { minLength: 6 }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('maxLength type expects a value to be at most the max length', async () => {
    const goodValues = ['test', 'testing']
    const badValues = ['bad', 'value']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { maxLength: 7 }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { maxLength: 2 }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('matches type expects a value to match the pattern', async () => {
    const goodValues = ['test', 'testing']
    const badValues = ['notG@@d', 'n€ither']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { matches: /^[a-z]+$/ } as any
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        type: PropType.String,
        validation: { matches: /^[a-z]+$/ } as any
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('isOptional type always returns null', async () => {
    const value = 'test'

    const validation = service.validateProperty(value, {
      name: 'test',
      type: PropType.String,
      validation: { isOptional: true }
    })

    expect(validation.length).toBe(0)
  })
})
