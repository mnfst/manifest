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

export function createResourceClient(names: {
  camelize: string
  classify: string
  dasherize: string
  name: string
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const sourceTemplates: Source = url('./client-files')

    const appModulePath = 'client/src/app/app.module.ts'
    const appRoutingModulePath = 'client/src/app/app-routing.module.ts'
    const resourceFolderPath = 'client/src/app/resources'
    const menuItemsPath = 'client/src/app/menu-items.ts'

    const sourceParametrizedTemplates: Source = apply(sourceTemplates, [
      template({
        ...names,
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
        `${names.classify}CreateEditComponent`,
        `./resources/${names.dasherize}/${names.dasherize}-create-edit/${names.dasherize}-create-edit.component`
      ),
      // Declare List module.
      ...addDeclarationToModule(
        readIntoSourceFile(tree, appModulePath),
        appModulePath,
        `${names.classify}ListComponent`,
        `./resources/${names.dasherize}/${names.dasherize}-list/${names.dasherize}-list.component`
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
      `import { ${names.camelize}Routes } from './resources/${names.dasherize}/${names.dasherize}.routes'\n` +
      appRoutingString.substring(routeDeclarationPosition)

    // Push resource routes to array.
    const caseRoutesImportPosition: number = appRoutingString.indexOf(
      '...(caseRoutes as Routes)'
    )

    appRoutingString =
      appRoutingString.substring(0, caseRoutesImportPosition) +
      `  ...${names.camelize}Routes,\n` +
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
        label: `${names.name}s`,
        permissionsOr: [
          `browse${names.classify}s`,
          `browseOwn${names.classify}s`
        ],
        routePath: `/${names.dasherize}s`,
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
