<p align="center">CASE Angular Library</p>
 
## Description

CASE Angular Library

## Installation

```bash
$ npm install
```

## Develop

### Build library

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

Then go to your `@case-app/case` project it the `/client` folder (Angular project) :

```bash
$ npm link @case-app/angular-library
```

## Publish to NPM

First ensure that you update the version number in `/projects/case-angular-library/package.json` and then run :

```bash
npm run publish
```

Of course you need to be connected to [npmjs](https://www.npmjs.com/) with an account with permissions on that repo.
