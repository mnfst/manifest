# Install

## Prerequisites

- [NodeJS](https://nodejs.org/en/) (**v16.14.0** or higher). The recommended version is **18.x**.

## Create your CASE project

Run the following on your terminal replacing `my-case-app` with your app's name:

```
npx create-case-app my-case-app
```

Then serve the app locally:

```
cd my-case-app
npm start
```

🎉 **Your backend is ready !**
<br>
<br>You can now:
<br> - See your **Admin panel** at http://localhost:4000
<br> - Use your **REST API** at http://localhost:4000/api

## Config

Environment variables are managed to a [dotenv](https://www.npmjs.com/package/dotenv) file created at the root level.

```env
# .env

PORT=4000
JWT_SECRET=secret_key
NODE_ENV=development
```
