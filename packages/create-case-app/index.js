#!/usr/bin/env node
import chalk from 'chalk'
import { execSync } from 'child_process'
import ora from 'ora'

const runCommand = (command, stdio) => {
  try {
    execSync(command, { stdio })
  } catch (e) {
    console.error(`Failed to run command: ${command}`, e)
    return false
  }
  return true
}

const repoName = process.argv[2]
const branchName = process.argv[3] || 'master'
const gitCheckoutCommand = `git clone --depth 1 https://github.com/casejs/case-starter --branch ${branchName} ${repoName}`
const installCommand = `cd ${repoName} && npm install`

console.log()
console.log(chalk.blue(`Creating new CASE app in ${repoName}...`))
console.log()
const checkedOut = runCommand(gitCheckoutCommand, 'pipe')
if (!checkedOut) {
  console.error('Failed to checkout repo')
  process.exit(1)
}

const loader = ora(`Installing dependencies for ${repoName}...`).start()
const installed = runCommand(installCommand, 'pipe')
if (!installed) {
  loader.fail(`Failed to install dependencies for ${repoName}`)
  process.exit(1)
}

loader.succeed(`Successfully installed dependencies for ${repoName}`)
console.log(`To get started, run: cd ${repoName} && npm start`)

console.log()
console.log(
  chalk.green(
    `🎉 The "${repoName}" CASE app has been created successfully! To get started:`
  )
)
console.log()
console.log(chalk.blue(`cd ${repoName}`))
console.log(chalk.blue(`npm start`))
console.log()
