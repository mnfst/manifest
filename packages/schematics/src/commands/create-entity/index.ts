import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'
import { Rule } from '@angular-devkit/schematics'

import { createEntityFile } from './create-entity-file'

var pluralize = require('pluralize')

export function createEntity(options: { name: string; props: string }): Rule {
  return createEntityFile({
    name: options.name,
    classifiedName: classify(options.name),
    dasherizedName: dasherize(options.name),
    camelizedName: camelize(options.name),
    pluralizedName: pluralize(options.name)
  })
}
