# add-manifest

The `add-manifest` command adds [Manifest](https://manifest.build) to your project.

```bash
npx add-manifest
```

## Develop

```bash
npm install

# Run from a test folder to prevent messing with project files.
mkdir test-folder
cd test-folder
../bin/dev.js
```

However due to the monorepo workspace structure, the launch script will fail as the path to the node modules folder is different than when served.

## Publish

```bash
npm run build
npm publish
```
