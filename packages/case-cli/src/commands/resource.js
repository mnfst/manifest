var shell = require('shelljs')

// TODO: Create resource command that creates a new resource using "case:resource" script in package.json.
export const createResource = async (args) => {
  shell.exec(`npm run case:resource -- --name=${args.name}`)
  shell.exec(`npm run seed`)
}
