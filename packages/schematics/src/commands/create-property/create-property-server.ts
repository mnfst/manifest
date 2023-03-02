import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics'

export function createPropertyServer(options: {
  name: string
  resource: string
  type: string
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    updateEntityFile(options, tree)
    updateDtoFile(options, tree)
  }
}

function updateEntityFile(
  options: { name: string; resource: string; type: string },
  tree: Tree
): void {
  // Update entity file.
  const entityFilePath = `./server/src/resources/${options.resource}/${options.resource}.entity.ts`

  const entityFileBuffer: Buffer = tree.read(entityFilePath) as Buffer
  let entityFileString: string = entityFileBuffer.toString()

  // Get the index of the last closing bracket.
  const closingBracketIndex: number = entityFileString.lastIndexOf('}')

  // Insert the new property before the last closing bracket.
  entityFileString =
    entityFileString.substring(0, closingBracketIndex) +
    `
  @Column()
  @CaseProperty({
    seed: (index: number) => faker.lorem.word() 
  })
  ${options.name}: string
` +
    entityFileString.substring(closingBracketIndex)

  tree.overwrite(entityFilePath, entityFileString)
}

function updateDtoFile(
  options: { name: string; resource: string; type: string },
  tree: Tree
): void {
  const dtoFilePath: string = `./server/src/resources/${options.resource}/dtos/create-update-${options.resource}.dto.ts`

  const dtoFileBuffer: Buffer = tree.read(dtoFilePath) as Buffer
  let dtoFileString: string = dtoFileBuffer.toString()

  // Get the index of the last closing bracket.
  const closingBracketIndex: number = dtoFileString.lastIndexOf('}')

  // Insert the validation for the new property before the last closing bracket.
  dtoFileString =
    dtoFileString.substring(0, closingBracketIndex) +
    `
  @IsNotEmpty()
  @IsString() 
  ${options.name}: string
` +
    dtoFileString.substring(closingBracketIndex)

  tree.overwrite(dtoFilePath, dtoFileString)
}
