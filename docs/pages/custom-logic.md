# Custom logic

Each application describes an unique business logic. Sooner or later we should face the need to implement something specific.

As CASE follows a **data-first** approach, the custom logic can be hooked to **entity events**:

## Attach a script to an entity event

With CASE custom events, you can call any function you want: you are free to download your own packages (like an email provider for example) and call execute those functions on create, update or delete an item.

```js
// ./entities/cat.entity.ts
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

You can define a method with any name in entity and mark it with @BeforeInsert and CASE will call it before the entity is created.

```js
@Entity()
export class Post {
  @BeforeInsert()
  updateDates() {
    this.createdDate = new Date()
  }
}
```

### @AfterInsert

You can define a method with any name in entity and mark it with @AfterInsert and TypeORM will call it after the entity is created.

```js
@Entity()
export class Post {
  @AfterInsert()
  resetCounters() {
    this.counters = 0
  }
}
```

### @BeforeUpdate

You can define a method with any name in the entity and mark it with @BeforeUpdate and CASE will call it before the entity is uploaded.

```js
@Entity()
export class Post {
  @BeforeUpdate()
  updateDates() {
    this.updatedDate = new Date()
  }
}
```

### @AfterUpdate

You can define a method with any name in the entity and mark it with @AfterUpdate and CASE will call it after the entity is uploaded.

```js
@Entity()
export class Post {
  @AfterUpdate()
  updateCounters() {
    this.counter = 0
  }
}
```

### @BeforeRemove

You can define a method with any name in the entity and mark it with @BeforeRemove and CASE will call it before the entity is removed.

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

You can define a method with any name in the entity and mark it with @AfterRemove and CASE will call it after the entity is removed.

```js
@Entity()
export class Post {
  @AfterRemove()
  updateStatus() {
    this.status = 'removed'
  }
}
```
