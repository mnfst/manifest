# Entities

An entity is an object often linked to a real world concept like users, customers, videos etc. Entities are the heart of any application, they encapsulate the critical business rules.

## Create an entity

In our example, we will create an app that lists cats. To do that, simply run on the terminal the following command:

```
npm run case:entity cat
```

A new `/entities/cat.entity.ts` file was created with the following content:

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

### Property params

You can pass arguments to the `@Prop()` decorator:

| Option      | Default              | Type     | Description                    |
| ----------- | -------------------- | -------- | ------------------------------ |
| **label**   | _same as propName_   | string   | The label of the property      |
| **type**    | PropType.Text        | PropType | The CASE type of the property  |
| **seed**    | _type seed function_ | function | Seed function for the property |
| **options** | {}                   | Object   | Property options               |

#### Common options (for all types)

Some types have a specific set of options. Nevertheless, the following options are applicable to all properties in the `options` object parameter.

| Option               | Default | Type    | Description                                                                |
| -------------------- | ------- | ------- | -------------------------------------------------------------------------- |
| **filter**           | `false` | boolean | Adds a filter in lists (currently only for [Relation PropType](#relation)) |
| **isHiddenInList**   | `false` | boolean | Hides the column in the list.                                              |
| **isHiddenInDetail** | `false` | boolean | Hides this property in the detail view.                                    |

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

### Property types

CASE works with it's own set of types that corresponds to different types of data often used in CRUD apps.

Each **PropType** corresponds to a set a different logic, display, format and options.

- [Text](#text)
- [Number](#number)
- [Currency](#currency)
- [Date](#date)
- [Textarea](#textarea)
- [Email](#email)
- [Boolean](#boolean)
- [Relation](#relation)
- [Password](#password)
- [File](#file)
- [Image](#image)
- [Enum](#enum)

#### <a name="text"></a>Text

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Text
  })
  name: string
```

#### <a name="number"></a>Number

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Number
  })
  iterations: number
```

#### <a name="currency"></a>Currency

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Currency,
    options: {
      currency: 'EUR'
    }
  })
  amount: number

```

| Option       | Default | Type   | Description                                                                                      |
| ------------ | ------- | ------ | ------------------------------------------------------------------------------------------------ |
| **currency** | _USD_   | string | [ISO 4217 currency code](https://en.wikipedia.org/wiki/ISO_4217#List_of_ISO_4217_currency_codes) |

#### <a name="date"></a>Date

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Date
  })
  date: Date
```

#### <a name="textarea"></a>Textarea

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Textarea
  })
  description: string
```

#### <a name="email"></a>Email

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Email
  })
  email: string
```

#### <a name="boolean"></a>Boolean

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Boolean
  })
  isActive: boolean
```

#### <a name="relation"></a>Relation

%% TODO: Code + input image + yield image

For the Relation type, you just need to pass the related entity class to the `options.entity` param like so:

```js
@Prop({
  label: 'Owner of the cat',
  type: PropType.Relation,
  options: {
    entity: Owner
  }
})
owner: Owner
```

> [!NOTE]
>
> - CASE Relations only work in the **Children => Parent** direction on many-to-one relationships
> - We use **cascade delete**: if you delete the _Owner_ record, it will also delete all his or her _Cat_ records

| Option     | Default | Type   | Description                    |
| ---------- | ------- | ------ | ------------------------------ |
| **entity** | -       | string | The Entity class of the parent |

#### <a name="password"></a>Password

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Password
  })
  password: string
```

> [!ATTENTION]
> You should never ever store a password on clear text.
> You can use the [@BeforeInsert hook](custom-logic.md#beforeinsert) to encrypt it

#### <a name="file"></a>File

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.File
  })
  certificate: string
```

| Option      | Default | Type   | Description                                                                                                                   |
| ----------- | ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **accepts** | `*`     | string | File types accepted as in [HTML attribute specification](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept) |

#### <a name="image"></a>Image

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Image
  })
  image: string
```

#### <a name="enum"></a>Enum

The Enum type allows users to choose for a set of constants that you define, like a multiple choice question. It takes a [TS String enum](https://www.typescriptlang.org/docs/handbook/enums.html#string-enums) as option.

%% TODO: Code + input image + yield image

```js
  import { ProjectStatus } from '../enums/project-status.enum.ts'

   @Prop({
    label: 'Status',
    type: PropType.Enum,
    options: {
      enum: ProjectStatus,
      display: 'progress-bar'
    }
  })
  breed: string
```

```js
// enums/project-status.enum.ts
export enum ProjectStatus {
  Pending = 'Pending'
  Signed = 'Signed',
  WorkInProgress = 'Work in progress'
  Inactive = 'Inactive',
  Archived = 'Archived',
}
```

| Option      | Default | Type                      | Description                                                                                                    |
| ----------- | ------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **enum**    | -       | enum                      | [String enum](https://www.typescriptlang.org/docs/handbook/enums.html#string-enums) with the available options |
| **display** | 'label' | 'label' \| 'progress-bar' | Enum props can be represented either by a label or by a progress bar if the enum follows a logic order.        |
