import { expect, test } from '@oclif/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'

describe('add-manifest command', () => {
  test
    .stdout()
    .stub(fs, 'existsSync', () => false)
    .stub(fs, 'mkdirSync', () => {})
    .stub(fs, 'writeFileSync', () => {})
    .command(['add-manifest'])
    .it('should create a folder and file', (ctx) => {
      expect(ctx.stdout).to.contain('Add Manifest to your project...')
      expect(ctx.stdout).to.contain('Update package.json file...')
    })

  test
    .stdout()
    .stub(fs, 'existsSync', () => true)
    .stub(fs, 'readFileSync', () => '{}')
    .stub(fs, 'writeFileSync', () => {})
    .command(['add-manifest'])
    .it('should update package.json file', (ctx) => {
      expect(ctx.stdout).to.contain('Update package.json file...')
    })

  test
    .stdout()
    .stub(fs, 'existsSync', () => false)
    .stub(fs, 'mkdirSync', () => {})
    .stub(fs, 'writeFileSync', () => {})
    .command(['add-manifest'])
    .it('should add settings', (ctx) => {
      expect(ctx.stdout).to.contain('Add settings...')
    })

  test
    .stdout()
    .stub(fs, 'existsSync', () => true)
    .stub(fs, 'readFileSync', () => '')
    .stub(fs, 'writeFileSync', () => {})
    .command(['add-manifest'])
    .it('should update .gitignore file', (ctx) => {
      expect(ctx.stdout).to.contain('Add settings...')
    })

  test
    .stdout()
    .stub(exec, 'exec', (cmd, callback) => {
      callback(null, { stdout: '', stderr: '' })
    })
    .command(['add-manifest'])
    .it('should install dependencies', (ctx) => {
      expect(ctx.stdout).to.contain('Install dependencies...')
    })

  test
    .stdout()
    .stub(fs, 'existsSync', () => false)
    .stub(fs, 'writeFileSync', () => {})
    .command(['add-manifest'])
    .it('should add environment variables', (ctx) => {
      expect(ctx.stdout).to.contain('Add environment variables...')
    })

  test
    .stdout()
    .stub(exec, 'exec', (cmd, callback) => {
      callback(null, { stdout: '', stderr: '' })
    })
    .command(['add-manifest'])
    .it('should build the database', (ctx) => {
      expect(ctx.stdout).to.contain('Build the database...')
    })

  test
    .stdout()
    .stub(exec, 'exec', (cmd, callback) => {
      callback(null, { stdout: '', stderr: '' })
    })
    .command(['add-manifest'])
    .it('should seed initial data', (ctx) => {
      expect(ctx.stdout).to.contain('Seed initial data...')
    })
})
