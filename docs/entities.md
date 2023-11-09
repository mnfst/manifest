# Create an entity

An entity is an object often linked to a real world concept like users, customers, videos etc. Entities are the heart of any application, they encapsulate the critical business rules.

## Command line

In our example, we will create an app that lists cats. To do that, simply run on the terminal the following command:

```
npm run case:entity cat
```

A new `/entities/cat.entity.ts` file will be created with the following content:

```js
import { CaseEntity, Entity, Prop, PropType } from '@casejs/case'

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

> [!WARNING]
> This command will not work on Windows. If you are a Windows user you can just copy paste the following code in `/entities/cat.entity.ts`.

By default the entity has a single property called "name". You can already seed dummy data running this command:

```
npm run seed
```

## Entity params

You can pass different arguments to the `@Entity()` decorator to configure your entities.

| Option              | Default | Type   | Description                                                                  |
| ------------------- | ------- | ------ | ---------------------------------------------------------------------------- |
| **nameSingular\***  | -       | string | The singular lowercase name of your entity. It will be used widely on the UI |
| **namePlural\***    | -       | string | The plural lowercase name of your entity. It will be used widely on the UI   |
| **slug\***          | -       | string | The kebab-case slug of the entity that will define URLs                     |
| **propIdentifier\*** | -       | string | The main property of the entity name, will be used to identify the item      |
| **seedCount**       | 20      | number | Defines how many items of this entity should be seeded                       |
