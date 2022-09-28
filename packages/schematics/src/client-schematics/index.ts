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
  SchematicsException
} from '@angular-devkit/schematics'
import * as ts from 'typescript'

import { addDeclarationToModule } from '@schematics/angular/utility/ast-utils'

import { InsertChange } from '@schematics/angular/utility/change'
import {
  camelize,
  classify,
  dasherize
} from '@angular-devkit/core/src/utils/strings'

export function createResource(options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const sourceTemplates: Source = url('./files')

    const appModulePath = 'client/src/app/app.module.ts'
    const appRoutingModulePath = 'client/src/app/app-routing.module.ts'
    const resourceFolderPath = 'client/src/app/resources'
    const menuItemsPath = 'client/src/app/menu-items.ts'

    const sourceParametrizedTemplates: Source = apply(sourceTemplates, [
      template({
        ...options,
        ...strings
      }),
      move(resourceFolderPath)
    ])

    // Modify appModule.
    const declarationChanges: any[] = [
      // Declare CreateEdit module.
      ...addDeclarationToModule(
        readIntoSourceFile(tree, appModulePath),
        appModulePath,
        classify(`${classify(options.name)}CreateEditComponent`),
        `./resources/${dasherize(options.name)}/${dasherize(
          options.name
        )}-create-edit/${dasherize(options.name)}-create-edit.component`
      ),
      // Declare List module.
      ...addDeclarationToModule(
        readIntoSourceFile(tree, appModulePath),
        appModulePath,
        classify(`${classify(options.name)}ListComponent`),
        `./resources/${dasherize(options.name)}/${dasherize(
          options.name
        )}-list/${dasherize(options.name)}-list.component`
      )
    ]

    const declarationRecorder = tree.beginUpdate(appModulePath)
    for (const change of declarationChanges) {
      if (change instanceof InsertChange) {
        declarationRecorder.insertLeft(change.pos, change.toAdd)
      }
    }
    tree.commitUpdate(declarationRecorder)

    // Add resourceRoutes to appRoutingModule.
    let appRoutingBuffer: Buffer = tree.read(appRoutingModulePath) as Buffer
    let appRoutingString: string = appRoutingBuffer.toString()

    // import resources routes.
    const routeDeclarationPosition: number = appRoutingString.indexOf(
      'const routes: Routes'
    )

    appRoutingString =
      appRoutingString.substring(0, routeDeclarationPosition) +
      `import { ${camelize(options.name)}Routes } from './resources/${dasherize(
        options.name
      )}/${dasherize(options.name)}.routes'\n` +
      appRoutingString.substring(routeDeclarationPosition)

    // Push resource routes to array.
    const caseRoutesImportPosition: number = appRoutingString.indexOf(
      '...(caseRoutes as Routes)'
    )

    appRoutingString =
      appRoutingString.substring(0, caseRoutesImportPosition) +
      `...${camelize(options.name)}Routes,\n` +
      appRoutingString.substring(caseRoutesImportPosition)

    tree.overwrite(appRoutingModulePath, appRoutingString)

    // Add menu item.
    let menuItemsBuffer: Buffer = tree.read(menuItemsPath) as Buffer
    let menuItemsString: string = menuItemsBuffer.toString()

    // import resources routes.
    const arrayOpeningPosition: number = menuItemsString.indexOf('= [') + 3

    menuItemsString =
      menuItemsString.substring(0, arrayOpeningPosition) +
      '\n' +
      JSON.stringify({
        label: `${classify(options.displayName)}s`,
        permissionsOr: [
          `browse${classify(options.name)}s`,
          `browseOwn${classify(options.name)}s`
        ],
        routePath: `/${dasherize(options.displayName)}s`,
        icon: 'icon-grid',
        items: []
      }) +
      ',\n' +
      menuItemsString.substring(arrayOpeningPosition)

    tree.overwrite(menuItemsPath, menuItemsString)

    return mergeWith(sourceParametrizedTemplates)
  }
}

function readIntoSourceFile(host: Tree, modulePath: string): ts.SourceFile {
  const text = host.read(modulePath)
  if (text === null) {
    throw new SchematicsException(`File ${modulePath} does not exist.`)
  }
  const sourceText = text.toString('utf-8')

  return ts.createSourceFile(
    modulePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  )
}
