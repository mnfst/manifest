## CASE

## Contribute (client app)

To run the client app on `http://localhost:4200`:

```bash
cd packages/case/client
npm install
ng serve --configuration=contribution
```

Then go somewhere and install and start a CASE app to have the server version:

```
npx @casejs/create-case-app@latest my-case-app next
```

## Contribute (server app)

```
# From packages/case/server
npm run start:dev

# Seed in dev mode
npm run seed:dev
```

You can put your temporary entities in `packages/case/server/entities`

## Publish

Update the version number in `package.json` and run:

```
npm run build
npm publish
```
