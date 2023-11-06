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

By default the **PropType** is `Text`, a classic string, but you have [plenty of other available types](property-types.md).

## Property params

You can pass arguments to the `@Prop()` decorator:

| Option         | Default              | Type                | Description                                                         |
| -------------- | -------------------- | ------------------- | ------------------------------------------------------------------- |
| **label**      | _same as propName_   | string              | The label of the property                                           |
| **type**       | PropType.Text        | PropType            | The [CASE type](property-types.md) of the property                  |
| **seed**       | _type seed function_ | function            | The [custom seeder function](dummy-data.md#custom-seeder-functions) |
| **options**    | {}                   | Object              | [Property options](properties.md?id=options)                        |
| **validators** | []                   | PropertyDecorator[] | [Validation functions](properties.md?id=validation)                 |

## Validation

Validation is done with (class-validator)[https://github.com/typestack/class-validator]. To use it, install the package first:

```
npm install class-validator
```

And then you can add an array of validators to each property:

```js
import { IsEmail, IsNotEmpty, Min } from 'class-validator'

[...]

@Prop({
  type: PropType.Email,
  validators: [IsNotEmpty(), IsEmail()]
})
email: string

@Prop({
  type: PropType.Currency,
  validators: [IsNotEmpty(), Min(1000)],
  options: {
    currency: 'EUR'
  }
})
wealth: number

```

## Options

Some types have a specific set of options. Nevertheless, the following options are applicable to all properties in the `options` object parameter.

| Option                   | Default | Type    | Description                                                                                 |
| ------------------------ | ------- | ------- | ------------------------------------------------------------------------------------------- |
| **filter**               | `false` | boolean | Adds a filter in lists (currently only for [Relation PropType](property-types.md#relation)) |
| **isHiddenInList**       | `false` | boolean | Hides the column in the list                                                                |
| **isHiddenInDetail**     | `false` | boolean | Hides this property in the detail view                                                      |
| **isHiddenInCreateEdit** | `false` | boolean | Hides this property input in create and edit views                                          |

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
