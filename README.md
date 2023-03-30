<p align="center">
  <a href="https://www.case.app">
    <img alt="CASE" src="https://user-images.githubusercontent.com/11723962/163216302-7ceab1a8-19a1-444b-93f7-3d7469ee9986.png" />
  </a>
</p>
<h1 align="center" style="font-weight: bold">
  CASE
</h1>

CASE allows you to launch a reliable and powerful application or ERP instantly and easily. CASE is fully customizable and open to contributions. You can contribute by adding features, reporting bugs or participating in discussions.

![screenshot image](./screenshot.png)

# Quick start

Follow our [quickstart guide](https://docs.case.app) to learn how to set up a CASE project step by step.

# Getting started

1. **Install CASE CLI**

   ```sh
   npm i -g @case-app/case-cli
   ```

2. **Create a new CASE project**

   ```sh
   case-app new
   ```

   During the installation, when the terminal asks you what is the name of your application, just write your application's name and press `Enter`.

   The CLI will create a monorepo and install dependencies.

3. **Setup**

   Copy the environment file and set your environment variables:

   ```sh
   cp server/.env.example server/.env
   ```

   CASE uses MySQL for the database.

   Create a new database and add the database name to the _DB_NAME_ property of your `.env` file. The default name for the database is case.

4. **Run your project**

   ```sh
   cd my-case-project

   #1st terminal window
   npm run start:client

   #2nd terminal window
   npm run start:server
   ```

   The frontend server will run here => http://localhost:4200

   The backend server will run here => http://localhost:3000

5. **Seed the data**

   ```sh
   npm run seed
   ```

6. **Got http://localhost:4200/**
   And Use your CASE admin’s user credentials to log in.

   > You can use the email `admin@case.app` and password `case` to log in.

# Serve the documentation

```sh
npm run start:docs
```

# Deploying to production

...Coming soon
