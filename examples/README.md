# Examples

This folders hosts examples of Manifest implementations for **contributors**.

## How to work with npm link

[NPM Link](https://docs.npmjs.com/cli/v10/commands/npm-link) is a great tool to develop packages on real-world situations without having to publish them.

### Example with NPM manifest package

First go to `packages/core/manifest` and run this command to link the "manifest" package.

```
sudo npm link
```

the go to a folder that as `manifest` as a dependency in its `package.json` and run

```
npm link manifest
```

The local "manifest" package will now replace the dependency.

Attention: for some reason the `nodemon` binary gets removed this way. Try to add it if the `npm run manifest` command is not working: `npm i nodemon`
