#!/usr/bin/env node

const { execSync } = require('child_process')

const runCommand = (command) => {
  try {
    execSync(command, { stdio: 'inherit' })
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

console.log(`Creating new CASE app in ${repoName}...`)
const checkedOut = runCommand(gitCheckoutCommand)
if (!checkedOut) {
  console.error('Failed to checkout repo')
  process.exit(1)
}

console.log(`Installing dependencies for ${repoName}...`)
const installed = runCommand(installCommand)
if (!installed) {
  console.error('Failed to install dependencies')
  process.exit(1)
}

console.log(`Successfully created new CASE app in ${repoName}`)
console.log(`To get started, run: cd ${repoName} && npm start`)
