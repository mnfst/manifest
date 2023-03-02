import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics'

export function createPropertyServer(options: {
  name: string
  resource: string
  type: string
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    updateEntityFile(options, tree)
  }
}

function updateEntityFile(
  options: { name: string; resource: string; type: string },
  tree: Tree
) {
  // Update entity file.
  const entityFilePath = `./server/src/resources/${options.resource}/${options.resource}.entity.ts`

  let entityFileBuffer: Buffer = tree.read(entityFilePath) as Buffer
  let entityFileString: string = entityFileBuffer.toString()

  // Get the index of the last closing bracket.
  const closingBracketIndex: number = entityFileString.lastIndexOf('}')

  // Insert the new property before the last closing bracket.
  entityFileString =
    entityFileString.substring(0, closingBracketIndex) +
    `
  @Column()
  ${options.name}: ${options.type}
` +
    entityFileString.substring(closingBracketIndex)

  console.log(entityFileString)

  tree.overwrite(entityFilePath, entityFileString)
}
