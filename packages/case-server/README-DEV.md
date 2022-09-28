<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

 <p align="center">CASE Nest Library</p>
 
## Description

CASE Nest Library

## Installation

```bash
$ npm i
```

## Develop

### Build library

```bash
$ npm run build
```

### NPM Link

After building library :

```bash
$ cd dist
$ npm link // May require sudo.
```

Then go to your CASE project and cd into the `/server` folder and then:

```bash
$ npm link @case-app/nest-library
```

## Publish to npm

Update your version number in `package.json` and then:

```bash
npm run build
cd dist
npm publish
```

### Updating your published package version number

To change the version number in package.json, on the command line, in the package root directory, run the following command, replacing <update_type> with one of the semantic versioning release types (patch, major, or minor):
Run npm publish.

```bash
# update_type is patch, major, or minor
$ npm version <update_type>
```

You need login once before publish

```bash
$ npm login
```
