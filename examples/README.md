# Examples

Examples are apps built with CASE for backend. They can be used for developing or testing.

## Run

Using `npm link` you can link your example app `/node_modules/@casejs/case` to the `dist` folder in your project made with CASE starter.

```

# From the packages/core/case folder:
npm install
npm run build
cd dist

# may require sudo
npm link
```

Then go to your example app and run

```
npm install
npm link @casejs/case
npm start
```
