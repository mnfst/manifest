import { PropType } from './enums/prop-type.enum'

export const typeFillers: Record<PropType, TypeFiller> = {
  [PropType.String]: {
    server: {
      columnType: '',
      fakerFunction: 'faker.random.word()',
      type: 'string',
      dtoValidatorDecorator: '@IsString()'
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
      dtoValidatorDecorator: '@IsNumber()'
    },
    client: {
      inputType: 'Number',
      yieldType: 'Text'
    }
  }
}
