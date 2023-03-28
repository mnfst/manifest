const yargs = require(`yargs`)
const { didYouMean } = require(`./did-you-mean`)
const reporter = require('./reporter').default

const { newStarter } = require('./commands/new')
const { generate } = require('./commands/generate')

const handlerP =
  (fn) =>
  (...args) => {
    Promise.resolve(fn(...args)).then(
      () => process.exit(0),
      (err) => console.log(err)
    )
  }

module.exports = (argv) => {
  const cli = yargs()

  return cli
    .scriptName(`cs`)
    .usage(`Usage: $0 <command> [options]`)
    .command({
      command: `new`,
      aliases: ['n'],
      desc: `Creates a new CASE project`,
      handler: handlerP(newStarter)
    })
    .command({
      command: `generate [schematic] [name]`,
      aliases: ['g'],
      desc: `Generates a CASE resource or property`,
      builder: (yargs) => {
        yargs
          .positional(`schematic`, {
            describe: `Schematic to generate: "resource" or "property"`,
            type: `string`
          })
          .positional(`name`, {
            describe: `Name of the resource or property`,
            type: `string`
          })
          .option(`resourceName`, {
            alias: `res`,
            describe: `Name of the resource or property`,
            type: `string`
          })
          .option(`props`, {
            alias: `p`,
            describe: `Properties to generate, comma separated. Example: "name,age:number,active:boolean"`,
            type: `string`
          })
      },
      handler: handlerP(generate)
    })
    .wrap(cli.terminalWidth())
    .demandCommand(1, `Pass --help to see all available commands and options.`)
    .strict()
    .fail((msg, err, yargs) => {
      const availableCommands = yargs
        .getCommands()
        .map((commandDescription) => {
          const [command] = commandDescription
          return command.split(` `)[0]
        })
      const arg = argv.slice(2)[0]
      const suggestion = arg ? didYouMean(arg, availableCommands) : ``

      cli.showHelp()
      reporter.info(suggestion)
      reporter.info(msg)
    })
    .parse(argv.slice(2))
}
