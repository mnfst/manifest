# create-manifest

The `create manifest` create a new project with [Manifest](https://manifest.build).

```bash
# NPM
npx create-manifest@latest

# Yarn
yarn create manifest
```

This will create a folder named my-project and install Manifest inside it.
If you leave out the name, the CLI will ask you for it during setup.

You can add a flag to set up rules for your AI code Editor:

- `--cursor` for **Cursor**
- `--copilot` for **GitHub Copilot**
- `--windsurf` for **Windsurf**

## Develop

```bash
npm install

# Run from a test folder to prevent messing with project files.
mkdir test-folder
cd test-folder
../bin/dev.js
```

However due to the monorepo workspace structure, the launch script will fail as the path to the node modules folder is different than when served. This is normal.

## Publish

```bash
npm run build
npm publish
```
