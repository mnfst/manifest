import fs from 'fs'
import { compileFromFile } from 'json-schema-to-typescript'
import path from 'path'

/**
 * Generate Typescript types from the manifest JSON schema.
 *
 * This script is run as a prebuild step to generate the typescript types from the manifest JSON schema.
 */
compileFromFile(path.join(__dirname, 'manifest-schema.json'), {
  cwd: __dirname
}).then((ts) =>
  fs.writeFileSync(
    path.join(__dirname, '..', 'typescript', 'manifest-types.ts'),
    ts
  )
)
