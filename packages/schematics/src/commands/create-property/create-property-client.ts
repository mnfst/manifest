import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics'

export function createPropertyClient(options: {
  name: string
  resource: string
  type: string
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    updateListFile(options, tree)
    // updateCreateEditFile(options, tree)
  }
}

function updateListFile(
  options: { name: string; resource: string; type: string },
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
    },`
  )

  tree.overwrite(listFilePath, listFileString)
}
