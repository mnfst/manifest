import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { TsType } from '../../entity/types/ts-types'

export const tsTypeSchemaTypes: Record<TsType, SchemaObject> = {
  string: { type: 'string' },
  number: { type: 'integer' },
  boolean: { type: 'boolean' },
  Date: { type: 'string', format: 'date' }
}
