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

export function createResourceServer(names: {
  camelize: string
  classify: string
  dasherize: string
  name: string
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const sourceTemplates: Source = url('./server-files/resource')
    const resourceFolderPath = './server/src/resources'
    const appModulePath = './server/src/app.module.ts'

    // Add "files" to resource folder.
    const sourceParametrizedTemplates: Source = apply(sourceTemplates, [
      template({
        ...names,
        ...strings
      }),
      move(resourceFolderPath)
    ])

    // Import new module in appModule.
    let appModuleBuffer: Buffer = tree.read(appModulePath) as Buffer
    let appModuleString: string = appModuleBuffer.toString()

    // Insert import declaration at beginning.
    appModuleString =
      `import { ${names.classify}Module } from './resources/${names.dasherize}/${names.dasherize}.module'\n` +
      appModuleString

    // Push resource routes to array.
    const importPosition: number = appModuleString.indexOf(
      'CaseCoreModule.forRoot'
    )

    appModuleString =
      appModuleString.substring(0, importPosition) +
      `${names.classify}Module,\n` +
      appModuleString.substring(importPosition)

    tree.overwrite(appModulePath, appModuleString)

    // * Add seeder.
    const seedTemplates: Source = url('./server-files/seeder')
    const seederFolderPath = './server/src/database/seeders'
    const mainSeederPath = './server/src/database/seeders/seeder.ts'
    const permissionContentPath =
      './server/src/database/seeders/content/permissions.content.ts'

    // Add "seeder-files" to seeder folder.
    const seedParametrizedTemplates: Source = apply(seedTemplates, [
      template({
        ...names,
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
      `\nconst ${names.camelize}Count = 40\n` +
      mainSeederString.substring(resourceCountsPosition + 52)

    const tableNamesPosition: number = mainSeederString.indexOf(
      '// * Table names (keep comment for schematics).'
    )

    mainSeederString =
      mainSeederString.substring(0, tableNamesPosition + 47) +
      `\n  '${names.camelize}s',\n` +
      mainSeederString.substring(tableNamesPosition + 47)

    const closeConnectionPosition: number = mainSeederString.indexOf(
      'await dataSource.destroy()'
    )

    mainSeederString =
      `import { ${names.classify}Seeder } from './${names.dasherize}.seeder'\n` +
      mainSeederString.substring(0, closeConnectionPosition) +
      `await (new ${names.classify}Seeder(dataSource, ${names.camelize}Count)).seed()\n  ` +
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
      `\n  '${names.camelize}s',\n` +
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
      `import { ${names.classify} } from './../resources/${names.dasherize}/${names.dasherize}.entity'\n` +
      searchServiceString.substring(0, searchResourcesPosition + 52) +
      `\nif (
        resources.includes(${names.classify}.name) &&
        ${names.classify}.searchableFields &&
        ${names.classify}.searchableFields.length
      ) {
        const ${names.camelize}s: SearchResult[] = await this.searchResource(${names.classify}, terms)
        searchResults = [...searchResults, ...${names.camelize}s]
      }` +
      searchServiceString.substring(searchResourcesPosition + 52)

    const getObjectsPosition: number = searchServiceString.indexOf(
      '// * Get search result objects (keep comment for schematics).'
    )
    searchServiceString =
      searchServiceString.substring(0, getObjectsPosition + 61) +
      `\nif (query.${names.camelize}Ids && query.${names.camelize}Ids.length || query.${names.camelize}Id) {
        const ${names.camelize}s: SearchResult[] = await this.getSearchResultObjectsForResource(
          ${names.classify},
          query.${names.camelize}Ids || query.${names.camelize}Id
        )
        searchResults = [...searchResults, ...${names.camelize}s]
      }` +
      searchServiceString.substring(getObjectsPosition + 61)

    tree.overwrite(searchServicePath, searchServiceString)

    return chain([
      mergeWith(seedParametrizedTemplates),
      mergeWith(sourceParametrizedTemplates)
    ])
  }
}
