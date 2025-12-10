# Manifest JavaScript SDK

Official JavaScript SDK for interacting with the [Manifest](https://manifest.build) API.

- [Installation](#installation)
- [Usage](#usage)
  - [Common operations](#common-operations)
    - [Create an item](#create-an-item)
    - [Get a list](#get-a-list)
    - [Get a single item](#get-a-single-item)
    - [Update an item](#update-an-item)
    - [Patch an item](#patch-an-item)
    - [Delete an item](#delete-an-item)
    - [Load relations](#load-relations)
    - [Filter by relations](#filter-by-relations)
    - [Store relations](#store-relations)
    - [Update relations](#update-relations)
- [Full documentation](#full-documentation)
- [Contribute](#contribute)

📚 Full JS SDK documentation: [manifest.build/docs](https://manifest.build/docs/crud#using-the-javascript-sdk)

## Installation:

```bash
npm i @mnfst/sdk
```

## Usage

Use the SDK directly in your frontend:

```js
import Manifest from '@mnfst/sdk'

// Initialize client (default: http://localhost:1111, or pass a custom base URL)
const manifest = new Manifest('https://example.com')

// Perform CRUD operations...
const posts = await manifest.from('posts').find()
```

### Common operations

#### Create an item

```js
// Create a new item in the "pokemons" entity.
const newPokemon = await manifest.from('pokemons').create({
  name: 'Pikachu',
  type: 'electric',
  level: 3
})
```

#### Get a list

```js
// Get all users.
const users = await manifest.from('users').find()
```

#### Get a single item

```js
// Get cat with ID `2c4e6a8b-0d1f-4357-9ace-bdf024681357`.
const cat = await manifest
  .from('cats')
  .findOneById('2c4e6a8b-0d1f-4357-9ace-bdf024681357')
```

#### Update an item

```js
// Updates the Pokemon item with ID `a1b2c3d4-e5f6-4789-abcd-ef0123456789`.
const newPokemon = await manifest
  .from('pokemons')
  .update('a1b2c3d4-e5f6-4789-abcd-ef0123456789', {
    name: 'Raichu',
    type: 'electric',
    level: 8
  })
```

#### Patch an item

```js
// Patches the Pokemon item with ID `a1b2c3d4-e5f6-4789-abcd-ef0123456789`.
const newPokemon = await manifest
  .from('pokemons')
  .patch('a1b2c3d4-e5f6-4789-abcd-ef0123456789', {
    level: 5
  })
```

#### Delete an item

```js
// Delete the cat with ID `550e8400-e29b-41d4-a716-446655440000`.
const deletedCat = await manifest
  .from('cats')
  .delete('550e8400-e29b-41d4-a716-446655440000')
```

#### Load relations

```js
// Fetch entities with 2 relations.
const cities = await manifest.from('cities').with(['region', 'mayor']).find()

// Fetch nested relations.
const cities = await manifest
  .from('cities')
  .with(['region', 'region.country', 'region.country.planet'])
  .find()
```

#### Filter by relations

```js
// Get all cats that belong to owner with id 3f2504e0-4f89-11d3-9a0c-0305e82c3301.
const cats = await manifest
  .from('cats')
  .with(['owner'])
  .where('owner.id = 3f2504e0-4f89-11d3-9a0c-0305e82c3301')
  .find()

// Get all cats that have an owner with name "Jorge".
const cats = await manifest
  .from('cats')
  .with(['owner'])
  .where('owner.name = Jorge')
  .find()
```

#### Store relations

```js
// Store a new player with relations Team and Skill.
const newPlayer = await manifest.from('players').create({
  name: 'Mike',
  teamId: 'e4d5c6b7-a890-4123-9876-543210fedcba',
  skillIds: [
    '12345678-1234-5678-9abc-123456789012',
    '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
  ]
})
```

#### Update relations

```js
// Replaces the whole skill relations by the new skillIds array.
await manifest.from('players').update('e4d5c6b7-a890-4123-9876-543210fedcba', {
  name: 'Mike',
  teamId: 'e4d5c6b7-a890-4123-9876-543210fedcba',
  skillIds: [
    '12345678-1234-5678-9abc-123456789012',
    '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
  ]
})

// Updates the team without changing the skills or the name.
await manifest.from('players').patch('e4d5c6b7-a890-4123-9876-543210fedcba', {
  teamId: '9b2fff23-ec93-4b48-9322-bbd4b6b5b123'
})
```

Full documentation:

- CRUD: [manifest.build/docs/crud](https://manifest.build/docs/crud#using-the-javascript-sdk)
- Auth: [manifest.build/docs/authentication](https://manifest.build/docs/authentication#actions)
- File upload: [manifest.build/docs/upload](https://manifest.build/docs/upload#upload-a-file)
- Custom endpoints: [manifest.build/docs/endpoints](https://manifest.build/docs/endpoints#manipulate-data-with-the-backend-sdk)

## Contribute

To contribute to the Manifest JS SDK, please read first the general [contributing.md](https://github.com/mnfst/manifest/blob/master/CONTRIBUTING.md) file.

The best way to work with the SDK is using the `/sandbox` folder that hosts a minimalistic Angular app that imports the Manifest SDK. You can run the app with the following commands:

```bash
cd sandbox
npm install
npm run start
```
