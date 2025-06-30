import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { TsType } from '../../entity/types/ts-types'

export const tsTypeSchemaTypes: Record<TsType, SchemaObject> = {
  string: { type: 'string' },
  number: { type: 'integer' },
  boolean: { type: 'boolean' },
  Date: { type: 'string', format: 'date' },
  '{[key:string]: string}': {
    type: 'object',
    additionalProperties: { type: 'string', format: 'uri' }
  },
  '{ lat: number; lng: number }': {
    type: 'object',
    properties: {
      lat: { type: 'number', format: 'float' },
      lng: { type: 'number', format: 'float' }
    },
    required: ['lat', 'lng']
  }
}
