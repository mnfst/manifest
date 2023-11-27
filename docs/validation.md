# Validation

Validation is done with [class-validator](https://github.com/typestack/class-validator). To use it, install the package first:

```
npm install class-validator
```

And then you can add an array of validators to each property. The validators will apply on **create** and on **update** actions.

```js
import { Contains, IsEmail, IsNotEmpty, Min } from 'class-validator'

[...]

@Prop({
  type: PropType.Email,
  validators: [IsEmail(), Contains('@case.app')]
})
email: string

@Prop({
  type: PropType.Currency,
  validators: [IsNotEmpty(), Min(1000)],
  options: {
    currency: 'EUR'
  }
})
wealth: number

```

> [!Tip]
>
> You can also [create your own validators](https://github.com/typestack/class-validator#custom-validation-classes).
