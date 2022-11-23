import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'
import { chain, Rule } from '@angular-devkit/schematics'
import { createResourceClient } from './create-resource-client'
import { createResourceServer } from './create-resource-server'

export function createResource(options: { name: string }): Rule {
  console.log('createResource', options)

  const names = {
    name: options.name,
    classify: classify(options.name),
    dasherize: dasherize(options.name),
    camelize: camelize(options.name)
  }

  const clientRule: Rule = createResourceClient(names)
  const serverRule: Rule = createResourceServer(names)

  return chain([clientRule, serverRule])
}
