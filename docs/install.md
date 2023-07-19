# Install

## Prerequisites

- [NodeJS](https://nodejs.org/en/) (v14 and v16). Other versions of Node.js may not be compatible with the latest release of CASE. The 16.x version is most recommended.
- NPM version 7+ (it comes with NodeJS)

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

# Config

Use the `/app-config.ts` file to personalize your CASE app:

```js
export const appConfig: AppConfig = {
  appName: 'My great app with CASE',
  description: 'Just a simple app made with CASE'
}
```
