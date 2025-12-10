import { expect, test } from '@oclif/test'

// FIXME: This test is not working as the command "create" is not found.

describe('MyCommand', () => {
  test
    .stdout()
    .command(['create'])
    .it('should create a folder and file', (ctx) => {
      expect(ctx.stdout).to.contain('Folder created:')
      expect(ctx.stdout).to.contain('manifest.yml')
    })

  test
    .stdout()
    .command(['create'])
    .it('should update package.json file', (ctx) => {
      expect(ctx.stdout).to.contain('Updating package.json file...')
      expect(ctx.stdout).to.contain('package.json updated successfully!')
    })

  test
    .stdout()
    .command(['create'])
    .it('should add settings', (ctx) => {
      expect(ctx.stdout).to.contain('Adding settings...')
      expect(ctx.stdout).to.contain('Settings added successfully!')
    })

  test
    .stdout()
    .command(['create'])
    .it('should update .gitignore file', (ctx) => {
      expect(ctx.stdout).to.contain('Updating .gitignore file...')
      expect(ctx.stdout).to.contain('.gitignore updated successfully!')
    })

  test
    .stdout()
    .command(['create'])
    .it('should install dependencies', (ctx) => {
      expect(ctx.stdout).to.contain('Installing dependencies...')
      expect(ctx.stdout).to.contain('npm install completed successfully!')
    })
})
