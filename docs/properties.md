# Add properties to an entity

Properties are key-value pairs inside entities. They are usually mapped to database columns.

## Syntax

You can add the properties to your entities by adding the CASE `@Prop()` decorator above the property name and type.

```js
import { CaseEntity, Entity, Prop, PropType } from '@casejs/case'

[...]
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

By default the **PropType** is `Text`, a classic string, but you have [plenty of other available types](property-types.md).

## Property params

You can pass arguments to the `@Prop()` decorator:

| Option      | Default              | Type     | Description                                                         |
| ----------- | -------------------- | -------- | ------------------------------------------------------------------- |
| **label**   | _same as propName_   | string   | The label of the property                                           |
| **type**    | PropType.Text        | PropType | The [CASE type](property-types.md) of the property                  |
| **seed**    | _type seed function_ | function | The [custom seeder function](dummy-data.md#custom-seeder-functions) |
| **options** | {}                   | Object   | [Property options](#options)                                        |

## <a name="options"></a>Options

Some types have a specific set of options. Nevertheless, the following options are applicable to all properties in the `options` object parameter.

| Option               | Default | Type    | Description                                                                                 |
| -------------------- | ------- | ------- | ------------------------------------------------------------------------------------------- |
| **filter**           | `false` | boolean | Adds a filter in lists (currently only for [Relation PropType](property-types.md#relation)) |
| **isHiddenInList**   | `false` | boolean | Hides the column in the list.                                                               |
| **isHiddenInDetail** | `false` | boolean | Hides this property in the detail view.                                                     |

Example:

```js
  @Prop({
    type: PropType.Textarea,
    options: {
     isHiddenInList: true,
     isHiddenInDetail: true
    }
  })
  comments: string
```
