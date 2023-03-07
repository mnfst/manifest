import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics'

import { PropType } from './enums/prop-type.enum'
import { typeFillers } from './type-fillers'

export function createPropertyServer(options: {
  name: string
  resource: string
  type: PropType
}): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    updateEntityFile(options, tree)
    updateDtoFile(options, tree)
  }
}

function updateEntityFile(
  options: { name: string; resource: string; type: PropType },
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
  @Column('${typeFillers[options.type].server.columnType}')
  @CaseProperty({
    seed: (index: number) => ${typeFillers[options.type].server.fakerFunction}
  })
  ${options.name}: ${typeFillers[options.type].server.type}
` +
    entityFileString.substring(closingBracketIndex)

  tree.overwrite(entityFilePath, entityFileString)
}

// TODO: import Decorators if they're not already imported.
function updateDtoFile(
  options: { name: string; resource: string; type: PropType },
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
  ${typeFillers[options.type].server.dtoValidatorDecorator}
  ${options.name}: ${typeFillers[options.type].server.type}
` +
    dtoFileString.substring(closingBracketIndex)

  tree.overwrite(dtoFilePath, dtoFileString)
}
