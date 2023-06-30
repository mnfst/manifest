# Properties

Properties are key-value pairs inside entities. They are usually mapped to database columns.

## Add a property to an entity

You can add the properties to your entities by adding the CASE `@Prop()` decorator above the property name.

```js
export class Cat extends CaseEntity {
  @Prop()
  nickName: string

  @Prop({
    type: PropType.Number
  })
  age: number

  @Prop({
    label: 'Owner of the cat',
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner
}
```

### Property params

You can pass arguments to the `@Prop()` decorator:

| Option      | Default              | Type     | Description                    |
| ----------- | -------------------- | -------- | ------------------------------ |
| **label**   | _same as propName_   | string   | The label of the property      |
| **type**    | PropType.Text        | PropType | The CASE type of the property  |
| **seed**    | _type seed function_ | function | Seed function for the property |
| **options** | {}                   | Object   | Property options based on type |

### Property types

CASE works with it's own set of **PropTypes** that corresponds to different types of data often used in CRUD apps.

Under the hood, each **PropType** corresponds to a set a different logic. For example by specifying once that this value is a **Currency**, CASE takes care of displaying it correctly, adding the 2 digits after the comma and choosing the correct database column format. If you do not specify a `seed` param, it will still generate a nice amount when you seed

| Type     | Input    | Seed function         | Comments                       |
| -------- | -------- | --------------------- | ------------------------------ |
| Text     | Text     | product name          |                                |
| Number   | Number   | random integer        |                                |
| Currency | Number   | random amount         | Only € currency                |
| Date     | Date     | passed date           |                                |
| TextArea | Textarea | product description   |                                |
| Email    | Email    | random email          |                                |
| Boolean  | Checkbox | random boolean        |                                |
| Relation | Select   | random related entity | only many-to-one relationships |

#### Create entity relationships with the "Relation" PropType

It is very easy to create relationships between 2 entities in CASE: You just need to pass the `type: PropType.Relation` and the related entity class to the `options.entity` param like so:

```js
export class Cat extends CaseEntity {
  @Prop({
    label: 'Owner of the cat',
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner
}
```

Notes:

- CASE Relations only work in the **Children => Parent** direction on many-to-one relationships
- We use **cascade delete**: if you delete the _Owner_ on the UI, it will also delete all his or her _Cat_ entities

### Custom property seeders

To generate high quality dummy data, you can choose the way a property is seeded through the `@Prop()` decorator's `seed` param:

```js
@Prop({
    label: 'Full name',
    seed: () => `${faker.person.firstName()} ${faker.person.familyName()}`
  })
  fullName: string
```

The seed function accepts an `index: number` param that returns the index of the item in the seed process.
