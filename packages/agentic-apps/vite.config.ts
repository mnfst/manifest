import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

// Find all HTML files in src/web subdirectories
function findHtmlEntries(dir: string): Record<string, string> {
  const entries: Record<string, string> = {}
  const webDir = resolve(__dirname, dir)

  function scanDir(currentDir: string, prefix = '') {
    const items = readdirSync(currentDir)
    for (const item of items) {
      const fullPath = join(currentDir, item)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        scanDir(fullPath, prefix ? `${prefix}/${item}` : item)
      } else if (item.endsWith('.html')) {
        const name = prefix ? `${prefix}/${item.replace('.html', '')}` : item.replace('.html', '')
        entries[name] = fullPath
      }
    }
  }

  scanDir(webDir)
  return entries
}

export default defineConfig({
  plugins: [viteSingleFile()],
  root: 'src/web',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      input: findHtmlEntries('src/web')
    }
  }
})
