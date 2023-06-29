# Entities

An entity is an object often linked to a real world concept like users, customers, videos etc. Entities are the heart of any application, they encapsulate the critical business rules.

## Create an entity

In our example, we will create an app that lists famous painters and their works (why not ?). Simply run on the terminal the following command:

```
npm run case:entity painter
```

The application should reload with some painters now !

This is because a new `/entities/painter.entity.ts` file for this entity was created with the following content:

```js
@Entity({
  nameSingular: 'painter',
  namePlural: 'painters',
  slug: 'painter'
})
export class Painter {
  @Prop()
  name: string
}
```

## Entity definition params

You can pass different arguments to the `@Entity()` decorator to configure your entities.

| Option             | Default | Type   | Description                                                                  |
| ------------------ | ------- | ------ | ---------------------------------------------------------------------------- |
| **nameSingular\*** | -       | string | The singular lowercase name of your entity. It will be used widely on the UI |
| **namePlural\***   | -       | string | The plural lowercase name of your entity. It will be used widely on the UI   |
| **slug\***         | -       | string | The kebbab-case slug of the entity that will define URLs                     |
| **seedCount**      | 20      | number | Defines how many items of this entity should be seeded                       |
