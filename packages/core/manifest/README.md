# Manifest

[Manifest](https://manifest.build) is the simplest **BaaS (Backend As A Service)** you will find.

It provides a complete backend to your client app without the hassle that comes with it. It actually fits into **a single YAML file** that generates a complete backend.

Here is an example of a complete Manifest app:

```yaml
# manifest/backend.yml
name: Healthcare application

entities:
  👩🏾‍⚕️ Doctor:
    properties:
      - fullName
      - avatar
      - { name: price, type: money, options: { currency: EUR } }
    belongsTo:
      - City

  🤒 Patient:
    properties:
      - fullName
      - { name: birthdate, type: date }
    belongsTo:
      - Doctor

  🌍 City:
    properties:
      - name
```

## Install

Simply run this command on your terminal from the root of your project:

```bash
npx add-manifest
```

## Test

```bash
npm run test
npm run test:e2e
```
