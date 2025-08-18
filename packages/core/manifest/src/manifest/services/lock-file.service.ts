import { Injectable } from '@nestjs/common'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as yaml from 'js-yaml'
import * as yarnLockfile from '@yarnpkg/lockfile'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class LockFileService {
  private installedPackages: Record<string, string> = {}
  private packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown' = 'unknown'

  constructor(private readonly configService: ConfigService) {
    this.detectAndParseLockFile()
  }

  private detectAndParseLockFile() {
    const rootPath = this.configService.get<string>('paths.projectRoot')

    // Try pnpm first (pnpm-lock.yaml)
    if (existsSync(join(rootPath, 'pnpm-lock.yaml'))) {
      this.packageManager = 'pnpm'
      this.parsePnpmLock(join(rootPath, 'pnpm-lock.yaml'))
    }
    // Then yarn (yarn.lock)
    else if (existsSync(join(rootPath, 'yarn.lock'))) {
      this.packageManager = 'yarn'
      this.parseYarnLock(join(rootPath, 'yarn.lock'))
    }
    // Finally npm (package-lock.json)
    else if (existsSync(join(rootPath, 'package-lock.json'))) {
      this.packageManager = 'npm'
      this.parseNpmLock(join(rootPath, 'package-lock.json'))
    } else {
      console.warn('No lock file found. Version checking will be limited.')
    }
  }

  private parseNpmLock(filePath: string) {
    try {
      const lockFile = JSON.parse(readFileSync(filePath, 'utf8'))

      // Handle lockfile version 2/3 (npm 7+)
      if (lockFile.packages) {
        Object.entries(lockFile.packages).forEach(
          ([path, info]: [string, any]) => {
            if (path.startsWith('node_modules/')) {
              // Extract the package name from the path
              const pathWithoutNodeModules = path.replace('node_modules/', '')
              
              // For nested dependencies like "node_modules/@nestjs/core/node_modules/dependency",
              // we need to extract just the "dependency" part
              const pathParts = pathWithoutNodeModules.split('/node_modules/')
              const lastPackagePath = pathParts[pathParts.length - 1]
              const packageName = this.extractPackageName(lastPackagePath)
              
              this.installedPackages[packageName] = info.version
            }
            // Root package (empty string key)
            else if (path === '' && info.name) {
              this.installedPackages[info.name] = info.version
            }
          }
        )
      }
      // Handle lockfile version 1 (npm 6 and below)
      else if (lockFile.dependencies) {
        this.extractFromNpmDependencies(lockFile.dependencies)
      }
    } catch (error) {
      console.error('Error parsing npm lock file:', error)
    }
  }

  private extractFromNpmDependencies(deps: any, prefix = '') {
    Object.entries(deps).forEach(([name, info]: [string, any]) => {
      // For root level dependencies, use the name directly
      // For nested dependencies, extract the package name from the full path
      const packageName = prefix ? this.extractPackageName(name) : name
      this.installedPackages[packageName] = info.version

      if (info.dependencies) {
        this.extractFromNpmDependencies(info.dependencies, name)
      }
    })
  }

  private parseYarnLock(filePath: string) {
    try {
      const lockContent = readFileSync(filePath, 'utf8')

      // Parse yarn.lock format manually (it's not JSON)
      const lines = lockContent.split('\n')
      let currentPackage = ''
      let currentVersion = ''

      for (const line of lines) {
        const trimmed = line.trim()

        // Package declaration line (handle quoted and unquoted package names)
        if ((trimmed.includes('@') && trimmed.endsWith(':')) || (trimmed.startsWith('"') && trimmed.endsWith('":"'))) {
          // Extract package name (handle scoped packages)
          const packageDeclaration = trimmed.replace(':', '').replace(/"/g, '')
          currentPackage = this.extractYarnPackageName(packageDeclaration)
        }
        // Version line
        else if (trimmed.startsWith('version ') && currentPackage) {
          currentVersion = trimmed.replace('version ', '').replace(/"/g, '')
          this.installedPackages[currentPackage] = currentVersion
        }
      }
    } catch (error) {
      console.error('Error parsing yarn lock file:', error)
    }
  }

  private parseYarnLockWithLibrary(filePath: string) {
    try {
      const lockContent = readFileSync(filePath, 'utf8')
      const parsed = yarnLockfile.parse(lockContent)

      if (parsed.type === 'success') {
        Object.entries(parsed.object).forEach(([key, info]: [string, any]) => {
          const packageName = this.extractYarnPackageName(key)
          this.installedPackages[packageName] = info.version
        })
      }
    } catch (error) {
      console.error('Error parsing yarn lock file with library:', error)
      // Fallback to manual parsing
      this.parseYarnLock(filePath)
    }
  }

  private parsePnpmLock(filePath: string) {
    try {
      const lockContent = readFileSync(filePath, 'utf8')
      const lockData = yaml.load(lockContent) as any

      if (!lockData) return

      // pnpm-lock.yaml structure varies by version
      // Handle dependencies section
      if (lockData.dependencies) {
        Object.entries(lockData.dependencies).forEach(
          ([name, version]: [string, any]) => {
            // Version can be a string or object with specifier
            const actualVersion =
              typeof version === 'string' ? version : version.specifier
            this.installedPackages[name] = this.cleanPnpmVersion(actualVersion)
          }
        )
      }

      // Handle devDependencies section
      if (lockData.devDependencies) {
        Object.entries(lockData.devDependencies).forEach(
          ([name, version]: [string, any]) => {
            const actualVersion =
              typeof version === 'string' ? version : version.specifier
            this.installedPackages[name] = this.cleanPnpmVersion(actualVersion)
          }
        )
      }

      // Handle packages section (more detailed info)
      if (lockData.packages) {
        Object.entries(lockData.packages).forEach(
          ([path, info]: [string, any]) => {
            if (path.startsWith('/')) {
              // Extract package name from path like "/@types/node/18.15.13"
              const packageName = this.extractPnpmPackageName(path)
              if (packageName && info.resolution) {
                this.installedPackages[packageName] = this.cleanPnpmVersion(
                  info.resolution.integrity
                    ? path.split('/').pop()
                    : info.version
                )
              }
            }
          }
        )
      }

      // Handle importers (workspaces)
      if (lockData.importers) {
        Object.entries(lockData.importers).forEach(
          ([importerPath, importer]: [string, any]) => {
            if (importer.dependencies) {
              Object.entries(importer.dependencies).forEach(
                ([name, version]: [string, any]) => {
                  const actualVersion =
                    typeof version === 'string' ? version : version.specifier
                  this.installedPackages[name] =
                    this.cleanPnpmVersion(actualVersion)
                }
              )
            }
            if (importer.devDependencies) {
              Object.entries(importer.devDependencies).forEach(
                ([name, version]: [string, any]) => {
                  const actualVersion =
                    typeof version === 'string' ? version : version.specifier
                  this.installedPackages[name] =
                    this.cleanPnpmVersion(actualVersion)
                }
              )
            }
          }
        )
      }
    } catch (error) {
      console.error('Error parsing pnpm lock file:', error)
    }
  }

  private extractPackageName(fullPath: string): string {
    // Handle scoped packages like @nestjs/core
    if (fullPath.startsWith('@')) {
      const parts = fullPath.split('/')
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : fullPath
    }
    return fullPath.split('/')[0]
  }

  private extractYarnPackageName(declaration: string): string {
    // Handle formats like: "package@^1.0.0", "@scope/package@^1.0.0"
    if (declaration.startsWith('@')) {
      // Scoped package: @scope/package@version
      const match = declaration.match(/^(@[^/]+\/[^@]+)/)
      return match ? match[1] : declaration.split('@')[0]
    }
    // Regular package: package@version
    return declaration.split('@')[0]
  }

  private extractPnpmPackageName(path: string): string {
    // Handle pnpm paths like "/@types/node/18.15.13" or "/lodash/4.17.21"
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) return ''

    // Handle scoped packages
    if (parts[0].startsWith('@') && parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`
    }
    return parts[0]
  }

  private cleanPnpmVersion(version: string): string {
    // Remove pnpm-specific prefixes and extract clean version
    if (!version) return ''

    // Handle versions like "link:../some/path", "file:../some/path"
    if (version.includes('link:') || version.includes('file:')) {
      return 'local'
    }

    // Handle versions with integrity hashes
    if (version.includes('_')) {
      return version.split('_')[0]
    }

    // Clean semver prefixes
    return version.replace(/^[\^~]/, '')
  }

  // Public methods
  getInstalledVersion(packageName: string): string | null {
    if (this.configService.get<string>('nodeEnv') === 'contribution') {
      return '0.0.0-contribution' // No specific version in contribution mode.
    }

    return this.installedPackages[packageName] || null
  }

  getPackageManager(): string {
    return this.packageManager
  }
}
