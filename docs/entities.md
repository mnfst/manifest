# Entities

An entity is an object often linked to a real world concept like users, customers, videos etc. Entities are the heart of any application, they encapsulate the critical business rules.

## Create an entity

In our example, we will create an app that lists cats. To do that, simply run on the terminal the following command:

```
npm run case:entity cat
```

A new `/entities/cat.entity.ts` file was created with the following content:

```js
@Entity({
  nameSingular: 'cat',
  namePlural: 'cats',
  propIdentifier: 'name',
  slug: 'cats'
})
export class Cat extends CaseEntity {
  @Prop({
    type: PropType.Text
  })
  name: string
}
```

By default the entity has a single property called "name". You can already seed dummy data running this command:

```
npm run seed
```

### Entity params

You can pass different arguments to the `@Entity()` decorator to configure your entities.

| Option              | Default | Type   | Description                                                                  |
| ------------------- | ------- | ------ | ---------------------------------------------------------------------------- |
| **nameSingular\***  | -       | string | The singular lowercase name of your entity. It will be used widely on the UI |
| **namePlural\***    | -       | string | The plural lowercase name of your entity. It will be used widely on the UI   |
| **slug\***          | -       | string | The kebbab-case slug of the entity that will define URLs                     |
| **propIdentifer\*** | -       | string | The main property of the entity name, will be used to identify the item      |
| **seedCount**       | 20      | number | Defines how many items of this entity should be seeded                       |

## Add a property to an entity

Properties are key-value pairs inside entities. They are usually mapped to database columns.

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
