# Auth

CASE comes with a built-in authentication system based on [JSON Web Tokens](https://jwt.io/).

## Admins

Admins are the only users that have access to the **Admin panel**. They have full access to the app **without any restriction**. By default, one admin is generated with the email `admin@case.app` and the password `case`. You can manually create more in the Admin panel.

You can also log as an admin with the [JS SDK](connect.md):

```js
import CaseClient from '@casejs/case-client'

const cs = new Client()

// Login as admin@case.app with password "case".
await cs.login('admins', 'admin@case.app', 'case')
```

## Authenticable entities

<div class="beta-feature">⚠️ This feature is in beta</div>

You can create other **authenticable entities** to login with. It can be users, authors, sellers or anything specific to your app.

To create a new authenticable entity, [create a standard entity](entities.md) and replace `BaseEntity` by `AuthenticableEntity`. An authenticable entity has **by default** an `email` and a `password` so you do not need to add it.

The following code creates a simple user entity:

```js
// ./entities/user.entity.ts

import { AuthenticableEntity, Entity } from '@casejs/case'

@Entity()
export class User extends AuthenticableEntity {}
```

Once created, you can then **sign up** and **login** with the [JS SDK](connect.md)

```js
import CaseClient from '@casejs/case-client'

const cs = new Client()

// Sign up as a new user.
await cs.signup('users', 'user1@case.app', 'case')

// Login.
await cs.login('users', 'user1@case.app', 'case')

// Logout.
await cs.logout()
```
