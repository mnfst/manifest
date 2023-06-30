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
  const rule: Rule = createEntityFile({
    name: options.name,
    classifiedName: classify(options.name),
    dasherizedName: dasherize(options.name),
    camelizedName: camelize(options.name),
    pluralizedName: pluralize(options.name)
  })

  console.log()
  console.log(chalk.blue(`✨ Successfully created entity ${options.name}!`))
  console.log(
    chalk.blue(
      `See entity file: `,
      chalk.underline.blue(`entities/${dasherize(options.name)}.entity.ts`)
    )
  )
  console.log(
    chalk.blue(
      `run "npm run seed" to seed the database with ${options.name} data`
    )
  )
  console.log()

  return rule
}
