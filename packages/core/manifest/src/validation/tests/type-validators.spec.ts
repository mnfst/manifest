import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifest, PropType } from '@repo/types'
import { ValidationService } from '../services/validation.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('Validators for property types', () => {
  let service: ValidationService

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
  })

  it('string type expects a string value', async () => {
    const goodValues = ['test', '']
    const badValues = [1, true]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.String
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.String
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('text type expects a string value', async () => {
    const goodValues = ['test', '']
    const badValues = [1, true]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Text
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Text
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('richtext type expects a string value', async () => {
    const goodValues = ['test', '']
    const badValues = [1, true]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.RichText
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.RichText
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('password type expects a mandatory string value', async () => {
    const goodValues = ['test', '']
    const badValues = [1, true]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Password
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Password
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('number type expects a number value', async () => {
    const goodValues = [1, 0, -1]
    const badValues = ['test', true, '1']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Number
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Number
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('link type expects a valid URL', async () => {
    const goodValues = [
      'http://test.com',
      'https://www.example.org',
      'www.example.org',
      'wikipedia.com'
    ]
    const badValues = ['test', true, '1']

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Link
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Link
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('money type expects a number value with maximum 2 digits after coma', async () => {
    const goodValues = [1, 0, 1.1, 1.11]
    const badValues = ['test', -1, true, '1', 1.123]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Money
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Money
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('date type expects a YYYY-MM-DD date', async () => {
    const goodValues = ['2021-01-01', '2021-12-31', '2030-12-31']
    const badValues = [
      'bad',
      '2021-13-01',
      '2021-12-32',
      '2021-12-31T26:00:00',
      '2021-12-31T20:00:00',
      new Date()
    ]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Date
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Date
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('boolean type expects a boolean value', async () => {
    const goodValues = [true, false]
    const badValues = ['wrong', '1', '0', 'true', 'false', 2]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Boolean
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Boolean
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('timestamp type expects a datetime string', async () => {
    const goodValues = [
      '2025-02-02T09:20:00.000Z',
      '2025-02-02T09:20:00Z',
      '2025-02-02T09:20:00'
    ]

    const badValues = [
      new Date().getTime(),
      new Date('2030-01-01').getTime(),
      1631355097
    ]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Timestamp
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Timestamp
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('email type expects a valid email', async () => {
    const goodValues = ['admin@manifest.build', 'test@example.com']
    const badValues = [
      'test',
      'test@',
      'test@.',
      'test@test',
      'test.com',
      'a@b.c'
    ]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Email
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Email
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('choice type expects a value from the values array', async () => {
    const valuesArray = ['a', 'b', 'c']

    const goodValues = ['a', 'b', 'c']
    const badValues = ['d', 'e', 'f', '1', 1, true, {}, []]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Choice,
        options: { values: valuesArray }
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Choice,
        options: { values: valuesArray }
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('location type expects and valid location object', async () => {
    const goodValues = [
      { lat: 12, lng: 13 },
      { lat: 0, lng: 0 },
      { lat: 90, lng: 180 }
    ]
    const badValues = [
      'wrong',
      {},
      { lat: 13 },
      { lng: 12 },
      { latitude: 1, longitude: 2 },
      { lat: 91, lng: 180 },
      { lat: 90, lng: 181 },
      false,
      '{lat: 12, lng: 13}'
    ]

    const goodValidations = goodValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Location
      })
    )

    const badValidations = badValues.map((value) =>
      service.validateProperty(value, {
        name: 'test',
        label: 'Test',
        type: PropType.Location
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )

    expect(badValidations.every((validation) => validation.length === 1)).toBe(
      true
    )
  })

  it('file, image and nested types always return null', async () => {
    const types = [PropType.File, PropType.Image, PropType.Nested]

    const goodValidations = types.map((type) =>
      service.validateProperty(null, {
        name: 'test',
        label: 'Test',
        type
      })
    )

    expect(goodValidations.every((validation) => validation.length === 0)).toBe(
      true
    )
  })
})
