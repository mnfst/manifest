import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics'

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

// TODO: import YieldType if it's not already imported.
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
}
