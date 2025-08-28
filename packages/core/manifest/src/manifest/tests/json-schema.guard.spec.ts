import { JsonSchemaGuard } from '../guards/json-schema.guard'

describe('JsonSchemaGuard', () => {
  it('should be defined', () => {
    expect(new JsonSchemaGuard()).toBeDefined()
  })
})
