import { chain, Rule } from '@angular-devkit/schematics'
import { createResourceClient } from './create-resource-client'
import { createResourceServer } from './create-resource-server'

export function createResource(options: any): Rule {
  const clientRule: Rule = createResourceClient(options)
  const serverRule: Rule = createResourceServer(options)

  return chain([clientRule, serverRule])
}
