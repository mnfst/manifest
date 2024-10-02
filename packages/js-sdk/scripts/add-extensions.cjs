// Usage: node scripts/add-extensions.js
// This script will add .js extensions to all imports in the compiled files. It will also add /index.js if there's a directory with an index.js file.

const fs = require('fs')
const path = require('path')

// Directory where your compiled files are
const dir = path.resolve(__dirname, '../dist')

function addJsExtensionToImports(directory) {
  const files = fs.readdirSync(directory)

  files.forEach((file) => {
    const fullPath = path.join(directory, file)

    if (fs.statSync(fullPath).isDirectory()) {
      // Recursively apply this function to subdirectories
      addJsExtensionToImports(fullPath)
    } else if (file.endsWith('.js')) {
      // Read the file and replace imports without extensions
      let content = fs.readFileSync(fullPath, 'utf8')
      content = content.replace(/from\s+['"](\..*?)['"]/g, (match, p1) => {
        const targetDir = path.resolve(path.dirname(fullPath), p1)

        // Check if there's an index.js file in the target directory
        if (fs.existsSync(path.join(targetDir, 'index.js'))) {
          return `from '${p1}/index.js'`
        } else {
          // If no index.js file, just append .js
          if (!p1.endsWith('.js')) {
            return `from '${p1}.js'`
          }
          return match
        }
      })
      fs.writeFileSync(fullPath, content, 'utf8')
    }
  })
}

// Run the script to add .js extensions and index.js if necessary
addJsExtensionToImports(dir)
