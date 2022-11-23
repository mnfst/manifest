#!/usr/bin/env node

import 'core-js/stable'
import 'regenerator-runtime/runtime'

import util from 'util'
import createCli from './create-cli'

const useJsonLogger = process.argv.slice(2).some((arg) => arg.includes(`json`))

if (useJsonLogger) {
  process.env.GATSBY_LOGGER = `json`
}

process.on(`unhandledRejection`, (reason) => {
  // This will exit the process in newer Node anyway so lets be consistent
  // across versions and crash

  // reason can be anything, it can be a message, an object, ANYTHING!
  // we convert it to an error object so we don't crash on structured error validation
  if (!(reason instanceof Error)) {
    reason = new Error(util.format(reason))
  }

  console.log(reason)
})

process.on(`uncaughtException`, (error) => {
  console.log(error)
})

createCli(process.argv)
