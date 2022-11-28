<p align="center">CASE Angular Library</p>
 
## Description

CASE Angular Library

## Installation

run the following command:

```bash
$ npm install
```

go to projects/case-angular-library and run:

```bash
$ npm install
```

### Build library

From `/client` repository, run:

```bash
$ npm run build
```

or to watch file changes :

```bash
$ npm run build:watch
```

### Create a NPM Link to test on local CASE app

After building library :

```bash
$ cd dist/case-angular-library
$ npm link // May require sudo.
```

Then go to your CASE project in the `/client` repository (Angular project) and run:

```bash
$ npm link @case-app/angular-library
```

## Publish to NPM

First ensure that you update the version number in `/projects/case-angular-library/package.json` and then run :

```bash
npm run publish
```

Of course you need to be connected to [npmjs](https://www.npmjs.com/) with an account with permissions on that repo.
