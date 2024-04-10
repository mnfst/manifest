# Connect to your backend with the JS SDK

Use **CASE JS SDK** to fetch and manipulate your data from your JS client.

The SDK can be integrated in any JS frontend app and covers all CASE features. We recommend to use it but alternatively you can use the REST API through a standard Http service.

## Install

Install it via the terminal:

```bash
npm i @casejs/case-client
```

Use the SDK directly in your favorite frontend:

```js
import CaseClient from '@casejs/case-client'

// Initialize client in default port (localhost:4000).
const cs = new CaseClient()
```

## CRUD operations

TODO: We should provide the way to do it with the REST API too.

Perform all CRUD (Create Read Update Delete) operations with the SDK.

```js
// Get all cats.
const cats = await cs.from('cats').find()

// Get paginated cats.
const cats = await cs.from('cats').find({ page: 1, perPage: 10 })

// Typed.
const cats: Cat[] = await cs.from('cats').find<Cat>()

// Get a filtered the list of cats.
const cats = await cs
  .from('cats')
  .where('breed = siamese')
  .andWhere('active = true')
  .andWhere('birthDate > 2020-01-01')
  .find()

// Order cats.
const cats = await cs
  .from('cats')
  .orderBy('age', { desc: true })
  .find()

// Load relations (eager relations are loaded automatically).
const cats = await cs
  .from('cats')
  .with(['owner', 'owner.team', 'owner.team.manager'])
  .find()

// Filter by relations.
const cats = await cs
  .from('cats')
  .where(`owner in 1,2,3`)
  .andWhere(`store = ${storeId}`)
  .find()

// Create a cat.
const newCat = await cs.from('cats').create({
  name: 'Milo',
  age: 2
})

// Update a cat.
const updatedCat = await cs.from('cats').update(1, {
  name: 'updated name',
  age: 2
})

// Delete a cat.
await cs.from('cats').delete(1);

```

> [!NOTE]
>
> When filtering, you have access to the following operators: `=`, `>`, `>=`, `<`, `<=`, `like` and `in`.

## Store files and images

Use the SDK to store files and images. [Read more about CASE storage](storage.md)

```js
// Add a file related to cat entity (stored in /cats folder).
const fileUrl: string = await cs.from('cats').addFile(file)

// Store image and receive all size paths.
const avatars = await cs.from('cats').addImage('avatar', imageFile)
```

## Authenticate

You can perform authentication through several entities. [Read more about CASE auth](auth.md)

```js
// Login as a user with email and password.
await cs.login('users', 'user1@case.app', 'case')

// Sign up as a new author.
await cs.signup('authors', 'william@shakespeare.com', 'hamlet')

// Logout
await client.logout()
```

## Get started with your favorite front-end framework

See the following quick start guides to integrate CASE with popular front-end frameworks:

- [Get started with React](react.md)
- [Get started with Svelte](svelte.md)
- [Get started with Angular](angular.md)
- [Get started with Vue](vue.md)
