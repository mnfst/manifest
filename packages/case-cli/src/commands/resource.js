var shell = require('shelljs')

export const createResource = async (args) => {
  shell.exec(`npm run case:resource -- --name=${args.name}`)
  shell.exec(`npm run seed`)
}
