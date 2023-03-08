import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics'
import { insertImport } from '@schematics/angular/utility/ast-utils'
import { InsertChange } from '@schematics/angular/utility/change'
import * as ts from 'typescript'

import { PropType } from './enums/prop-type.enum'
import { typeFillers } from './type-fillers'

export function createPropertyClient(options: {
  name: string
  resource: string
  type: PropType
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    updateListFile(options, tree)
    updateCreateEditFile(options, tree)
  }
}

function updateListFile(
  options: { name: string; resource: string; type: PropType },
  tree: Tree
): void {
  const listFilePath: string = `./client/src/app/resources/${options.resource}/${options.resource}-list/${options.resource}-list.component.ts`

  const listFileBuffer: Buffer = tree.read(listFilePath) as Buffer

  let listFileString: string = listFileBuffer.toString()

  // Insert a new object in the yields array.
  listFileString = listFileString.replace(
    `yields: Yield[] = [`,
    `yields: Yield[] = [
    {
        label: '${options.name}',
        property: '${options.name}',
        type: YieldType.${typeFillers[options.type].client.yieldType}
    },`
  )

  tree.overwrite(listFilePath, listFileString)

  const source: ts.SourceFile = ts.createSourceFile(
    listFilePath,
    listFileString,
    ts.ScriptTarget.Latest,
    true
  )

  const updateRecorder = tree.beginUpdate(listFilePath)
  const change = insertImport(
    source,
    listFilePath,
    'YieldType',
    '@case-app/angular-library'
  )
  if (change instanceof InsertChange) {
    updateRecorder.insertRight(change.pos, change.toAdd)
  }
  tree.commitUpdate(updateRecorder)
}

function updateCreateEditFile(
  options: { name: string; resource: string; type: PropType },
  tree: Tree
): void {
  const createEditFilePath: string = `./client/src/app/resources/${options.resource}/${options.resource}-create-edit/${options.resource}-create-edit.component.ts`

  const createEditFileBuffer: Buffer = tree.read(createEditFilePath) as Buffer
  let createEditFileString: string = createEditFileBuffer.toString()

  // Insert a new object in the yields array.
  createEditFileString = createEditFileString.replace(
    `fields: Field[] = [`,
    `fields: Field[] = [
    {
      label: '${options.name}',
      property: '${options.name}',
      required: true,
      inputType: InputType.${typeFillers[options.type].client.inputType}
    },`
  )

  tree.overwrite(createEditFilePath, createEditFileString)

  const source: ts.SourceFile = ts.createSourceFile(
    createEditFilePath,
    createEditFileString,
    ts.ScriptTarget.Latest,
    true
  )

  const updateRecorder = tree.beginUpdate(createEditFilePath)
  const change = insertImport(
    source,
    createEditFilePath,
    'InputType',
    '@case-app/angular-library'
  )
  if (change instanceof InsertChange) {
    updateRecorder.insertRight(change.pos, change.toAdd)
  }
  tree.commitUpdate(updateRecorder)
}
