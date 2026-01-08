#!/usr/bin/env node

import { cpSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const projectName = process.argv[2]

if (!projectName) {
  console.error('Please provide a project name:')
  console.error('  npx create-manifest my-app')
  process.exit(1)
}

const targetDir = join(process.cwd(), projectName)
const starterDir = join(__dirname, 'starter')

console.log(`\nCreating a new Manifest project in ${targetDir}...\n`)

// Copy starter folder to target directory
cpSync(starterDir, targetDir, { recursive: true })

// Rename gitignore to .gitignore (npm ignores .gitignore files)
const gitignorePath = join(targetDir, 'gitignore')
if (existsSync(gitignorePath)) {
  renameSync(gitignorePath, join(targetDir, '.gitignore'))
}

// Update package.json with the project name
const packageJsonPath = join(targetDir, 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
packageJson.name = projectName
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

console.log('Installing dependencies...\n')

// Install dependencies
execSync('pnpm install', {
  cwd: targetDir,
  stdio: 'inherit'
})

console.log('\nStarting development server...\n')

// Run dev script
const dev = spawn('pnpm', ['run', 'dev'], {
  cwd: targetDir,
  stdio: 'inherit',
  shell: true
})

dev.on('close', (code) => {
  process.exit(code)
})
