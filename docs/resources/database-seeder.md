# Database seeder

When developing your CASE app, you may need to generate a bunch of mock data. Instead of adding the data one by one, CASE allows you to generate a massive amount of entities very quickly.

## Setup your own seeder

Every blank instance of CASE comes already with 4 resource seeders for default resources : **User**, **Role**, **Permission** and **Setting**. In addition to that, when you [create a resource](resources/create-a-resource.md), a seeder is automatically generated for that resource.

If we generate a "Customer" resource, a `customer.seeder.ts` file will be created in the `database/seeders/` folder. That files will include a factory function called `getCustomers` that you can complete with the data to be generated.

```js
private getCustomer(): Promise<Customer> {
    const customer: Customer = this.entityManager.create(Customer, {
      name: faker.company.companyName(),
      address: faker.address.streetAddress(),
      corporateGroup: {
        id: faker.random.number({ min: 1, max: this.corporateGroupCount })
      }
    })
```

CASE imports [Faker.js](https://github.com/marak/Faker.js/) by default to generate fake data.

Note that the factory function returns a promise, if you need add some **async** code in it.

You can choose how many customers are created on the top-level seeder called `seeder.ts`.

> [!ATTENTION]
> All existing data is cleared when you seed. This feature does not have be done in production.

## Seeding relationships

You will quickly encounter the need to seed relationships between entities. Let's continue with our example and say that each **Customer** belongs to a **Corporate group**, which corresponds to a [TypeORM Many-to-one relation](https://typeorm.io/#/many-to-one-one-to-many-relations/).

We need to know the number of **Corporate group** entities to add to the fill correctly the relation column in the database. To do so, we need to pass a param with the **corporateGroupCount** to our **CustomerSeeder**

```js
// seeder.ts
await new CustomerSeeder(connection, customerCount, corporateGroupCount).seed();
```

And then store it in a property to use it in the "corporateGroupId" column seeder.

Indeed, auto incremental columns are reset at each seed, this means that the entity ids (corporateGroup ids in our example) will always be within 1 and the number of lines.

```js
// customer.seeder.ts
export class CustomerSeeder {
  entityManager: EntityManager
  count: number
  corporateGroupCount: number

  constructor(
    connection: Connection,
    count: number,
    corporateGroupCount: number
  ) {
    this.entityManager = connection.createEntityManager()
    this.count = count
    this.corporateGroupCount = corporateGroupCount
  }

// [...]

  private getCustomer(): Promise<Customer> {
    const customer: Customer = this.entityManager.create(Customer, {
      name: faker.company.companyName(),
      address: faker.address.streetAddress(),
      corporateGroup: {
        id: faker.random.number({ min: 1, max: this.corporateGroupCount })
      }
    })

    return Promise.resolve(customer)
```
