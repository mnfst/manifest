import { build } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readdirSync, statSync, rmSync, mkdirSync, existsSync } from 'fs'
import { resolve, join, relative, dirname } from 'path'

const webDir = resolve(import.meta.dirname, '../src/web')
const outDir = resolve(import.meta.dirname, '../dist/web')

// Find all HTML files
function findHtmlFiles(dir: string): string[] {
  const files: string[] = []

  function scan(currentDir: string) {
    for (const item of readdirSync(currentDir)) {
      const fullPath = join(currentDir, item)
      if (statSync(fullPath).isDirectory()) {
        scan(fullPath)
      } else if (item.endsWith('.html')) {
        files.push(fullPath)
      }
    }
  }

  scan(dir)
  return files
}

async function main() {
  // Clean output directory
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true })
  }
  mkdirSync(outDir, { recursive: true })

  const htmlFiles = findHtmlFiles(webDir)
  console.log(`Found ${htmlFiles.length} HTML file(s) to build`)

  for (const htmlFile of htmlFiles) {
    const relativePath = relative(webDir, htmlFile)
    const outputSubDir = dirname(relativePath)

    console.log(`Building: ${relativePath}`)

    await build({
      configFile: false,
      plugins: [viteSingleFile()],
      root: dirname(htmlFile),
      build: {
        outDir: join(outDir, outputSubDir),
        emptyOutDir: false,
        rollupOptions: {
          input: htmlFile
        }
      },
      logLevel: 'warn'
    })
  }

  console.log('Build complete!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
