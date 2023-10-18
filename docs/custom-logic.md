# Custom logic

Each application has an unique business logic. Sooner or later, we will face the need to implement something specific.

As CASE follows a **data-first** approach, the custom logic can be hooked to **entity events**.

## Attach a script to an entity event

With CASE custom events, you can call any function you want. You are free to download your own packages (like an email provider for example) and call those functions to create, update or delete an item.

```js
// ./entities/cat.entity.ts
const axios = require('axios')

export class Cat extends CaseEntity {

  [...]

  @Prop()
  imageUrl: string

  @BeforeInsert()
  async beforeInsert() {
    // Call the cat api to get a cat image and store it as imageUrl.
    const res = await axios.get('https://api.thecatapi.com/v1/images/search')
    this.imageUrl = res.data[0].url
  }
}
```

## Available events

Events works with [TypeORM's entity listeners](https://typeorm.io/listeners-and-subscribers)

### @BeforeInsert

This hook will be called **before the entity is inserted to the DB**.

It is useful for situations where you have to generate a field based on other values or from an external service. Here are some examples:

- Call an API to get a value and store it
- Generate a PDF and store its path
- Generate a new field by mixing several fields
- Stamp the current date

```js
import { SHA3 } from 'crypto-js'
import * as moment from "moment";

export class User {
  @BeforeInsert()
  beforeInsert() {
    // Hashes the password before storing it.
    this.password = SHA3(this.password).toString()

    // Reference based on name and the first letters of a relation.
    this.reference = `P-${this._relations.customer.name substring(0, 3)}-${this.name.substring(0, 3)}`
  }
}
```

#### Available data

Some extra data is attached to the `this` object.

| Option          | Type   | Description                                                   |
| --------------- | ------ | ------------------------------------------------------------- |
| **\_relations** | object | Contains the relation objects of the entity you are creating. |

---

### @AfterInsert

You can define a method with any name in entity and mark it with @AfterInsert. CASE will call it after the entity is created.

```js
import { sendEmail } from '../scripts/send-email.ts

@Entity()
export class Post {
  @AfterInsert()
  notify() {
    sendEmail(`New post published :${this.title}`)
  }
}
```

### @BeforeUpdate

You can define a method with any name in the entity and mark it with @BeforeUpdate. CASE will call it before the entity is uploaded.

```js
@Entity()
export class Post {
  @BeforeUpdate()
  beforeUpdate() {
    this.updatedAt = new Date()
  }
}
```

### @AfterUpdate

You can define a method with any name in the entity and mark it with @AfterUpdate. CASE will call it after the entity is uploaded.

```js
@Entity()
export class Cat {
  @AfterUpdate()
  notify() {
    console.log(`The cat ${this.name} has been updated`)
  }
}
```

### @BeforeRemove

You can define a method with any name in the entity and mark it with @BeforeRemove. CASE will call it before the entity is removed.

```js
@Entity()
export class Post {
  @BeforeRemove()
  updateStatus() {
    this.status = 'removed'
  }
}
```

### @AfterRemove

You can define a method with any name in the entity and mark it with @AfterRemove. CASE will call it after the entity is removed.

```js
@Entity()
export class Cat {
  @AfterRemove()
  notify() {
    console.log(`The cat ${this.name} has been removed`)
  }
}
```
