var shell = require('shelljs')
import reporter from '../reporter'

export const generate = async (args) => {
  const generateActivity = reporter.activity('Generating schema...')

  if (args.schematic === 'resource' || args.schematic === 'res') {
    if (!args.name) {
      return reporter.failure(
        generateActivity,
        'You must provide a name for the resource.'
      )
    }
    shell.exec(
      `npm run case:resource -- --name=${args.name} ${
        args.props ? `--props=${args.props}` : ''
      }`
    )
    shell.exec(`npm run seed`)
  } else if (args.schematic === 'property' || args.schematic === 'prop') {
    if (!args.name || !args.resourceName) {
      return reporter.failure(
        generateActivity,
        'You must provide a name for the property and the resource it belongs to.'
      )
    }

    // Extract type from name if provided.
    args.type = 'string'
    if (args.name.includes(':')) {
      ;[args.name, args.type] = args.name.split(':')
    }

    console.log(args, 'args PROPERTY')
    shell.exec(
      `npm run case:property -- --name=${args.name} --type=${args.type} --resource=${args.resourceName}`
    )
    shell.exec(`npm run seed`)
  } else {
    return reporter.failure(
      generateActivity,
      "Schematic must be either 'resource' or 'property'."
    )
  }
}
