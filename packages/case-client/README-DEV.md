<p align="center">CASE Angular Library</p>
 
## Description

CASE Angular Library

## Installation

From `packages/case-client`, run the following command:

```bash
$ npm install
$ cd projects/case-angular-library
$ npm install
```

### Build library

From `packages/case-client` repository, run:

```bash
npm run build
```

or to watch file changes :

```bash
npm run build:watch
```

### Create a NPM Link to test on local CASE app

After building library :

```bash
cd dist/case-angular-library
npm link // May require sudo.
```

Then go to your CASE project in the `/client` repository (Angular project) and run:

```bash
npm link @case-app/angular-library
```

> ⚠️ If your CASE project returns errors while serving the client, you may have to restart the watcher after linking your CASE project

## Publish to NPM

First ensure that you update the version number in `/projects/case-angular-library/package.json` and then run :

```bash
npm run publish
```

Of course you need to be connected to [npmjs](https://www.npmjs.com/) with an account with permissions on that repo.
