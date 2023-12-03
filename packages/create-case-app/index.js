#!/usr/bin/env node

import { exec, execSync } from 'child_process'
import { chdir, cwd } from 'node:process'

import axios from 'axios'
import chalk from 'chalk'
import * as crypto from 'crypto'
import { execa } from 'execa'
import * as fs from 'fs'
import open from 'open'
import ora from 'ora'

// ! This file should be in TS for consistency with the rest of the project.

function isServerReady() {
  return axios
    .get('http://localhost:4000/health')
    .then(() => true)
    .catch(() => false)
}

async function waitForServerToBeReady() {
  let serverReady = false
  while (!serverReady) {
    serverReady = await isServerReady()
    if (!serverReady) {
      console.log('Waiting for server to be ready...')
      await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait for 5 seconds before retrying
    }
  }
}

const runCommand = (command, stdio) => {
  try {
    execSync(command, { stdio })
    return true
  } catch (e) {
    console.error(`Failed to run command: ${command}`, e)
    return false
  }
}

const runAsyncCommand = (script, options, output) =>
  new Promise((resolve, reject) => {
    const child = exec(script, options)

    if (output) {
      child.stdout.pipe(process.stdout)
      child.stderr.pipe(process.stderr)
    }

    child.on('close', resolve)
    child.on('error', reject)
  })

const repoName = process.argv[2]
const branchName = process.argv[3] || 'master'
const gitCheckoutCommand = `git clone --depth 1 https://github.com/casejs/case-starter --branch ${branchName} ${repoName}`

console.log()
console.log(chalk.blue(`Creating new CASE app in ${cwd()}/${repoName}`))
console.log()

const checkedOut = await runCommand(gitCheckoutCommand, 'pipe')
if (!checkedOut) {
  console.error('Failed to checkout repo')
  process.exit(1)
}

const loaderDeps = ora(`Installing dependencies for ${repoName}...`).start()
await runAsyncCommand(`cd ${repoName} && npm install`)
loaderDeps.succeed(`Successfully installed dependencies for ${repoName}`)

const loaderEnv = ora(`Creating .env file for ${repoName}...`).start()
fs.writeFileSync(
  `${repoName}/.env`,
  `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
NODE_ENV=development
PORT=4000`
)
loaderEnv.succeed(`Successfully created .env file for ${repoName}`)

// Launch the app.
chdir(repoName)

// Start the server in detached mode
const subprocess = execa('npm', ['run', 'start'], { detached: true })
subprocess.unref()

// Wait for the server to be ready
const loaderServer = ora('Launching the server...').start()
await waitForServerToBeReady()
loaderServer.succeed('Successfully launched the server')

// Run the seed script
const loaderSeed = ora('Seeding admin user').start()
await execa('npm', ['run', 'seed'])
loaderSeed.succeed('Successfully seeded admin user in the database')

console.log()
console.log(
  chalk.green(`🎉 The "${repoName}" CASE app has been created successfully!`)
)
console.log()
console.log()

open('http://localhost:4000/auth/login')
