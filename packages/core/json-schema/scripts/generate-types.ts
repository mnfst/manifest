import fs from 'fs'
import { compileFromFile } from 'json-schema-to-typescript'
import path from 'path'

/**
 * Generate Typescript types from the manifest JSON schema.
 *
 * This script is run as a prebuild step to generate the typescript types from the manifest JSON schema.
 */
compileFromFile(path.join(__dirname, '..', 'src', 'schema', 'schema.json'), {
  cwd: path.join(__dirname, '..', 'src', 'schema'),
  bannerComment:
    '/* eslint-disable */\n/**\n* This file was automatically generated.\n* DO NOT MODIFY IT BY HAND. Instead, modify the source JSON Schema file,\n* and run `npm run build` to regenerate this file.\n*/',
  style: {
    semi: false,
    singleQuote: true
  }
}).then((ts) =>
  fs.writeFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      'types',
      'src',
      'manifests',
      'ManifestSchema.ts'
    ),
    ts
  )
)
