# Properties

Now that you have one or several entities, you can describe them by adding properties.

## Add a property

The only file you will need is the `entity.ts` of your entity.

You can add the properties age and owner to your `/entities/painter.entity.ts` like follow.

```js
@Prop({
    label: 'Age',
    type: PropType.Number,
  })
  age: number

    @Prop({
    label: 'Owner',
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner
```

#### Property definition params

You can pass different arguments to the `Prop()` decorator to configure your entities.

| Option      | Type            | Description                                                                                                                                                    |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **label\*** | string          | The label of the property that will be displayed either on the list, the detail and the create-edit page.                                                      |
| **type\***  | PropType        | The type of the property define the type of input, display , default seed and other behavior regarding the property.                                           |
| **seed\***  | -               | The seed of the property is the value you want to be return to your property when you seed. We recommend to use `faker.js`to have close to reality dummy data. |
| **options** | RelationOptions | The different options you can add to the property. Currently you can define if the property is a Relation.                                                     |

#### PropType

The `type` you can give to your property has to be one of those.

| Type     |
| -------- |
| Text     |
| Number   |
| Currency |
| Date     |
| TextArea |
| Email    |
| Boolean  |
| Relation |

#### RelationOptions

The options you can add to your property to link it with an other entity is working like so.

| Option           | Type   | Description                                    |
| ---------------- | ------ | ---------------------------------------------- |
| **entity\***     | Entity | The `@Entity()`class related to this property. |
| **entityName\*** | string | The entity name of the related entity          |

## Custom seeders

You can customize the seed of your property by setting the value you want to be displayed.

You can use `faker.js`like follow to add a random dummy data close to your development environment.

```js
@Prop({
    label: 'Age',
    type: PropType.Number,
    seed: () => faker.number.int({ max: 100 })
  })
  age: number
```
