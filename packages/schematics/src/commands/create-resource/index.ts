import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'
import { chain, Rule } from '@angular-devkit/schematics'
import { createResourceClient } from './create-resource-client'
import { createResourceServer } from './create-resource-server'
import { createProperty } from '../create-property'
import { PropType } from '../create-property/enums/prop-type.enum'

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
    let props = options.props.split(',')

    // If no props are specified, create a default "name" property.
    if (!props.length) {
      props = ['name']
    }

    // We reverse array because the schematics adds the text above the previous one.
    props.reverse()

    props.forEach((prop) => {
      // Extract type from prop if available
      if (prop.includes(':')) {
        const [propName, propType]: string[] = prop.split(':')
        rules.push(
          createProperty({
            name: propName,
            resource: names.camelize,
            type: Object.values(PropType).includes(propType as PropType)
              ? (propType as PropType)
              : PropType.String
          })
        )
      } else {
        rules.push(
          createProperty({
            name: prop,
            resource: names.camelize,
            type: PropType.String
          })
        )
      }
    })
  }

  return chain(rules)
}
