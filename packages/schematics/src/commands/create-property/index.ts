import { chain, Rule } from '@angular-devkit/schematics'
import { createPropertyClient } from './create-property-client'
import { createPropertyServer } from './create-property-server'

export function createProperty(params: {
  name: string
  resource: string
  type: string
}) {
  const serverRule: Rule = createPropertyServer(params)
  const clientRule: Rule = createPropertyClient(params)

  return chain([serverRule, clientRule])
}
