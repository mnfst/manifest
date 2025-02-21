#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

// This script is used to watch for changes from the project root directory where Manifest is installed.
const path = require('path')
const os = require('os')
const spawn = require('cross-spawn')
const fs = require('fs')

// Determine the appropriate nodemon path.
const nodemonExecutable = os.platform() === 'win32' ? 'nodemon.cmd' : 'nodemon'
const isPnpm = fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'))

const nodemonPath = isPnpm
  ? path.join(
      process.cwd(),
      'node_modules',
      '.pnpm',
      'node_modules',
      '.bin',
      nodemonExecutable
    )
  : path.join(process.cwd(), 'node_modules', '.bin', nodemonExecutable)

const nodemon = spawn(
  nodemonPath,
  ['.', '--config', `${__dirname}/nodemon.json`],
  {
    stdio: 'inherit',
    shell: true
  }
)
nodemon.on('close', (code) => {
  console.log(`nodemon process exited with code ${code}`)
})
