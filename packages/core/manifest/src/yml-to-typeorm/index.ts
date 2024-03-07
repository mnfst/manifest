// import * as fs from 'fs'
// import * as yaml from 'js-yaml'

// import Ajv from 'ajv'
// import manifestSchema from '../entity-loader/json-schema/manifest-schema.json'

// export const getEntities = () => {
//   const appFile = fs.readFileSync(
//     `${process.cwd()}/manifest/backend.yml`,
//     'utf8'
//   )

//   console.log(appFile, 'appFile')
//   const appManifest: any = yaml.load(appFile)

//   // ! TODO this is undefined
//   console.log(manifestSchema, 'manifestSchema')

//   let validate: any = new Ajv({
//     schemas: [manifestSchema]
//   })
// }
