# Property types

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

A simple text field.

```js
  @Prop({
    type: PropType.Text
  })
  name: string
```

<div class="is-hidden-tablet">
  <div class="is-flex is-justify-content-center is-align-items-center">
    <div class="field">
      <h5>Generated field</h5>
    </div>
    <div class="yield">
      <h5>Generated yield</h5>
    </div>
  </div>
  <img src="../assets/images/prop-text.png">
</div>

<div class="is-hidden-desktop"> 
    <h5>Generated field</h5>
    <img src="../assets/images/field-text.png">
    <h5>Generated yield</h5>
    <img src="../assets/images/yield-text.png">
</div>

#### <a name="number"></a>Number

A numerical value.

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Number
  })
  memberCount: number
```

#### <a name="currency"></a>Currency

Choose from any currency.

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

Basic date field.

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Date
  })
  date: Date
```

#### <a name="textarea"></a>Textarea

Textarea field for medium size texts.

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Textarea
  })
  description: string
```

#### <a name="email"></a>Email

Classic email input.

%% TODO: Code + input image + yield image

```js
  @Prop({
    type: PropType.Email
  })
  email: string
```

#### <a name="boolean"></a>Boolean

For any field with a "true or false" value.

%% TODO: Code + input image + yield image

```js
  @Prop({
    label: 'Is the user active ?'
    type: PropType.Boolean,
  })
  isActive: boolean
```

#### <a name="relation"></a>Relation

A relationship with another entity.

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

Hidden password field.

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

File upload input.

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

Same as file but for images.

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
