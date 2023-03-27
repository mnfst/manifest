interface TypeFiller {
  server: {
    columnType: string
    columnOptions?: string
    fakerFunction: string
    type: string
    dtoValidatorDecorator: string
  }
  client: {
    inputType: string
    yieldType: string
  }
}
