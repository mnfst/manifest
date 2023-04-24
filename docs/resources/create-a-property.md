# Create a property

CASE provides a fast and effective way to add properties to new or existing resources.

## Introduction

### What is a property ?

A property is a member of a [resource](resources/create-a-resource.md) that associates a key with a value. That value can be a string, a number, a boolean or even more.

Think about a **product** in a store, its property would be for example: a _name_, a _description_,a _photo_, and a _value_ in your currency.

### CASE properties

CASE properties are fast to create and adapted to the context because they are thought **end-to-end**:

- Database storage
- TypeScript types
- UI display in [lists](list/list.md) and [detail](detail/detail.md) pages
- Create/edit [input](elements/inputs.md)
- Dummy values for [seeds](resources/database-seeder)

## Create a property

### CLI Command

On the root level, run the command below replacing `[name]` by the name of your property in camelCase. You also need to pass the "resource" argument with the name of your resource (singular, camelCase).

```
cs generate property [name] --resourceName=[resourceName]
cs g prop [name] --resourceName=[resourceName]
```

If you [create a new resource](resources/create-a-resource.md)

## Property types

CASE properties have "types" that will help you to format their logic and display on the flow.

```
cs g prop [name]:[type] --resourceName=[resourceName]

cs g prop bio:text --resourceName=user
cs g prop photo:image --resourceName=product
cs g prop isValidated:boolean --resourceName=intervention
```

> [!ATTENTION]
> Those types are not TypeScript types. They correspond to the essence of the property **in its usage**, thinking about the final user. Example: an _amount_ in € and the _height_ of a product are both _numbers_ in the code, but for CASE the are different as the displays, inputs and seed values will be different.

### Available types

| Type         | Column yield | Input       | TS type | DB column | Seed function            | DTO Validator   |
| ------------ | ------------ | ----------- | ------- | --------- | ------------------------ | --------------- |
| **string**   | text         | text        | string  | varchar   | faker.random.word()      | @IsString()     |
| **number**   | text         | number      | number  | int       | faker.datatype.number()  | @IsNumber()     |
| **currency** | currency     | number      | number  | decimal   | faker.finance.amount()   | @IsNumber()     |
| **date**     | date         | datepicker  | string  | date      | faker.date.past()        | @IsDateString() |
| **text**     | text         | textarea    | string  | text      | faker.lorem.paragraphs() | @IsString()     |
| **email**    | text         | email       | string  | varchar   | faker.internet.email()   | @IsEmail()      |
| **boolean**  | check        | checkbox    | boolean | tinyint   | faker.datatype.boolean() | @IsBoolean()    |
| **file**     | download     | file        | string  | varchar   | case.dummyFile()         | @IsString()     |
| **image**    | image        | image       | string  | varchar   | case.dummyImage()        | @IsString()     |
| **color**    | color        | colorPicker | string  | varchar   | faker.internet.color()   | @IsString()     |
