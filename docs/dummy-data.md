# Dummy data

Having high quality dummy data is crucial to replicate the experience of your future users as much as possible.

CASE comes with a built-in seeder function, simply run on your terminal:

```
npm run seed
```

## <a name="custom-seeder-functions"></a>Custom seeder functions

By default, CASE will try to generate a consistent dummy value by using the **PropType** of your property.

In order to personalize your dummy data even more, you can **choose the way a property is seeded** through the `@Prop()` decorator's `seed` param:

```js
  // customer.entity.ts
  import { faker } from '@faker-js/faker'

  [...]

  export class Customer extends BaseEntity {
    @Prop({
        label: 'Full name',
        seed: () => `${faker.person.firstName()} ${faker.person.lastName()}`
    })
    fullName: string

    @Prop({
        seed: (index: number) => `user${index}@case.app`
    })
    email: string
  }
```

The seed function accepts an `index: number` param that returns the index of the item in the seed process.

In this example we use [Faker](https://fakerjs.dev/) package to generate fake data. To install it, run:

```
npm i @faker-js/faker
```
