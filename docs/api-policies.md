# API Policies

<div class="beta-feature">⚠️ This feature is in beta</div>

API policies define who can and who cannot interact with your entities.

Each [entity](entities.md) has **4 rules** where you can apply a **policy**:

- **create**: access to the creation of a new item
- **read**: access to view the list of items and a single item
- **update**: access to the modification of an existing item
- **delete**: access to delete an existing item

## Add API policies to an entity

The following items of this entity are visible for everyone, but only **logged in users** (as any authenticable entity) can create a new one, and only **admins** can update and delete items.

```js
// ./entities/cat.entity.ts

@Entity({
  apiPolicies: {
    create: Policies.loggedInOnly,
    read: Policies.noRestriction,
    update: Policies.adminOnly,
    delete: Policies.adminOnly
  }
})
export class Cat extends BaseEntity {
  @Prop()
  name: string
}
```

By default, the `noRestriction` policy applies to all 4 rules.

## Policies

A policy is an **access control** verification function that grants or deny the permission for an operation based on attribute.As of today there is 3 available policies:

- **noRestriction**: everyone can access, even not logged in
- **loggedInOnly**: all logged in users can access (users of any authenticable entity)
- **adminOnly**: only logged in admins can access

> [!NOTE]
>
> There will soon be more built-in policies added to that short list and the ability to create your own policies following the **ABAC approach**.
