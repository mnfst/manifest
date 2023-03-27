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

function buildLocalCommands(cli) {
  cli
    .command({
      command: `new`,
      desc: `Creates a new CASE project`,
      handler: handlerP(newStarter)
    })
    .command({
      command: `generate [schematic] [name]`,
      desc: `Generates a CASE resource or property`,
      handler: handlerP(generate)
    })
}

module.exports = (argv) => {
  const cli = yargs()

  cli.scriptName(`cs`).usage(`Usage: $0 <command> [options]`)

  buildLocalCommands(cli)

  return cli
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
