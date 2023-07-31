# Install

## Prerequisites

- [NodeJS](https://nodejs.org/en/) (v16 and v18). Other versions of Node.js may not be compatible with the latest release of CASE. The 18.x version is most recommended.
- NPM version 7+ (comes with NodeJS)

## Create your CASE project

Run on your terminal replacing `my-case-app` by your app's name:

```
npx create-case-app my-case-app
```

## Serve the app locally

```
cd my-case-app
npm start
```

And then visit [http://localhost:4000](http://localhost:4000) to see it live.

## Config

Environment variables are managed to a [dotenv](https://www.npmjs.com/package/dotenv) file created at the root level

```env
# .env

PORT=4000
JWT_SECRET=secret_key
```
