interface TypeFiller {
  server: {
    columnType: string
    fakerFunction: string
    type: string
    dtoValidatorDecorator: string
  }
  client: {
    inputType: string
    yieldType: string
  }
}
