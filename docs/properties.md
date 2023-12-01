# Add properties to an entity

Properties are key-value pairs inside entities. They are usually mapped to database columns.

## Syntax

You can add the properties to your entities by adding the CASE `@Prop()` decorator above the property name and type.

```js
import { BaseEntity, Entity, Prop, PropType } from '@casejs/case'

[...]
export class Cat extends BaseEntity {
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

> [!Tip]
>
> By default, all properties are optional (nullable). You can make them required using [validators](validation.md).

## Property types

CASE adds real-world property types to make your work easier. By default the **PropType** is [Text](property-types.md?id=text), a classic string, but you have [plenty of other available types](property-types.md).

## Property params

You can pass arguments to the `@Prop()` decorator:

| Option         | Default              | Type                | Description                                                            |
| -------------- | -------------------- | ------------------- | ---------------------------------------------------------------------- |
| **label**      | _same as propName_   | string              | The label of the property                                              |
| **type**       | `PropType.Text`      | PropType            | The [Property type](property-types.md)                                 |
| **seed**       | _type seed function_ | function            | The [custom seeder function](dummy-data.md?id=custom-seeder-functions) |
| **options**    | {}                   | Object              | [Property options](properties.md?id=options)                           |
| **validators** | []                   | PropertyDecorator[] | [Validation functions](validation.md)                                  |

## Options

Some types have a specific set of options. Nevertheless, the following options are applicable to all properties in the `options` object parameter.

| Option                   | Default | Type    | Description                                                     |
| ------------------------ | ------- | ------- | --------------------------------------------------------------- |
| **isHidden**             | `false` | boolean | Hides the column in all API responses                           |
| **isHiddenInAdminList**  | `false` | boolean | Hides the column in the list of the Admin panel                 |
| **isHiddenInCreateEdit** | `false` | boolean | Hides this property in create and edit views of the Admin panel |

Example:

```js
  @Prop({
    type: PropType.Textarea,
    options: {
     isHiddenInAdminList: true,
     isHiddenInCreateEdit: true
    }
  })
  comments: string
```
