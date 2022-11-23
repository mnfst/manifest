const path = require(`path`)
const resolveCwd = require(`resolve-cwd`)
const yargs = require(`yargs`)
const existsSync = require(`fs-exists-cached`).sync

const { didYouMean } = require(`./did-you-mean`)

const reporter = require('./reporter').default
const { newStarter } = require('./commands/new')
const { createResource } = require('./commands/resource')

const handlerP =
  (fn) =>
  (...args) => {
    Promise.resolve(fn(...args)).then(
      () => process.exit(0),
      (err) => console.log(err)
    )
  }

function buildLocalCommands(cli, isLocalProject) {
  const defaultHost = `localhost`
  const defaultPort = `9000`
  const directory = path.resolve(`.`)

  const projectInfo = { directory }
  const useYarn = existsSync(path.join(directory, `yarn.lock`))

  if (isLocalProject) {
    const json = require(path.join(directory, `package.json`))
    projectInfo.sitePackageJson = json
  }

  function resolveLocalCommand(command) {
    if (!isLocalProject) {
      cli.showHelp()
    }

    try {
      const cmdPath = resolveCwd.silent(
        `@medusajs/medusa/dist/commands/${command}`
      )
      return require(cmdPath).default
    } catch (err) {
      cli.showHelp()
    }
  }

  function getCommandHandler(command, handler) {
    return (argv) => {
      const localCmd = resolveLocalCommand(command)
      const args = { ...argv, ...projectInfo, useYarn }

      return handler ? handler(args, localCmd) : localCmd(args)
    }
  }

  cli
    .command({
      command: `new`,
      desc: `Create a new CASE project`,
      handler: handlerP(newStarter)
    })
    .command({
      command: `resource [name]`,
      desc: `Create a resource in a CASE project`,
      handler: handlerP(createResource)
    })
}

function isLocalMedusaProject() {
  let inMedusaProject = false
  try {
    const { dependencies, devDependencies } = require(path.resolve(
      `./package.json`
    ))
    inMedusaProject =
      (dependencies && dependencies['@medusajs/medusa']) ||
      (devDependencies && devDependencies['@medusajs/medusa'])
  } catch (err) {
    /* ignore */
  }
  return !!inMedusaProject
}

module.exports = (argv) => {
  const cli = yargs()
  const isLocalProject = isLocalMedusaProject()

  cli.scriptName(`case-app`).usage(`Usage: $0 <command> [options]`)

  buildLocalCommands(cli, isLocalProject)

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
