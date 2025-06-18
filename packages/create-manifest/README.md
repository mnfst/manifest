# create-manifest

The `create manifest` create a new project with [Manifest](https://manifest.build).

```bash
yarn create manifest my-project --cursor
```

This will create a new folder named my-project, install Manifest, and configure it for Cursor.

You can replace `--cursor` with:

- `--copilot` for GitHub Copilot
- `--windsurf` for Windsurf
- or remove it entirely if you're not using an AI coding tool

You can also specify your project name directly (my-project in the example).
If omitted, the CLI will prompt you for it during setup.

```bash
npx create-manifest@latest
```

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
