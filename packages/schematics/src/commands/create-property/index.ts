import { chain, Rule } from '@angular-devkit/schematics'

import { createPropertyClient } from './create-property-client'
import { createPropertyServer } from './create-property-server'
import { PropType } from './enums/prop-type.enum'

export function createProperty(params: {
  name: string
  resource: string
  type: PropType
}) {
  const serverRule: Rule = createPropertyServer(params)
  const clientRule: Rule = createPropertyClient(params)

  return chain([serverRule, clientRule])
}
