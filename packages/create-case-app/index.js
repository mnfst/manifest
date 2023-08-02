#!/usr/bin/env node

import { chdir, cwd } from 'node:process';
import { execSync, exec } from 'child_process'

import chalk from 'chalk'
import * as crypto from 'crypto'
import * as fs from 'fs'
import ora from 'ora'
import { execa } from 'execa';


import open from 'open'

// ! This file should be in TS for consistency with the rest of the project.

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

    if(output) {
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
console.log(chalk.blue(`Creating new CASE app in ${cwd()}/${repoName}...`))
console.log()

const checkedOut = await runCommand(gitCheckoutCommand, 'pipe')
if (!checkedOut) {
  console.error('Failed to checkout repo')
  process.exit(1)
}

const loaderDeps = ora(`Installing dependencies for ${repoName}...`).start()
await runAsyncCommand(`cd ${repoName} && npm install`)
loaderDeps.succeed(`Successfully installed dependencies for ${repoName}`)

const loaderSeed = ora(`Seeding default users for ${repoName}...`).start()
await runAsyncCommand(`cd ${repoName} && npm run seed`)
loaderSeed.succeed(`Successfully seeded default users for ${repoName}`)

fs.writeFileSync(
  `${repoName}/.env`,
  `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`
)

console.log()
console.log(
  chalk.green(
    `🎉 The "${repoName}" CASE app has been created successfully!`
  )
)
console.log()
console.log()

// Launch the app.
chdir(repoName)
setTimeout(() => {
  open('http://localhost:4000')
}, 8000)
execa('npm', ['start'], {  stdio: 'inherit' })
