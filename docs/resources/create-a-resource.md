# Create a resource

### What is a resource ?

A resource is an object often linked to a real world concept, like users, customers, videos, items, books etc.

### Technologies

Under the table, CASE is using [TypeORM Entities](https://typeorm.io/#/entities) for resource management. We recommend you to have a deep look about TypeORM Entities general concepts, relationships, and available columns types.

### Create a resource

On the root level, run the command below replacing `[name]` by the name of your resource.

```bash
case-app resource [name]
```

### Files generated

This command will instantly creates for you, in the _client_ and the _server_ directories, all the basics files and functions you need to manage that resource !

Take a deeper look on the files created with an example of a basic CRM with a list of **Customers**.

The command above will produce the following elements/features :

In **server** directory _(back-end)_ :

A new **Customer** folder is generated in `server/src/resources/`

![Zoom on resource example in server](../assets/images/structure/server-resource-example.png 'Zoom on resource example in server')

- An [Entity file](resources/entity-file.md) that corresponds to a new DB table that will be created automatically
- A module importing all the dependencies needed
- A REST controller with the CRUD endpoints working with their respective permissions
- A resource service withe the CRUD functions list, show, store, update, destroy

The schematics will also creates a seeder file and add the resource name into a list permissions.

![Zoom on seeder example in server](../assets/images/structure/server-seeder-example.png 'Zoom on seeder example in server')

- A [seeder file](resources/database-seeder.md) to create a bunch of dummy Customers for your development
- A set of [permissions](features/roles-and-permissions.md) related to the new resource: 'addCustomers', 'editCustomers'

In **client** directory _(front-end)_ :

![Zoom on client resource example](../assets/images/structure/client-resource-example.png 'Zoom on client resource example')

- A set a new views for the front-end : [List View](list/list.md), [Create and Edit View](create-edit/create-edit.md)
- A [resource definition file](resources/resource-definitions.md) to edit the Customer resource
- A new link in the sidebar to see the **Customer list**
- You may want to create a [Detail view](detail/detail.md)

> To follow that example, you may want to (in that order) :
>
> - Add new properties/columns to Customers to the `customer.entity.ts` file
> - Add example values to those properties in the `customer.seeder.ts` and then seed with `npm run seed` to see the result
> - Add [yields](list/yields.md) and [filters](list/filters.md) to add columns in the list view >in `customer.yields.ts`
> - Add [fields](create-edit/fields.md) to the create and edit view to allow users to create >and edit **Customers**
> - Edit the [roles](features/roles-and-permissions.md) to decide which user can or cannot edit >**Customers**
> - Find a nice icon for it on [Feather icons](https://feathericons.com/) and set it in `menu-items.ts`
> - And voilà ! You have now a manageable list of customers entirely manageable.
