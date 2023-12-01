# Hooks

Hooks are the ideal place for your custom logic. You can trigger your own actions when the data is manipulated like sending an email when a post is submitted for example.

## How it works

To hook your function into an entity event, simply use one of our [provided decorators](hooks.md?id=entity-events). This setup ensures that your function activates precisely when the event occurs. Inside your function, you'll have access to the relevant item through the `this` keyword, allowing you to easily reference properties like `this.id`, `this.name`, and more.

And don't forget: you're not just limited to what's inside CASE. Feel free to download your preferred packages and reach out to external APIs, just as you would in a typical NodeJS environment.

```js
// /entities/cat.entity.ts
const axios = require('axios')

export class Cat extends BaseEntity {

  [...]

  @Prop()
  imageUrl: string

  @BeforeInsert()
  async beforeInsert() {
    // Get an image from thecatapi.com and store it as the cat image.
    const res = await axios.get('https://api.thecatapi.com/v1/images/search')
    this.image = res.data[0].url
  }
}
```

## Using CASE SDK to fetch or manipulate your data in hooks

Do you know that the [CASE JS SDK](connect.md) on the server ?

If you need to query or create other items on an event you can import the SDK in your CASE backend:

```bash
npm i @casejs/case-client
```

Then you can use it as you do in your client:

```js
// /entities/cat.entity.ts
import CaseClient from '@casejs/case-client'

export class Cat extends BaseEntity {

  [...]

  @AfterInsert()
  async afterInsert() {
    // Init CASE SDK.
    const cs = new CaseClient()

    // Get all users.
    const users: User[] = await cs.from('users').find<User>()

    // Notify each user with your custom function.
    users.forEach((user: User) => {
      sendEmail({
        to: user.email,
        subject: `A new cat has been created: ${this.name}`,
      })
    })
  }
}
```

## Entity events

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

@BeforeInsert()
beforeInsert() {
  // Hashes the password before storing it.
  this.password = SHA3(this.password).toString()

  // Reference based on name and the first letters of a relation.
  this.reference = `P-${this._relations.customer.name substring(0, 3)}-${this.name.substring(0, 3)}`
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

@AfterInsert()
notify() {
  sendEmail(`New post published :${this.title}`)
}
```

### @BeforeUpdate

You can define a method with any name in the entity and mark it with @BeforeUpdate. CASE will call it before the entity is uploaded.

```js
@BeforeUpdate()
beforeUpdate() {
  this.updatedAt = new Date()
}
```

### @AfterUpdate

You can define a method with any name in the entity and mark it with @AfterUpdate. CASE will call it after the entity is uploaded.

```js
@AfterUpdate()
notify() {
  console.log(`The cat ${this.name} has been updated`)
}
```

### @BeforeRemove

You can define a method with any name in the entity and mark it with @BeforeRemove. CASE will call it before the entity is removed.

```js
updateStatus() {
  this.status = 'removed'
}
```

### @AfterRemove

You can define a method with any name in the entity and mark it with @AfterRemove. CASE will call it after the entity is removed.

```js
@AfterRemove()
notify() {
  console.log(`The cat ${this.name} has been removed`)
}
```
