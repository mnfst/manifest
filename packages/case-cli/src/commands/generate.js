var shell = require('shelljs')
import reporter from '../reporter'

export const generate = async (args) => {
  const generateActivity = reporter.activity('Generating schema...')

  if (args.schematic === 'resource') {
    console.log(args, 'args RESOURCE')

    // shell.exec(`npm run case:resource -- --name=${args.name}`)
    // shell.exec(`npm run seed`)
  } else if (args.schematic === 'property') {
    console.log(args, 'args PROPERTY')

    // TODO: Create property.
    //   shell.exec(
    //     `npm run case:property -- --name=${args.name} --type=${args.type} --resource=${args.resourceName}`
    //   )
    //   shell.exec(`npm run seed`)
  } else {
    reporter.failure(
      generateActivity,
      "Schematic must be either 'resource' or 'property'."
    )
  }
}
