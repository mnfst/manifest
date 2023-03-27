# CASE CLI

## Develop

```
npm install
```

Watch changes:

```bash
npm run build:watch
```

Run command:

```bash
node cli.js
```

If you want to use the CLI from a CASE project like `case-starter` you can call it relatively:

```
node ../case/packages/case-cli/cli.js
```

## Publish to npm

To publish, simply update the version number in `package.json` and run:

```bash
npm run build

npm publish
```
