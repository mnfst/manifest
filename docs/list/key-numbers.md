# Key numbers

- Front-end feature
- Back-end feature

![Key numbers](../assets/images/list/key-numbers.png)

Key numbers are small slots used to display overall information about the resources we are consulting. They are located on the top right of the table.

Is is a quick and easy way to display sums or totals of the listed resources.

The `keyNumbers` property is part of the [Resource definition](resources/resource-definitions.md) file.

For each key number, the client will make another HTTP request _using the sames params of the list query_ with a new `calculate` queryParam with the value indicated in the `keyNumbers` array :

```js
keyNumbers: [
  {
    label: "Total invoices without taxes",
    className: "is-success",
    type: YieldType.Currency,
    extraParams: {
      calculate: "totalInvoicesWithoutTaxes",
    },
  },
  {
    label: "Total invoices with taxes",
    className: "is-link",
    type: YieldType.Currency,
    extraParams: {
      calculate: "totalInvoicesWithTaxes",
    },
  },
];
```
