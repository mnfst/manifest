# Roles and permissions

- Front-end
- Back-end

In CASE, a **role and permission system** is available out-of-the-box.

Each user belongs to a **Role** that contains a set of **Permissions**. For example `canLogin` is a permission that allows users of a certain role to log to the CASE app. You may want to create a Role for users that appear in the application but that cannot log (ex: former employees).

## Restrict front-end

### Restrict route

You can restrict a route only to users that have permission with the `PermissionGuard` :

```js
const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard, PermissionGuard],
    data: {
      permission: 'myCustomPermission'
    }
  }
]
```

### Custom display

It is possible to display a custom element element only for users that have a permission with the `HasPermissionDirecive` :

```html
<ul>
  <a *abcHasPermission="'browseProjects'"
    >Link for users that have "browseProjects" permission</a
  >
  <a *abcHasPermission="{ requireOr: ['browseProjects', 'browseCustomers'] }"
    >Link for users that have "browseProjects" OR "browseCustomer" permission</a
  >
  <a *abcHasPermission="{ requireAnd: ['browseProjects', 'browseCustomers'] }"
    >Link for users that have "browseProjects" AND "browseCustomer"
    permission</a
  >
  <a
    *abcHasPermission="{ requireAnd: ['browseOwnProjects'], hideIf: ['browseProjects'] }"
    >Link for users that have "browseOwnProjects" and that DO NOT HAVE
    "browseProjects" permission</a
  >
</ul>
```

## Restrict back-end

To restrict an endpoint to users that have a permission, simply use the `Permission` decorator below the endpoint method decorator in the controller :

```js
  @Post()
  @Permission('addUsers') // Users that do not have "addUsers" permission will receive a 403 error.
  async store(
    @Body()
    userDto: CreateUserDto
  ): Promise<User> {
    return this.userService.store(userDto)
  }
```

## Add roles and permissions

By default there is 2 roles in CASE : **Admin** and **TeamMember**. You can tweak them to change their rights. It is import to consider that **roles and permissions are dynamic resources** and are not part of the source code and they are not by default in the versioning system. You can go browse your application and go to `/roles` to see the list of current roles and add some if you want.

When you [create a resource using CASE CLI](resources/create-a-resource.md), CASE automatically creates a set of permissions for you :

```
- browseResource (list view access)
- readResource (detail view access)
- editResource (edit view access)
- createResource (create view access)
- deleteResource (delete view access)
```

In addition to that. The same permissions for **own resources** will be created (_browseOwnResource_, _readOwnResource_...). In some cases, it can be useful to restrict a role to its own resources (ex: a project manager that can modify only his or her projects).

If you want to create a permission and include it in the default data for development, you can add it the the permission content seeder `/server/database/seeders/content/permissions.content.seeder`.

```js
export const allPermissions: string[] = [].concat(
  ...resourceNames.map((resourceName) => {
    return permissionTypes.map(
      (permissionType) =>
        permissionType +
        resourceName.charAt(0).toUpperCase() +
        resourceName.slice(1)
    )
  }),
  // * Extra permissions.
  'canLogin',
  'browseAnalytics',
  'myCustomPermission'
)
```

and then seed to take effect (resets all data, only for development) :

```bash
npm run seed
```
