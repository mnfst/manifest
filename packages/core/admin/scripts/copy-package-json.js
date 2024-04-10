const fs = require('fs')
const path = require('path')

const sourcePath = path.join(__dirname, '..', 'package.json')
const destinationPath = path.join(__dirname, '..', 'dist/package.json')

fs.copyFileSync(sourcePath, destinationPath)
console.log('package.json has been copied to the dist folder.')
