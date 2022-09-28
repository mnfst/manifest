# Install

- Download the [last version of CASE framework](https://github.com/case-app/case) : Following the previous link, click on the green "Code" button and the download ZIP.

![CASE App](../assets/images/introduction/how-to-download-case-on-github.png ':size=40%')

- Extract folder and follow install procedure on the README.md file in the new repo

# Angular schematics & Case schematics

To build your awesome Case Project you'll need to install schematics cli from Angular and CASE schematics globally :

```
sudo npm i -g @angular-devkit/schematics-cli
sudo npm i -g @case-app/schematics
```

> Note for development : Always make sure that you have the latest version of those 2 dependencies with @latest as the versions evolve very fast.

At the moment there is no CLI.

To create a new project in one command so you have to **clone** or **download** the CASE source code on the [github repository of the project ](https://github.com/case-app/case),
then open your terminal in the CASE root folder for the following steps :

- `npm run case:install`

- Create a new DB, you can name it "case" for example
- Eventually change DB name into /server/.env

# Serve

Congratulations ! You're about to start your CASE Project ! 🎉

Open 2 terminals windows and in each one run :

```bash
npm run start:client
```

```bash
npm run start:server
```

Then open a 3rd window to seed data to the database

```bash
npm run seed
```

> This command is seeding you fake data to work with until you make every API calls.

Tadadam ! You can now open your browser on http://localhost:4200 to see your CASE application !

> IMPORTANT FOR DEMO : You can connect to your CASE apps as admin with the user __admin@case.app__ and the password **case**

# Happy coding !

**CASE is an open-source project, feel free to participate to it or giving us feedbacks**
