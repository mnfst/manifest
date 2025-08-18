import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { LockFileService } from '../services/lock-file.service'
import * as fs from 'fs'
import * as yaml from 'js-yaml'

jest.mock('fs')
jest.mock('js-yaml')

describe('LockFileService', () => {
  let service: LockFileService
  let configService: ConfigService

  const mockProjectRoot = '/mock/project/root'

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.resetAllMocks()
    jest.clearAllMocks()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LockFileService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'paths.projectRoot') return mockProjectRoot
              if (key === 'nodeEnv') return 'test'
              return null
            })
          }
        }
      ]
    }).compile()

    configService = module.get<ConfigService>(ConfigService)

    // Mock existsSync to return false by default (no lock files)
    ;(fs.existsSync as jest.Mock).mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor and initialization', () => {
    it('should be defined', () => {
      service = new LockFileService(configService)
      expect(service).toBeDefined()
    })

    it('should detect pnpm lock file first', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('pnpm-lock.yaml')
      })
      ;(fs.readFileSync as jest.Mock).mockReturnValue('lockfileVersion: 6.0')
      ;(yaml.load as jest.Mock).mockReturnValue({})

      service = new LockFileService(configService)

      expect(fs.existsSync).toHaveBeenCalledWith(
        `${mockProjectRoot}/pnpm-lock.yaml`
      )
      expect(service.getPackageManager()).toBe('pnpm')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should detect yarn lock file second', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('yarn.lock')
      })
      ;(fs.readFileSync as jest.Mock).mockReturnValue('# yarn lockfile v1')

      service = new LockFileService(configService)

      expect(fs.existsSync).toHaveBeenCalledWith(`${mockProjectRoot}/yarn.lock`)
      expect(service.getPackageManager()).toBe('yarn')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should detect npm lock file third', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('package-lock.json')
      })
      ;(fs.readFileSync as jest.Mock).mockReturnValue('{"name": "test"}')

      service = new LockFileService(configService)

      expect(fs.existsSync).toHaveBeenCalledWith(
        `${mockProjectRoot}/package-lock.json`
      )
      expect(service.getPackageManager()).toBe('npm')
      expect(consoleSpy).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should warn when no lock file is found', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)

      service = new LockFileService(configService)

      expect(service.getPackageManager()).toBe('unknown')
      expect(consoleSpy).toHaveBeenCalledWith(
        'No lock file found. Version checking will be limited.'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('parseNpmLock', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('package-lock.json')
      })
    })

    it('should parse npm lockfile version 2/3 with packages', () => {
      const mockNpmLock = {
        packages: {
          '': {
            name: 'root-package',
            version: '1.0.0'
          },
          'node_modules/lodash': {
            version: '4.17.21'
          },
          'node_modules/@nestjs/core': {
            version: '10.0.0'
          },
          'node_modules/@nestjs/core/node_modules/dependency': {
            version: '1.0.0'
          }
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockNpmLock)
      )

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('root-package')).toBe('1.0.0')
      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@nestjs/core')).toBe('10.0.0')
      expect(service.getInstalledVersion('dependency')).toBe('1.0.0')
    })

    it('should parse npm lockfile version 1 with dependencies', () => {
      const mockNpmLock = {
        dependencies: {
          lodash: {
            version: '4.17.21'
          },
          '@nestjs/core': {
            version: '10.0.0',
            dependencies: {
              'nested-dep': {
                version: '1.0.0'
              }
            }
          }
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockNpmLock)
      )

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@nestjs/core')).toBe('10.0.0')
      expect(service.getInstalledVersion('nested-dep')).toBe('1.0.0')
    })

    it('should handle malformed npm lock file', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(fs.readFileSync as jest.Mock).mockReturnValue('invalid json')

      service = new LockFileService(configService)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing npm lock file:',
        expect.any(Error)
      )
      expect(service.getInstalledVersion('any-package')).toBeNull()

      consoleSpy.mockRestore()
    })
  })

  describe('parseYarnLock', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('yarn.lock')
      })
    })

    it('should parse yarn lock file manually', () => {
      const mockYarnLock = `# yarn lockfile v1

lodash@^4.17.21:
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"

"@nestjs/core@^10.0.0":
  version "10.0.0"
  resolved "https://registry.yarnpkg.com/@nestjs/core/-/core-10.0.0.tgz"
`

      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockYarnLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@nestjs/core')).toBe('10.0.0')
    })

    it('should handle malformed yarn lock file', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found')
      })

      service = new LockFileService(configService)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing yarn lock file:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('parsePnpmLock', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('pnpm-lock.yaml')
      })
    })

    it('should parse pnpm lock file with dependencies', () => {
      const mockPnpmLock = {
        dependencies: {
          lodash: '^4.17.21',
          '@nestjs/core': {
            specifier: '^10.0.0'
          }
        },
        devDependencies: {
          typescript: '^5.0.0'
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockPnpmLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@nestjs/core')).toBe('10.0.0')
      expect(service.getInstalledVersion('typescript')).toBe('5.0.0')
    })

    it('should parse pnpm lock file with packages section', () => {
      const mockPnpmLock = {
        packages: {
          '/lodash/4.17.21': {
            resolution: { integrity: 'sha512-...' },
            version: '4.17.21'
          },
          '/@types/node/18.15.13': {
            resolution: { integrity: 'sha512-...' }
          }
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockPnpmLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@types/node')).toBe('18.15.13')
    })

    it('should parse pnpm lock file with importers (workspaces)', () => {
      const mockPnpmLock = {
        importers: {
          '.': {
            dependencies: {
              lodash: '^4.17.21'
            }
          },
          'packages/core': {
            devDependencies: {
              jest: {
                specifier: '^29.0.0'
              }
            }
          }
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockPnpmLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('jest')).toBe('29.0.0')
    })

    it('should handle versions with link: prefix', () => {
      const mockPnpmLock = {
        dependencies: {
          'local-package': 'link:../local'
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockPnpmLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('local-package')).toBe('local')
    })

    it('should handle versions with file: prefix', () => {
      const mockPnpmLock = {
        dependencies: {
          'file-package': 'file:../package.tgz'
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockPnpmLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('file-package')).toBe('local')
    })

    it('should handle versions with integrity hashes', () => {
      const mockPnpmLock = {
        dependencies: {
          'package-with-hash': '1.0.0_hash123'
        }
      }

      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockPnpmLock)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('package-with-hash')).toBe('1.0.0')
    })

    it('should handle malformed pnpm lock file', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found')
      })

      service = new LockFileService(configService)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing pnpm lock file:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should handle empty pnpm lock file', () => {
      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(null)

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('any-package')).toBeNull()
    })
  })

  describe('extractPackageName', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      service = new LockFileService(configService)
    })

    it('should extract regular package names', () => {
      expect((service as any).extractPackageName('lodash')).toBe('lodash')
      expect((service as any).extractPackageName('express/lib')).toBe('express')
    })

    it('should extract scoped package names', () => {
      expect((service as any).extractPackageName('@nestjs/core')).toBe(
        '@nestjs/core'
      )
      expect((service as any).extractPackageName('@nestjs/core/lib')).toBe(
        '@nestjs/core'
      )
      expect((service as any).extractPackageName('@types/node/index')).toBe(
        '@types/node'
      )
    })

    it('should handle edge cases', () => {
      expect((service as any).extractPackageName('@scope')).toBe('@scope')
      expect((service as any).extractPackageName('')).toBe('')
    })
  })

  describe('extractYarnPackageName', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      service = new LockFileService(configService)
    })

    it('should extract package names from yarn declarations', () => {
      expect((service as any).extractYarnPackageName('lodash@^4.17.21')).toBe(
        'lodash'
      )
      expect((service as any).extractYarnPackageName('lodash@4.17.21')).toBe(
        'lodash'
      )
    })

    it('should extract scoped package names from yarn declarations', () => {
      expect(
        (service as any).extractYarnPackageName('@nestjs/core@^10.0.0')
      ).toBe('@nestjs/core')
      expect(
        (service as any).extractYarnPackageName('@types/node@18.15.13')
      ).toBe('@types/node')
    })

    it('should handle packages without version specifiers', () => {
      expect((service as any).extractYarnPackageName('lodash')).toBe('lodash')
      expect((service as any).extractYarnPackageName('@nestjs/core')).toBe(
        '@nestjs/core'
      )
    })
  })

  describe('extractPnpmPackageName', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      service = new LockFileService(configService)
    })

    it('should extract package names from pnpm paths', () => {
      expect((service as any).extractPnpmPackageName('/lodash/4.17.21')).toBe(
        'lodash'
      )
      expect((service as any).extractPnpmPackageName('/express/4.18.0')).toBe(
        'express'
      )
    })

    it('should extract scoped package names from pnpm paths', () => {
      expect(
        (service as any).extractPnpmPackageName('/@nestjs/core/10.0.0')
      ).toBe('@nestjs/core')
      expect(
        (service as any).extractPnpmPackageName('/@types/node/18.15.13')
      ).toBe('@types/node')
    })

    it('should handle empty or invalid paths', () => {
      expect((service as any).extractPnpmPackageName('')).toBe('')
      expect((service as any).extractPnpmPackageName('/')).toBe('')
    })
  })

  describe('cleanPnpmVersion', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      service = new LockFileService(configService)
    })

    it('should clean semver prefixes', () => {
      expect((service as any).cleanPnpmVersion('^4.17.21')).toBe('4.17.21')
      expect((service as any).cleanPnpmVersion('~4.17.21')).toBe('4.17.21')
      expect((service as any).cleanPnpmVersion('4.17.21')).toBe('4.17.21')
    })

    it('should handle link and file versions', () => {
      expect((service as any).cleanPnpmVersion('link:../local')).toBe('local')
      expect((service as any).cleanPnpmVersion('file:../package.tgz')).toBe(
        'local'
      )
    })

    it('should handle versions with integrity hashes', () => {
      expect((service as any).cleanPnpmVersion('1.0.0_hash123')).toBe('1.0.0')
      expect((service as any).cleanPnpmVersion('2.1.0_abc_def')).toBe('2.1.0')
    })

    it('should handle empty or undefined versions', () => {
      expect((service as any).cleanPnpmVersion('')).toBe('')
      expect((service as any).cleanPnpmVersion(undefined)).toBe('')
      expect((service as any).cleanPnpmVersion(null)).toBe('')
    })
  })

  describe('getInstalledVersion', () => {
    beforeEach(() => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      service = new LockFileService(configService)
    })

    it('should return null for unknown packages', () => {
      expect(service.getInstalledVersion('unknown-package')).toBeNull()
    })

    it('should return contribution version in contribution mode', () => {
      ;(configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'paths.projectRoot') return mockProjectRoot
        if (key === 'nodeEnv') return 'contribution'
        return null
      })

      service = new LockFileService(configService)

      expect(service.getInstalledVersion('any-package')).toBe(
        '0.0.0-contribution'
      )
    })

    it('should return actual version when package exists', () => {
      // Manually set installed packages for testing
      ;(service as any).installedPackages = {
        lodash: '4.17.21',
        '@nestjs/core': '10.0.0'
      }

      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@nestjs/core')).toBe('10.0.0')
      expect(service.getInstalledVersion('unknown')).toBeNull()
    })
  })

  describe('getPackageManager', () => {
    it('should return the detected package manager', () => {
      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('pnpm-lock.yaml')
      })
      ;(fs.readFileSync as jest.Mock).mockReturnValue('lockfileVersion: 6.0')
      ;(yaml.load as jest.Mock).mockReturnValue({})

      service = new LockFileService(configService)

      expect(service.getPackageManager()).toBe('pnpm')
    })

    it('should return unknown when no lock file is found', () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)

      service = new LockFileService(configService)

      expect(service.getPackageManager()).toBe('unknown')
    })
  })

  describe('integration tests', () => {
    it('should correctly parse a complex npm lock file', () => {
      const mockComplexNpmLock = {
        packages: {
          '': {
            name: 'my-app',
            version: '1.0.0'
          },
          'node_modules/lodash': {
            version: '4.17.21'
          },
          'node_modules/@nestjs/core': {
            version: '10.0.0'
          },
          'node_modules/@nestjs/common': {
            version: '10.0.0'
          }
        }
      }

      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('package-lock.json')
      })
      ;(fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(mockComplexNpmLock)
      )

      service = new LockFileService(configService)

      expect(service.getPackageManager()).toBe('npm')
      expect(service.getInstalledVersion('my-app')).toBe('1.0.0')
      expect(service.getInstalledVersion('lodash')).toBe('4.17.21')
      expect(service.getInstalledVersion('@nestjs/core')).toBe('10.0.0')
      expect(service.getInstalledVersion('@nestjs/common')).toBe('10.0.0')
      expect(service.getInstalledVersion('non-existent')).toBeNull()
    })

    it('should correctly parse a complex pnpm lock file', () => {
      const mockComplexPnpmLock = {
        lockfileVersion: 6.0,
        dependencies: {
          lodash: '^4.17.21'
        },
        devDependencies: {
          typescript: '~5.0.0'
        },
        packages: {
          '/lodash/4.17.21': {
            resolution: { integrity: 'sha512-...' },
            version: '4.17.21'
          }
        },
        importers: {
          '.': {
            dependencies: {
              express: '^4.18.0'
            }
          }
        }
      }

      ;(fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('pnpm-lock.yaml')
      })
      ;(fs.readFileSync as jest.Mock).mockReturnValue('yaml content')
      ;(yaml.load as jest.Mock).mockReturnValue(mockComplexPnpmLock)

      service = new LockFileService(configService)

      expect(service.getPackageManager()).toBe('pnpm')
      expect(service.getInstalledVersion('lodash')).toBe('4.17.21') // Should get from packages section
      expect(service.getInstalledVersion('typescript')).toBe('5.0.0')
      expect(service.getInstalledVersion('express')).toBe('4.18.0')
    })
  })
})
