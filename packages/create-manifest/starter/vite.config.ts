import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { chatGPTWidgetPlugin } from 'vite-plugin-chatgpt-widgets'
import { resolve } from 'path'

const port = Number(process.env.PORT) || 3000

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    chatGPTWidgetPlugin({
      widgetsDir: 'src/web',
      baseUrl: `http://localhost:${port}`
    })
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src/web')
    }
  },
  build: {
    manifest: true,
    outDir: 'dist/web',
    rollupOptions: {
      // Don't look for default index.html - the plugin adds widget entries
      input: {}
    }
  },
  server: {
    cors: {
      origin: true
    }
  }
})
