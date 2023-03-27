var shell = require('shelljs')

export const createProperty = async (args) => {
  // TODO: Create property.
  shell.exec(
    `npm run case:property -- --name=${args.name} --type=${args.type} --resource=${args.resourceName}`
  )
  shell.exec(`npm run seed`)
}
