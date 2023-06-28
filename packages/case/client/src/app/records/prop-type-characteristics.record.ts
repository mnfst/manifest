import { InputType } from '~shared/enums/input-type.enum'
import { PropType } from '~shared/enums/prop-type.enum'
import { YieldType } from '~shared/enums/yield-type.enum'

export type PropTypeCharacteristics = {
  input: InputType
  yield: YieldType
}

export const propTypeCharacteristicsRecord: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.Text]: {
    input: InputType.Text,
    yield: YieldType.Text
  },
  [PropType.Number]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Relation]: {
    input: InputType.Select,
    yield: YieldType.Link
  },

  // TODO: Create those propTypes (dummy for now).
  [PropType.RichText]: {
    input: InputType.Number,
    yield: YieldType.Number
  },

  [PropType.Currency]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Date]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.TextArea]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Color]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Email]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.File]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Image]: {
    input: InputType.Number,
    yield: YieldType.Number
  },
  [PropType.Boolean]: {
    input: InputType.Number,
    yield: YieldType.Number
  }

  // ! Legacy CASE v1
  //   [PropType.Text]: {
  //     server: {
  //       columnType: 'varchar',
  //       fakerFunction: 'faker.random.word()',
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsString'
  //     },
  //     client: {
  //       inputType: 'Text',
  //       yieldType: 'Text'
  //     }
  //   },

  //   [PropType.Currency]: {
  //     server: {
  //       columnType: 'decimal',
  //       fakerFunction: 'faker.finance.amount()',
  //       type: 'number',
  //       dtoValidatorDecorator: 'IsNumber'
  //     },
  //     client: {
  //       inputType: 'Number',
  //       yieldType: 'Currency'
  //     }
  //   },
  //   [PropType.Date]: {
  //     server: {
  //       columnType: 'date',
  //       columnOptions: `{ default: () => '(CURRENT_DATE)' }`,
  //       fakerFunction: 'faker.date.past()',
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsDateString'
  //     },
  //     client: {
  //       inputType: 'Datepicker',
  //       yieldType: 'Date'
  //     }
  //   },
  //   [PropType.TextArea]: {
  //     server: {
  //       columnType: 'text',
  //       fakerFunction: 'faker.lorem.paragraphs()',
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsString'
  //     },
  //     client: {
  //       inputType: 'Textarea',
  //       yieldType: 'Text'
  //     }
  //   },
  //   [PropType.Color]: {
  //     server: {
  //       columnType: 'varchar',
  //       fakerFunction: 'faker.internet.color()',
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsString'
  //     },
  //     client: {
  //       inputType: 'ColorPicker',
  //       yieldType: 'Color'
  //     }
  //   },
  //   [PropType.Email]: {
  //     server: {
  //       columnType: 'varchar',
  //       fakerFunction: 'faker.internet.email()',
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsEmail'
  //     },
  //     client: {
  //       inputType: 'Email',
  //       yieldType: 'Text'
  //     }
  //   },
  //   [PropType.File]: {
  //     server: {
  //       columnType: 'varchar',
  //       fakerFunction: `'dummy/dummy-documentation.pdf'`,
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsString'
  //     },
  //     client: {
  //       inputType: 'File',
  //       yieldType: 'Download'
  //     }
  //   },
  //   [PropType.Image]: {
  //     server: {
  //       columnType: 'varchar',
  //       fakerFunction: `'dummy/dummy-image'`,
  //       type: 'string',
  //       dtoValidatorDecorator: 'IsString'
  //     },
  //     client: {
  //       inputType: 'Image',
  //       yieldType: 'Image'
  //     }
  //   },
  //   [PropType.Boolean]: {
  //     server: {
  //       columnType: 'tinyint',
  //       fakerFunction: 'faker.datatype.boolean()',
  //       type: 'boolean',
  //       dtoValidatorDecorator: 'IsBoolean'
  //     },
  //     client: {
  //       inputType: 'Checkbox',
  //       yieldType: 'Check'
  //     }
  //   }
}
