# Create a resource

CASE provides a fast and effective way to create your CRUD resources through the CLI.

## Introduction

With resources, CASE handles all the dirty work for you: typing, create/edit form, dummy values, pagination, etc.

### What is a resource ?

A resource is an object often linked to a real world concept, like users, customers, videos, items, books etc.

### Working with TypeORM

Under the table, CASE is using [TypeORM Entities](https://typeorm.io/#/entities) for resource management. We recommend you to have a deep look about TypeORM Entities general concepts, relationships, and available columns types.

## Create a resource

### CLI Command

On the root level, run the command below replacing `[name]` by the name of your resource (singular and camelCase, example: "user", "vendingMachine").

```
cs generate resourceName [name]
cs g res [name]
```

By default, the resource generated will have a `name` property.

Of course you can [add properties](resources/create-a-property.md) directly from this command to make it real quick:

```
cs generate resourceName product --props=name,price:currency,photo:image
```

> [!TIP]
> You can choose between several property types to adapt the logic and the UI. Have a look at the [create property section](resources/create-a-property.md) for the full list of available types.

### Files generated

This command will instantly creates for you, in the client and the server directories, all the basics files and functions you need to manage that resource !
