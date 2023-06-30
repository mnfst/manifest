# CASE schematics

This repository is a set of CASE Framework schematics for the client (Angular) and the server (NestJS).

## Installation

From `packages/schematics`, run:

```bash
npm install
```

## Development

To build the schematics, still `packages/schematics` repository, run:

```bash
npm run build
```

or to watch file changes :

```bash
npm run build:watch
```

After any change in `/files` sub-directories, run this command:

```bash
npm run move
```

To link and use in any CASE project:

```bash
cd dist
npm link // May required sudo.
```

and then at the root of your CASE project :

```bash
npm link @casejs/schematics
```

## Publishing

To publish, simply update the version number in `package.json` and do:

```bash
npm run publish
```

That's it!
