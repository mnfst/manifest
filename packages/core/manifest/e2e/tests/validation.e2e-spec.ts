describe('Validation (e2e)', () => {
  describe('Validators for property types', () => {
    it('string type expects a string value', async () => {})

    it('text type expects a string value', async () => {})

    it('number type expects a number value', async () => {})

    it('link type expects a valid URL', async () => {})

    it('money type expects a number value with maximum 2 digits after coma', async () => {})

    it('date type expects a YYYY-MM-DD date', async () => {})

    it('boolean type expects a boolean value', async () => {})

    it('timestamp type expects a timestamp', async () => {})

    it('password type expects a mandatory string value on create and an optional string value on update', async () => {})

    it('email type expects a valid email', async () => {})

    it('choice type expects a value from the values array', async () => {})

    it('location type expects and valid location object', async () => {})
  })

  describe('Validation behaviors', () => {
    it('nothing is mandatory by default', async () => {})

    it('validation in the property object is prioritized over validation object', async () => {})

    it('required is an alias of isNotEmpty validator', async () => {})
  })

  describe('Validators', () => {
    // TODO: Test individual validators as in class-validator.
  })
})
