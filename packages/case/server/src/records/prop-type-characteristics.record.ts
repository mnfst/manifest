import { faker } from '@faker-js/faker'
import { ColumnType } from 'typeorm/driver/types/ColumnTypes'
import { PropType } from '~shared/enums/prop-type.enum'

export type PropTypeCharacteristics = {
  columnType: ColumnType
  defaultSeedFunction: (index?: number, relationSeedCount?: number) => any
}

export const propTypeCharacteristicsRecord: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.Text]: {
    columnType: 'varchar',
    defaultSeedFunction: (index: number) => `Value ${index}`
  },
  [PropType.Number]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => index
  },
  [PropType.Relation]: {
    columnType: 'int',
    defaultSeedFunction: (_index: number, relationSeedCount: number) =>
      faker.number.int({ min: 1, max: relationSeedCount })
  },

  // TODO: Create those propTypes (dummy for now).
  [PropType.RichText]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },

  [PropType.Currency]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.Date]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.TextArea]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.Color]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.Email]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.File]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.Image]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
  },
  [PropType.Boolean]: {
    columnType: 'int',
    defaultSeedFunction: (index: number) => 'Change me'
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
