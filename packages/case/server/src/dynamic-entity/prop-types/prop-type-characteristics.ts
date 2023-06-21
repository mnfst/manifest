import { ColumnType } from 'typeorm/driver/types/ColumnTypes'
import { InputType } from '~shared/enums/input-type.enum'
import { YieldType } from '~shared/enums/yield-type.enum'

import { PropType } from '~shared/enums/prop-type.enum'

export type PropTypeCharacteristics = {
  input: InputType
  yield: YieldType
  columnType: ColumnType
  defaultSeedFunction: (index?: number) => any
}

export const propTypeCharacteristics: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.String]: {
    input: InputType.Text,
    yield: YieldType.Text,
    columnType: 'varchar',
    defaultSeedFunction: (index?: number) => `Value ${index}`
  },
  [PropType.Integer]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => index
  },

  // TODO: Set those propTypes

  [PropType.RichText]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Relation]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Currency]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Date]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Text]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Color]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Email]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.File]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Image]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  },
  [PropType.Boolean]: {
    input: InputType.Number,
    yield: YieldType.Number,
    columnType: 'int',
    defaultSeedFunction: (index?: number) => 'Change me'
  }

  // ! Legacy CASE v1
  //   [PropType.String]: {
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
  //   [PropType.Text]: {
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
