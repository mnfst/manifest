#!/usr/bin/env node

// This script is used to watch for changes from the project root directory where Manifest is installed.
const { spawn } = require('child_process')
const path = require('path')

const nodemonPath = path.join(process.cwd(), 'node_modules', '.bin', 'nodemon')

const nodemon = spawn(
  nodemonPath,
  ['.', '--config', `${__dirname}/nodemon.json`],
  {
    stdio: 'inherit'
  }
)
nodemon.on('close', (code) => {
  console.log(`nodemon process exited with code ${code}`)
})
