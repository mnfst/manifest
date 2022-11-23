# CASE

This README would document whatever steps are necessary to get your application up and running.

If you need more documentation about the project, please check our full documentation at https://case-app.github.io/docs/#/.

CASE is an Open-Source Project, feel free to make as many pull-request as you want to contribute it!

### Install

Install schematics cli and CASE schematics globally :

```bash
sudo npm i -g @angular-devkit/schematics-cli
```

_Note for development :_ Always make sure that you have the latest version of those 2 dependencies with `@latest` as the versions evolve very fast.

To run the docs you need to install docsify globally:

```bash
npm install docsify-cli --global
```

As of today, there is no CLI to crate a new project in one command so you have to clone or download the [CASE source code](https://github.com/case-app/case) and then open your terminal in the CASE root folder for the following steps.

```
npm run case:install
```

- Create a new DB, you can name it "case" for example
- Eventually change DB name into `/server/.env`

### Serve

Open 3 terminal windows and run simultaneously :

- `npm run seed` for create data.
- `npm run start:client`
- `npm run start:server`

Now you can open your browser on `http://localhost:4200`

IMPORTANT FOR DEMO : You can connect with the user **admin@case.app** with the password **case**

## Resource

CASE allow you to easily build custom web-apps with resources and relations between them.

Create resources with this command and follow the instructions in your terminal:

```
npm run case:resource
```
