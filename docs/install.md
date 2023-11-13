# Install

## Prerequisites

- [NodeJS](https://nodejs.org/en/) (v16.14.0 or higher). The recommended version is `18.x`.
- NPM version 6.11.0+ (comes with NodeJS).

## Create your CASE project

Run the following on your terminal replacing `my-case-app` with your app's name:

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

Environment variables are managed to a [dotenv](https://www.npmjs.com/package/dotenv) file created at the root level.

```env
# .env

PORT=4000
JWT_SECRET=secret_key
```
