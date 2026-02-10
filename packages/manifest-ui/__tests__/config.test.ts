/**
 * Configuration Validation Tests
 *
 * Ensures that all configuration files are valid and properly structured:
 * - package.json has required fields and valid structure
 * - tsconfig.json is valid and has proper compiler options
 * - next.config.ts/js exists and is valid
 * - tailwind.config.ts/css exists
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT_DIR = resolve(__dirname, '..')

describe('Configuration Files', () => {
  describe('package.json', () => {
    const packageJsonPath = resolve(ROOT_DIR, 'package.json')

    it('should exist', () => {
      expect(existsSync(packageJsonPath)).toBe(true)
    })

    it('should be valid JSON', () => {
      const content = readFileSync(packageJsonPath, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })

    it('should have required fields', () => {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)

      expect(pkg.name).toBeDefined()
      expect(pkg.version).toBeDefined()
      expect(pkg.scripts).toBeDefined()
      expect(pkg.dependencies).toBeDefined()
      expect(pkg.devDependencies).toBeDefined()
    })

    it('should have required scripts', () => {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)

      const requiredScripts = ['dev', 'build', 'start', 'lint', 'test']
      for (const script of requiredScripts) {
        expect(pkg.scripts[script]).toBeDefined()
      }
    })

    it('should have React and Next.js as dependencies', () => {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)

      expect(pkg.dependencies.react).toBeDefined()
      expect(pkg.dependencies['react-dom']).toBeDefined()
      expect(pkg.dependencies.next).toBeDefined()
    })

    it('should have testing dependencies', () => {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)

      expect(pkg.devDependencies.vitest).toBeDefined()
      expect(pkg.devDependencies.typescript).toBeDefined()
    })

    it('should have valid version format', () => {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)

      // Version should be semver format
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('tsconfig.json', () => {
    const tsconfigPath = resolve(ROOT_DIR, 'tsconfig.json')

    it('should exist', () => {
      expect(existsSync(tsconfigPath)).toBe(true)
    })

    it('should be valid JSON', () => {
      const content = readFileSync(tsconfigPath, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })

    it('should have compilerOptions', () => {
      const content = readFileSync(tsconfigPath, 'utf-8')
      const tsconfig = JSON.parse(content)

      expect(tsconfig.compilerOptions).toBeDefined()
    })

    it('should enable strict mode', () => {
      const content = readFileSync(tsconfigPath, 'utf-8')
      const tsconfig = JSON.parse(content)

      expect(tsconfig.compilerOptions.strict).toBe(true)
    })

    it('should target modern JavaScript', () => {
      const content = readFileSync(tsconfigPath, 'utf-8')
      const tsconfig = JSON.parse(content)

      // Should target ES2015 or later
      const validTargets = ['es6', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'esnext']
      const target = tsconfig.compilerOptions.target?.toLowerCase()

      // Target might be in extend, so we just check it exists or skip
      if (target) {
        expect(validTargets).toContain(target)
      }
    })

    it('should have JSX configuration for React', () => {
      const content = readFileSync(tsconfigPath, 'utf-8')
      const tsconfig = JSON.parse(content)

      // Should have jsx set to react-jsx or preserve
      const validJsx = ['react-jsx', 'preserve', 'react']
      expect(validJsx).toContain(tsconfig.compilerOptions.jsx)
    })
  })

  describe('Next.js Configuration', () => {
    it('should have next.config file', () => {
      const tsPath = resolve(ROOT_DIR, 'next.config.ts')
      const jsPath = resolve(ROOT_DIR, 'next.config.js')
      const mjsPath = resolve(ROOT_DIR, 'next.config.mjs')

      const hasConfig = existsSync(tsPath) || existsSync(jsPath) || existsSync(mjsPath)
      expect(hasConfig).toBe(true)
    })
  })

  describe('Tailwind CSS Configuration', () => {
    it('should have tailwind configuration or CSS with @tailwind directives', () => {
      const tailwindConfigTs = resolve(ROOT_DIR, 'tailwind.config.ts')
      const tailwindConfigJs = resolve(ROOT_DIR, 'tailwind.config.js')
      const globalsCss = resolve(ROOT_DIR, 'app', 'globals.css')

      const hasConfig = existsSync(tailwindConfigTs) || existsSync(tailwindConfigJs)
      const hasGlobalsCss = existsSync(globalsCss)

      // Either have a tailwind config or globals.css with tailwind imports
      if (!hasConfig && hasGlobalsCss) {
        const cssContent = readFileSync(globalsCss, 'utf-8')
        const hasTailwindImport = cssContent.includes('@tailwind') || cssContent.includes('@import "tailwindcss')
        expect(hasTailwindImport).toBe(true)
      } else {
        expect(hasConfig || hasGlobalsCss).toBe(true)
      }
    })
  })

  describe('PostCSS Configuration', () => {
    it('should have postcss configuration', () => {
      const postcssConfigTs = resolve(ROOT_DIR, 'postcss.config.ts')
      const postcssConfigJs = resolve(ROOT_DIR, 'postcss.config.js')
      const postcssConfigMjs = resolve(ROOT_DIR, 'postcss.config.mjs')

      const hasConfig = existsSync(postcssConfigTs) || existsSync(postcssConfigJs) || existsSync(postcssConfigMjs)
      expect(hasConfig).toBe(true)
    })
  })

  describe('ESLint Configuration', () => {
    it('should have ESLint configuration', () => {
      const eslintConfigTs = resolve(ROOT_DIR, 'eslint.config.ts')
      const eslintConfigJs = resolve(ROOT_DIR, 'eslint.config.js')
      const eslintConfigMjs = resolve(ROOT_DIR, 'eslint.config.mjs')
      const eslintRc = resolve(ROOT_DIR, '.eslintrc.json')
      const eslintRcJs = resolve(ROOT_DIR, '.eslintrc.js')

      const hasConfig =
        existsSync(eslintConfigTs) ||
        existsSync(eslintConfigJs) ||
        existsSync(eslintConfigMjs) ||
        existsSync(eslintRc) ||
        existsSync(eslintRcJs)

      expect(hasConfig).toBe(true)
    })
  })

  describe('Vitest Configuration', () => {
    const vitestConfigPath = resolve(ROOT_DIR, 'vitest.config.ts')

    it('should exist', () => {
      expect(existsSync(vitestConfigPath)).toBe(true)
    })

    it('should export a config', () => {
      const content = readFileSync(vitestConfigPath, 'utf-8')
      expect(content).toContain('export default')
      expect(content).toContain('defineConfig')
    })

    it('should configure test environment', () => {
      const content = readFileSync(vitestConfigPath, 'utf-8')
      expect(content).toContain('environment')
    })
  })
})

describe('Required Directories', () => {
  const requiredDirs = [
    'app',
    'components',
    'lib',
    'public',
    'registry',
  ]

  for (const dir of requiredDirs) {
    it(`should have ${dir} directory`, () => {
      const dirPath = resolve(ROOT_DIR, dir)
      expect(existsSync(dirPath)).toBe(true)
    })
  }
})

describe('Required Files', () => {
  const requiredFiles = [
    'registry.json',
    'changelog.json',
    'components.json',
  ]

  for (const file of requiredFiles) {
    it(`should have ${file}`, () => {
      const filePath = resolve(ROOT_DIR, file)
      expect(existsSync(filePath)).toBe(true)
    })
  }
})
