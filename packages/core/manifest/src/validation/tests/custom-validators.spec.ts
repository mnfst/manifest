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

    console.log(goodValidations, badValidations)

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

    console.log(goodValidations, badValidations)

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

  // TODO: Continue with the rest of the custom validators.
})
