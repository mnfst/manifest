# Create an entity

An entity is an object often linked to a real world concept like users, customers, videos etc.

In CASE, all entities are located in the `/entities` folder. If you check it, you have the `Admin` entity in `admin.entity.ts`. This is the entity that you use to access the Admin panel, you should not delete it !

Let's start structuring our data and add more of those.

## Command line

In our example, we will create an app that lists cats. To do that, run:

```
npm run case:entity cat
```

A new `/entities/cat.entity.ts` file will be created with the following content:

```js
import { BaseEntity, Entity, Prop } from '@casejs/case'

@Entity()
export class Cat extends BaseEntity {
  @Prop()
  name: string
}
```

> [!WARNING]
> This command will not work on Windows. If you are a Windows user you can just copy paste the following code in `/entities/cat.entity.ts`.

By default the entity has a single property called `name`. You can already seed dummy data running this command:

```
npm run seed
```

## Entity params

You can pass different arguments to the `@Entity()` decorator to configure your entities.

| Option            | Default                    | Type   | Description                                                                |
| ----------------- | -------------------------- | ------ | -------------------------------------------------------------------------- |
| **nameSingular**  | _singular lower case name_ | string | The singular lowercase name of your entity. Used widely on the admin panel |
| **namePlural**    | _plural lower case name_   | string | The plural lowercase name of your entity. Used widely on the admin panel   |
| **slug**          | _plural dasherized name_   | string | The kebab-case slug of the entity that will define API endpoints           |
| **propIdentifer** | _first column in entity_   | string | Identifier prop. Used widely on the admin panel                            |
| **seedCount**     | `50`                       | number | Defines how many items of this entity should be seeded                     |
| **apiPolicies**   | _no restriction_           | object | [API policies](api-policies.md) for CRUD operations                        |
