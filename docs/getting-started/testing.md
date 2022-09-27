# Testing

CASE uses [JEST](https://jestjs.io) for automated tests on the server side. You can run them by typing:

```bash
npm run test
```

## Testing CRUD resources

When you [create a resource](resources/create-a-resource.md), CASE will create 2 testing files in your server folder: one for the _Controller_ and another one for the _Service_. You are free to add your own tests in those files and your own files in the created `/tests` folder.
