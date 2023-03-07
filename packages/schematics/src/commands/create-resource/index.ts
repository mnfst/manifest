import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'
import { chain, Rule } from '@angular-devkit/schematics'
import { createResourceClient } from './create-resource-client'
import { createResourceServer } from './create-resource-server'
import { createProperty } from '../create-property'

export function createResource(options: { name: string; props: string }): Rule {
  const names = {
    name: options.name,
    classify: classify(options.name),
    dasherize: dasherize(options.name),
    camelize: camelize(options.name)
  }

  const rules: Rule[] = [
    createResourceServer(names),
    createResourceClient(names)
  ]

  if (options.props) {
    const props = options.props.split(',')
    // TODO: extract type when available.
    props.forEach((prop) => {
      rules.push(
        createProperty({
          name: prop,
          resource: names.camelize,
          type: 'string'
        })
      )
    })
  }

  return chain(rules)
}
