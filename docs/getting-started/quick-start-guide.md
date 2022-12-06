# Quick start guide

CASE allows you to quickly launch a reliable and flexible ERP. If you want to project yourself immediately into the product or simply create your ERP quickly, you can rely on us.

## Prerequisites

The installation requires the following software to be already installed on your computer:

- [Node.js](https://nodejs.org/en/) to run your environment: only LTS versions are supported (v14 and v16). Other versions of Node.js may not be compatible with the latest release of CASE. The 16.x version is most recommended.
- [npm](https://docs.npmjs.com/cli/v6/commands/npm-install) to run the CLI installation scripts: (v6 only).

## Section A: Create a new project with CASE Starter

CASE starter covers many use cases (ERP, dashboards, CRM, Custom software, Analytic platform). For now, CASE works only with npm, nodejs and Angular.

### Step 1: Install CASE CLI

```
npm i -g @case-app/case-cli
```

### Step 2: Create a new CASE projet

Run the following command:

```sh
case-app new
```

During the installation, the terminal will ask you **what is the name of your application**. Type `my-case-project`

The CLI will create a monorepo and install dependencies.

### Step 3: Run your project

```sh
cd my-case-project

#1st terminal window
npm run start:client

#2nd terminal window
npm run start:server
```

The frontend server will run here => http://localhost:4200
The backend server will run here => http://localhost:3000

For now, you can go to the login page of your project http://localhost:4200/ but you still can not connect to the platform.

![Login](../assets/images/introduction/login-01.png ':class=has-shadow')

We will seed the data to add users including your CASE admin user.

### Step 4: Seed the data

To generate a bunch of dummy data for all exisiting entities (Users and roles) run the following command:

```sh
npm run seed
```

![Seed](../assets/images/introduction/seed.svg)

### Step 5: sign in and have a look at your ERP

Once the seed is finished, you can access to your product via the browser. You will land to the login page. Use your CASE admin’s user credentials to log in.

> Use the email `admin@case.app` and password `case` to log in.

![Seed](../assets/images/introduction/homepage.png ':class=has-shadow')

<div style="background-color:#42b98316; border-left: 4px solid #42b983; padding: 20px;">
<h2 style="margin-top: 0">Congratulations 🎉</h2>
<p>Your product is ready! You become the first user to access your CASE product. Welcome On Board ! 👋</p>
<p>You can start playing with CASE and discover the product by yourself using our documentation, or proceed to section B below.</p>
</div>

## Section B: Add resources and make them useful / great

### Step 1: Create a new resource

### Step 2: ...

### Step final: Rely 2 resources

## Section C: What's next ?
