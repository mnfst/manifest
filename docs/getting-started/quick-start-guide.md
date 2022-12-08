# Quick start guide

CASE allows you to quickly launch a reliable and flexible ERP. If you want to project yourself immediately into the product or simply create your ERP quickly, you can rely on us.

## Prerequisites

The installation requires the following software to be already installed on your computer:

- [NodeJS](https://nodejs.org/en/) to run your environment: only LTS versions are supported (v14 and v16). Other versions of Node.js may not be compatible with the latest release of CASE. The 16.x version is most recommended.
- [MySQL](https://www.mysql.com/) for the database.

## Section A: Create a new project

CASE starter covers many use cases (ERP, dashboards, CRM, Custom software, Analytic platform). For now, CASE works only with npm, nodejs and Angular.

### Step 1: Install CASE CLI

```
npm i -g @case-app/case-cli
```

### Step 2: Create a new CASE project

Run the following command:

```sh
case-app new
```

During the installation, the terminal will ask you **what is the name of your application**. Type `my-case-project`

The CLI will create a monorepo and install dependencies.

### Step 3: Setup and serve

Copy the environment file and set your environment variables:

```sh
cp server/.env.example server/.env
```

CASE uses **MySQL** for the database.

You will need to create a new database and add the name to the _DB_NAME_ property of your `.env` file. The default name for the database is **case**. Once done you can install dependencies:

```sh
npm run start:client

# Simultaneously open a 2nd terminal window and run :
npm run start:server

```

For now, you can go to the login page of your project http://localhost:4200/ but you still can not connect to the platform.

![Login](../assets/images/introduction/login-01.png ':class=has-shadow')

We will seed the data to add users including your CASE admin user.

### Step 4: Seed the data

To generate a bunch of dummy data for all existing entities (Users and roles) run the following command:

```sh
npm run seed
```

### Step 5: sign in and have a look at your ERP

Once the seed is finished, you can access to your product via the browser. You will land to the login page. Use your CASE admin’s user credentials to log in.

> Use the email `admin@case.app` and password `case` to log in.

![Seed](../assets/images/introduction/homepage.png ':class=has-shadow')

<div style="background-color:#42b98316; border-left: 4px solid #42b983; padding: 20px;">
<h2 style="margin-top: 0">Congratulations 🎉</h2>
<p>Your product is ready! You become the first user to access your CASE product. Welcome On Board ! 👋</p>
<p>You can start playing with CASE and discover the product by yourself using our documentation, or proceed to section B below.</p>
</div>

## Section B: Add resources and business logic

Now that we have our project ready with users and roles, we will need to add some resources to manage. It can be projects, customers, invoices, cars or even horses !

### Step 1: Create a new resource

In our example, we will create **an app that lists famous painters and their works** (why not ?).

Run the `case-app resource [name]` command replacing the name by the singular, "camelCase" name of your resource:

```sh
case-app resource painter
```

That's it, you have now a functional list of painters ! You already can create painters, edit them and delete them.

With your command, a bunch of new files was generated, you can have a look at [the resource doc](/resources/create-a-resource.md) to see the detail of those new files.

### Step 2: Add properties to a resource

Our list of painters is quite boring right now, let's add a new property: their country of origin. Look at the newly created `painter.entity.ts` and add the country property with the column decorator. Let's keep it easy for now and say that it is a string. See that `@Entity` and `@Column` decorators ? CASE uses [TypeORM](https://typeorm.io/) to transcribe that code into a database structure change.

```js
@Entity({ name: 'painters' })
export class Painter {
  public static searchableFields: string[] = ['name']
  public static displayName: string = 'name'

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  // Add country property.
  @Column()
  country: string

  [...]
}
```

You can check the database structure changed: the "country" column has been created in your database. All values are empty for now, let's add some dummy data to make it more fun ! In the `painter.seeder.ts` you can add a dummy value for it:

```js
const painter: Painter = this.entityManager.create(Painter, {
  // Insert factory properties here.
  name: faker.lorem.word(),
  // Faker function to create dummy countries.
  country: faker.address.country()
})
```

And seed the new data.

```sh
npm run seed
```

All our painters have now a country ! To create a "Country" column in the list, add a [yield](/list/yields.md) to the `painter.yields.ts`.

```js
export const painterYields: Yield[] = [
  {
    label: 'Name',
    property: 'name'
  },
  {
    label: 'Country',
    property: 'country'
  }
]
```

Last but not least, let's add the "country" field in create and edit forms to allow users to change it ! On the `painter.create-edit.component.ts` file, add a new field in the form:

```js
  fields: Field[] = [
    {
      label: 'Name',
      property: 'name',
      className: 'is-6',
      required: true,
      inputType: InputType.Text
    },
    {
      label: 'Country of origin',
      property: 'country',
      required: true,
      inputType: InputType.Text
    }
  ]
```

### Step 3: Add relations to resources

What is a painter without a painting ? Nothing, so let's create the **Painting** resource and the relationship with the **Painter** entity.

Let's start by creating the painting resource:

```sh
case-app resource painting
```

We want a **one-to-many relationship**: a painter can have many paintings and a painting belongs necessarily to a painter.

The relation has to be done on both sides: in the `painter.entity.ts` file:

```js
  // New relation property: a painter has many paintings.
  @OneToMany(() => Painting, (painting) => painting.painter)
  paintings: Painting[]
```

And in the `painting.entity.ts` file:

```js
  // New relation property: a painting belongs to a painter.
  @ManyToOne(() => Painter, (painter) => painter.paintings)
  painter: Painter
```

That code above should create the appropriate relationship in your database. Then you can follow the [relation doc](/resources/relations.md) to learn how to **edit** an entity relations, **seed** dummy data and even filter your lists by its relations.

## What's next ?

Now that you have the basics, you are free to make your CASE project evolve your way. Each project is different and its own business logic, you can add your own features.

If you encounter bugs or issues, [please let us know](https://github.com/case-app/case/issues/new).

Happy coding !
