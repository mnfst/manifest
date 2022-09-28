# Actions

CASE actions are a quick way to implement actions on resources in lists or in detail views for example. As of today, 4 types of actions are available:

- Link: a simple link to another page with optional query params
- Patch: performs a HTTP Patch request to and endpoint
- Delete: deletes a item from the database after confirmation from the user
- OpenCreateEditModal: opens a custom create-edit form inside a modal.

## Link Action

The link action does exactly what it says, it is a link to another page, with eventual query params. An action of type _Link_ accepts a "link" object with a path and eventually a query params object.

```js
{
    type: ActionType.Link,
    link: {
      path: '/my-new-page',
      queryParams: {
        version: 'extended',
      }
    }
}
```

## Patch Action

The patch action will trigger an PATCH asynchronous HTTP request with the to the CASE API. A formData can be joined to the request. The HTTP response will trigger the display of a success [flash messages](features/flash-messages.md) in case of 200 status, or an error message if the response comes with an error status

```js
{
    type: ActionType.Patch,
    patch: {
        path: `payments/${id}/pay`,
        formData: paymentFormData
        successMessage: 'The payment has been saved.',
        errorMessage: 'Error: could not make the payment'
    }
}
```

## Delete Action

The second dropdown links uses an action with the _Delete_ type that deletes the item (after getting user's confirmation). This type of action makes use of a "delete" object with 2 mandatory properties: the item to delete and its definition, and one optional, the redirect path to go after the item has ben deleted.

```js
{
    label: 'Delete car',
    action: (car) => ({
    type: ActionType.Delete,
    delete: {
        itemToDelete: car,
        definition: carDefinition,
        navigateTo: '/'
    }
    })
},
```

## OpenCreateEditModal Action

Last but not least, the _OpenCreateEditModal_ action will open a modal dialog with a from that uses the same logic as the [create-edit view](create-edit/create-edit.md). You can pass the full form as on the edit page or add only the fields you would like.

In this example, we propose a quick way to change the name of a car without seeing the full create-edit form.

```js
 {
      label: 'Quick edit',
      action: (car) => ({
        type: ActionType.OpenCreateEditModal,
        openCreateEditModal: {
          title: `Change ${car.name} quickly`,
          definition: carDefinition,
          mode: 'edit',
          fields: [
            {
              label: 'name',
              property: 'name',
              className: 'is-3',
              inputType: InputType.Text,
              required: true
            }
          ]
        }
      })
    }
```

> [!ATTENTION]
> Be sure that your server-side validation (DTO and logic) accepts to change only part of the resource.

## Where can I use Actions ?

There is several places where you can hook your actions. Let's have a look!

### Dropdown links

Dropdown links uses trigger CASE Actions on click. In the **action** property of the link, you can pass a function that takes the item as a param and returns an **Action**. This way, you can create specific paths or logic related to the current item.

By default, [resource definitions](resources/resource-definitions.md) comes with 2 dropdown links by default. The first one redirects the user to the "edit page" of the concerned item. The second one prompts the user to delete the item.It is possible to add as many dropdown links as you want by adding elements to the _dropdownLinks_ array. If the array is empty, the menu will not appear to the user.

```js
dropdownLinks: [
  {
    label: "Edit role",
    permission: "editRoles",
    action: (role) => ({
      type: ActionType.Link,
      link: {
        path: `${roleDefinition.path}/${role.id}/edit`,
      },
    }),
  },
  {
    label: "Delete role",
    permission: "deleteRoles",
    action: (role) => ({
      type: ActionType.Delete,
      delete: {
        itemToDelete: role,
        definition: roleDefinition,
      },
    }),
  },
];
```

### Action buttons

Have a look about the [action buttons doc](list/action-buttons.md) to see it in action.

### Trigger action from the component

You can use the **actionService** to trigger an action directly from the component.

```js

constructor(
  private actionService: ActionService
) {}

[...]

this.actionService.triggerAction(myActionObject);
```

### Anywhere else (on click)

The **caseAction** directive can be added to any HTML element to trigger a custom action on click. You can define the action in the component logic and attach it to the element.

```html
<a class="button is-warning" [caseAction]="createTicketAction"
  >Create a new ticket (CASE Action)</a
>
```

```js
createTicketAction: Action = {
  type: ActionType.OpenCreateEditModal,
  openCreateEditModal: {
    title: "Create a ticket",
    helpText:
      "Creating a new ticket is easy ! Just fill up that form and we will contact you soon.",
    keyPoints: [
      {
        label: "Weight",
        value: "300kg",
      },
      {
        label: "Location",
        value: "Lisbon, Portugal",
      },
      {
        label: "Estimated value",
        value: "900 M€",
      },
    ],
    definition: ticketDefinition,
    mode: "create",
    fields: [
      {
        label: "ticket name",
        property: "name",
        className: "is-12",
        inputType: InputType.Text,
        required: true,
      },
      {
        label: "Is this a technical ticket ?",
        property: "isActive",
        initialValue: { value: false },
        className: "is-12",
        inputType: InputType.Checkbox,
      },
      {
        label: "Color",
        property: "color",
        className: "is-12",
        inputType: InputType.ColorPicker,
        required: true,
      },
    ],
  },
};
```
