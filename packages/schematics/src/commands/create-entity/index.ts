import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'
import { Rule } from '@angular-devkit/schematics'
import * as chalk from 'chalk'

import { createEntityFile } from './create-entity-file'

var pluralize = require('pluralize')

export function createEntity(options: { name: string; props: string }): Rule {
  const singularName: string = pluralize.singular(options.name)

  const rule: Rule = createEntityFile({
    name: singularName,
    classifiedName: classify(singularName),
    dasherizedName: dasherize(singularName),
    camelizedName: camelize(singularName),
    pluralizedName: pluralize(singularName)
  })

  console.log()
  console.log(chalk.blue(`✨ Successfully created entity ${singularName}!`))
  console.log(
    chalk.blue(
      `See entity file: `,
      chalk.underline.blue(`entities/${dasherize(singularName)}.entity.ts`)
    )
  )
  console.log(
    chalk.blue(
      `run "npm run seed" to seed the database with ${singularName} data`
    )
  )
  console.log()

  return rule
}
