# Validation

Validation is done with [class-validator](https://github.com/typestack/class-validator). To use it, install the package first:

```
npm install class-validator
```

And then you can add an array of validators to each property:

```js
import { IsEmail, IsNotEmpty, Min } from 'class-validator'

[...]

@Prop({
  type: PropType.Email,
  validators: [IsNotEmpty(), IsEmail()]
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
