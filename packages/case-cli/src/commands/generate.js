var shell = require('shelljs')
import reporter from '../reporter'

export const generate = async (args) => {
  const generateActivity = reporter.activity('Generating schema...')

  if (args.schematic === 'resource') {
    shell.exec(
      `npm run case:resource -- --name=${args.name} ${
        args.props ? `--props=${args.props}` : ''
      }`
    )
    shell.exec(`npm run seed`)
  } else if (args.schematic === 'property') {
    // TODO: generate props

    console.log(args, 'args PROPERTY')

    shell.exec(
      `npm run case:property -- --name=${args.name} --type=${args.type} --resource=${args.resourceName}`
    )
    shell.exec(`npm run seed`)
  } else {
    reporter.failure(
      generateActivity,
      "Schematic must be either 'resource' or 'property'."
    )
  }
}
