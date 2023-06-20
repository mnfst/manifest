import { PropType } from './prop-type.enum'

// Legacy CASE v1
// TODO: Define things affected by propType in server and client.
type PropTypeCharacteristics = {
  server?: {
    columnType: string
    columnOptions?: string
    fakerFunction: string
    type: string
    dtoValidatorDecorator: string
  }
  client?: {
    inputType: string
    yieldType: string
  }
}

export const propTypeCharacteristics: Record<
  PropType,
  PropTypeCharacteristics
> = {
  [PropType.Integer]: {
    server: {
      columnType: 'int',
      fakerFunction: 'faker.datatype.number()',
      type: 'number',
      dtoValidatorDecorator: 'IsNumber'
    },
    client: {
      inputType: 'Number',
      yieldType: 'Text'
    }
  },

  [PropType.String]: {},
  [PropType.RichText]: {},
  [PropType.Relation]: {},
  [PropType.Currency]: {},
  [PropType.Date]: {},
  [PropType.Text]: {},
  [PropType.Color]: {},
  [PropType.Email]: {},
  [PropType.File]: {},
  [PropType.Image]: {},
  [PropType.Boolean]: {}

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
