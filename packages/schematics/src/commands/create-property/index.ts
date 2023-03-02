import { chain, Rule } from '@angular-devkit/schematics'
import { createPropertyServer } from './create-property-server'

export function createProperty(params: {
  name: string
  resource: string
  type: string
}) {
  const serverRule: Rule = createPropertyServer(params)

  return chain([serverRule])
}
