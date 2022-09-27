# Filters

- Front-end
- Back-end

On list views, you can chose from a large set of filters to help you filter the lists you are viewing.

Those filters can be set form the `filters` property the the component class of your resource (usually `$Resource$ListComponent`) :

```js
  // Generates a date range filter for "issue date" selection and a checkbox filter for "late invoices only".
  filters: Filter[] = [
    {
      label: 'Late invoices only',
      property; 'lateInvoicesOnly',
      inputType: InputType.Checkbox,
      className: 'is-3 no-label p-x-0-mobile',
    },
    {
      label: `Issue date`,
      properties: {
        dateFrom: 'dateFrom',
        dateTo: 'dateTo',
      },
      inputType: InputType.DateRange,
      className: 'is-12',
    },
  ]
```

This will add query parameters to your `GET /$resources$` request. You have then to make sure in the back-end that those query parameters are considered and return a filtered value.

Check out the [full list of inputs](elements/inputs.md) to find the appropriate input for your filter.

## Readonly filters

By default, users can change filters to set them to their value. They also can be set in readonly mode to prevent changing the forced value. Check out the [list of filters than can accept the readonly mode](elements/inputs.md)

```js
  filters: Filter[] = [
  {
      label: 'Project status',
      inputType: InputType.Select,
      property: 'status',
      readonly: true, // Readonly mode: The user cannot change the value.
      selectOptions: [
        {
          label: 'Pending',
          value: 1
        },
        {
          label: 'In progress',
          value: 2
        },
        {
          label: 'Finished',
          value: 3
        }
      ],
      initialValue: 1
    }
  ]
```

## Persistent filters

Persistent filters enable to automatically retain your filter settings. This feature can be enabled on your project globally with the `enablePersistentFilters` property.

```js
    // client/src/app/app.module.ts
    CaseModule.forRoot({
      baseUrl: environment.baseUrl,
      [...],
      enablePersistentFilters: true
    })
```
