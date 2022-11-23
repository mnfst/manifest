const chalk = require(`chalk`)

const showSuccessMessage = () => {
  console.log(chalk.green(`Success!\n`))
  console.log(chalk.cyan(`Welcome to the CASE CLI!`))
}

try {
  // Check if it's a global installation of CASE CLI.
  const npmArgs = JSON.parse(process.env[`npm_config_argv`])
  if (npmArgs.cooked && npmArgs.cooked.includes(`--global`)) {
    const createCli = require(`../dist/create-cli`)
    showSuccessMessage()
    createCli(`--help`)
  }
} catch (e) {}
