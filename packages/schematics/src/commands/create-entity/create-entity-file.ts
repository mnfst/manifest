import { strings } from '@angular-devkit/core'
import {
  apply,
  move,
  Rule,
  SchematicContext,
  Tree,
  template,
  mergeWith,
  url,
  Source,
  chain
} from '@angular-devkit/schematics'

export function createEntityFile(names: {
  camelizedName: string
  classifiedName: string
  dasherizedName: string
  name: string
  pluralizedName: string
}): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    const source: Source = apply(url('./files'), [
      template({
        ...names,
        ...strings
      }),
      move('./entities')
    ])

    return chain([mergeWith(source)])
  }
}
