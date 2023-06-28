# Custom logic

Each application describes a specific business logic. Thus sooner or later we should face the need to implement something very specific or to connect to other tools.

As CASE follows a **data-first** approach, the custom logic can be hooked to entity **events**:

## Attach a script to an entity event

With CASE custom events, you can call any function you want: you are free to download your own packages (like an email provider for example) and call execute those functions on create, update or delete an item.

```js
// ./entities/dog.entity.ts
export class Dog {
  @Prop()
  name: string

  @Prop()
  image: string

  // This function will trigger before creating a new Dog entity.
  @BeforeInsert()
  async beforeInsert() {
    // Make an HTTP Call to an image API to get a dog's picture
    const httpService = new HttpService(axios.default)
    const response = await httpService
      .get('https://dog.ceo/api/breeds/image/random')
      .toPromise()

    // Set this image as the dog image.
    this.image = response.data.message
  }
}
```

## Available events

Events works with [TypeORM's entity listeners](https://typeorm.io/listeners-and-subscribers)

### @AfterLoad

You can define a method with any name in entity and mark it with @AfterLoad and TypeORM will call it each time the entity is loaded using QueryBuilder or repository/manager find methods. Example:

```js
@Entity()
export class Post {
  @AfterLoad()
  updateCounters() {
    if (this.likesCount === undefined) this.likesCount = 0
  }
}
```

### @BeforeInsert

You can define a method with any name in entity and mark it with @BeforeInsert and TypeORM will call it before the entity is inserted using repository/manager save. Example:

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

You can define a method with any name in entity and mark it with @AfterInsert and TypeORM will call it after the entity is inserted using repository/manager save. Example:

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

You can define a method with any name in the entity and mark it with @BeforeUpdate and TypeORM will call it before an existing entity is updated using repository/manager save. Keep in mind, however, that this will occur only when information is changed in the model. If you run save without modifying anything from the model, @BeforeUpdate and @AfterUpdate will not run. Example:

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

You can define a method with any name in the entity and mark it with @AfterUpdate and TypeORM will call it after an existing entity is updated using repository/manager save. Example:

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

You can define a method with any name in the entity and mark it with @BeforeRemove and TypeORM will call it before a entity is removed using repository/manager remove. Example:

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

You can define a method with any name in the entity and mark it with @AfterRemove and TypeORM will call it after the entity is removed using repository/manager remove. Example:

```js
@Entity()
export class Post {
  @AfterRemove()
  updateStatus() {
    this.status = 'removed'
  }
}
```
