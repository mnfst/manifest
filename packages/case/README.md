## CASE

## Contribute (client app)

To run the client app on `http://localhost:4200`:

```bash
cd packages/case/client
npm install
ng serve --configuration=contribution
```

## Contribute (server app)

```bash
cd packages/case/server
npm install
npm run start:dev

# Seed in dev mode
npm run seed:dev
```

The folder `packages/case/server/src/_contribution-root` replicates the app root folder of the `CASE Starter` repo.

## Contribute (work from starter)

Using `npm link` you can link your `/node_modules/@casejs/case` to the `dist` folder in your project made with CASE starter.

```
npm install
npm run build
cd server/dist

# may require sudo
npm link
```

Then go to your case starter project and run

```
npm link @casejs/case
npm start
```

## Publish

Update the version number in `package.json` and run:

```
npm run build
cd server/dist
npm publish

# For beta versions
npm publish --tag beta
```
