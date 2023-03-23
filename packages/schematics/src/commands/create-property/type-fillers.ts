import { PropType } from './enums/prop-type.enum'

export const typeFillers: Record<PropType, TypeFiller> = {
  [PropType.String]: {
    server: {
      columnType: '',
      fakerFunction: 'faker.random.word()',
      type: 'string',
      dtoValidatorDecorator: 'IsString'
    },
    client: {
      inputType: 'Text',
      yieldType: 'Text'
    }
  },
  [PropType.Number]: {
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
  [PropType.Currency]: {
    server: {
      columnType: 'decimal',
      fakerFunction: 'faker.finance.amount()',
      type: 'number',
      dtoValidatorDecorator: 'IsNumber'
    },
    client: {
      inputType: 'Number',
      yieldType: 'Currency'
    }
  },
  [PropType.Date]: {
    server: {
      columnType: 'datetime',
      fakerFunction: 'faker.date.past()',
      type: 'Date',
      dtoValidatorDecorator: 'IsDate'
    },
    client: {
      inputType: 'Datepicker',
      yieldType: 'Date'
    }
  },
  [PropType.Text]: {
    server: {
      columnType: 'text',
      fakerFunction: 'faker.lorem.paragraphs()',
      type: 'string',
      dtoValidatorDecorator: 'IsString'
    },
    client: {
      inputType: 'Textarea',
      yieldType: 'Text'
    }
  },
  [PropType.Color]: {
    server: {
      columnType: '',
      fakerFunction: 'faker.internet.color()',
      type: 'string',
      dtoValidatorDecorator: 'IsString'
    },
    client: {
      inputType: 'ColorPicker',
      yieldType: 'Color'
    }
  },
  [PropType.Email]: {
    server: {
      columnType: '',
      fakerFunction: 'faker.internet.email()',
      type: 'string',
      dtoValidatorDecorator: 'IsEmail'
    },
    client: {
      inputType: 'Email',
      yieldType: 'Text'
    }
  },
  [PropType.File]: {
    server: {
      columnType: '',
      fakerFunction: `'dummy/dummy-documentation.pdf'`,
      type: 'string',
      dtoValidatorDecorator: 'IsString'
    },
    client: {
      inputType: 'File',
      yieldType: 'Download'
    }
  },
  [PropType.Image]: {
    server: {
      columnType: '',
      fakerFunction: `'dummy/dummy-image.pdf'`,
      type: 'string',
      dtoValidatorDecorator: 'IsString'
    },
    client: {
      inputType: 'Image',
      yieldType: 'Image'
    }
  },
  [PropType.Boolean]: {
    server: {
      columnType: 'tinyint',
      fakerFunction: 'faker.datatype.boolean()',
      type: 'boolean',
      dtoValidatorDecorator: 'IsBoolean'
    },
    client: {
      inputType: 'Checkbox',
      yieldType: 'Check'
    }
  }
}
