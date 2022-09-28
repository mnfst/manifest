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

import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'

export function createResource(options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const sourceTemplates: Source = url('./files')
    const resourceFolderPath = './server/src/resources'
    const appModulePath = './server/src/app.module.ts'

    // Add "files" to resource folder.
    const sourceParametrizedTemplates: Source = apply(sourceTemplates, [
      template({
        ...options,
        ...strings
      }),
      move(resourceFolderPath)
    ])

    // Import new module in appModule.
    let appModuleBuffer: Buffer = tree.read(appModulePath) as Buffer
    let appModuleString: string = appModuleBuffer.toString()

    // Insert import declaration at beginning.
    appModuleString =
      `import { ${classify(options.name)}Module } from './resources/${dasherize(
        options.name
      )}/${dasherize(options.name)}.module'\n` + appModuleString

    // Push resource routes to array.
    const importPosition: number = appModuleString.indexOf(
      'CaseCoreModule.forRoot'
    )

    appModuleString =
      appModuleString.substring(0, importPosition) +
      `${classify(options.name)}Module,\n` +
      appModuleString.substring(importPosition)

    tree.overwrite(appModulePath, appModuleString)

    // * Add seeder.
    const seedTemplates: Source = url('./seeder-files')
    const seederFolderPath = './server/database/seeders'
    const mainSeederPath = './server/database/seeders/seeder.ts'
    const permissionContentPath =
      './server/database/seeders/content/permissions.content.ts'

    // Add "seeder-files" to seeder folder.
    const seedParametrizedTemplates: Source = apply(seedTemplates, [
      template({
        ...options,
        ...strings
      }),
      move(seederFolderPath)
    ])

    // Call resource seeder from main seeder.
    let mainSeederBuffer: Buffer = tree.read(mainSeederPath) as Buffer
    let mainSeederString: string = mainSeederBuffer.toString()

    const resourceCountsPosition: number = mainSeederString.indexOf(
      '// * Resource counts (keep comment for schematics).'
    )

    mainSeederString =
      mainSeederString.substring(0, resourceCountsPosition + 52) +
      `\nconst ${camelize(options.name)}Count = 40\n` +
      mainSeederString.substring(resourceCountsPosition + 52)

    const tableNamesPosition: number = mainSeederString.indexOf(
      '// * Table names (keep comment for schematics).'
    )

    mainSeederString =
      mainSeederString.substring(0, tableNamesPosition + 47) +
      `\n  '${camelize(options.name)}s',\n` +
      mainSeederString.substring(tableNamesPosition + 47)

    const closeConnectionPosition: number = mainSeederString.indexOf(
      'await dataSource.destroy()'
    )

    mainSeederString =
      `import { ${classify(options.name)}Seeder } from './${dasherize(
        options.name
      )}.seeder'\n` +
      mainSeederString.substring(0, closeConnectionPosition) +
      `await (new ${classify(options.name)}Seeder(dataSource, ${camelize(
        options.name
      )}Count)).seed()\n  ` +
      mainSeederString.substring(closeConnectionPosition)

    tree.overwrite(mainSeederPath, mainSeederString)

    // Add resource permission to permissionContent.
    let permissionContentBuffer: Buffer = tree.read(
      permissionContentPath
    ) as Buffer
    let permissionContentString: string = permissionContentBuffer.toString()

    const resourceListPosition: number = permissionContentString.indexOf(
      '// * Resources (keep comment for schematics).'
    )

    permissionContentString =
      permissionContentString.substring(0, resourceListPosition + 45) +
      `\n  '${camelize(options.name)}s',\n` +
      permissionContentString.substring(resourceListPosition + 45)

    tree.overwrite(permissionContentPath, permissionContentString)

    // * Make resource searchable.
    const searchServicePath = './server/src/search/search.service.ts'
    let searchServiceBuffer: Buffer = tree.read(searchServicePath) as Buffer
    let searchServiceString: string = searchServiceBuffer.toString()

    const searchResourcesPosition: number = searchServiceString.indexOf(
      '// * Search resources (keep comment for schematics).'
    )

    searchServiceString =
      `import { ${classify(options.name)} } from './../resources/${dasherize(
        options.name
      )}/${dasherize(options.name)}.entity'\n` +
      searchServiceString.substring(0, searchResourcesPosition + 52) +
      `\nif (
        resources.includes(${classify(options.name)}.name) &&
        ${classify(options.name)}.searchableFields &&
        ${classify(options.name)}.searchableFields.length
      ) {
        const ${camelize(
          options.name
        )}s: SearchResult[] = await this.searchResource(${classify(
        options.name
      )}, terms)
        searchResults = [...searchResults, ...${camelize(options.name)}s]
      }` +
      searchServiceString.substring(searchResourcesPosition + 52)

    const getObjectsPosition: number = searchServiceString.indexOf(
      '// * Get search result objects (keep comment for schematics).'
    )
    searchServiceString =
      searchServiceString.substring(0, getObjectsPosition + 61) +
      `\nif (query.${camelize(options.name)}Ids && query.${camelize(
        options.name
      )}Ids.length || query.${camelize(options.name)}Id) {
        const ${camelize(
          options.name
        )}s: SearchResult[] = await this.getSearchResultObjectsForResource(
          ${classify(options.name)},
          query.${camelize(options.name)}Ids || query.${camelize(
        options.name
      )}Id
        )
        searchResults = [...searchResults, ...${camelize(options.name)}s]
      }` +
      searchServiceString.substring(getObjectsPosition + 61)

    tree.overwrite(searchServicePath, searchServiceString)

    return chain([
      mergeWith(seedParametrizedTemplates),
      mergeWith(sourceParametrizedTemplates)
    ])
  }
}
