import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// This config is used by the build script which sets the entry dynamically
export default defineConfig({
  plugins: [viteSingleFile()],
  root: 'src/web',
  build: {
    outDir: '../../dist/web',
    emptyOutDir: false
  }
})
