# Manifest

[Manifest](https://manifest.build) is the simplest **Headless CMS** you will find.

It provides a complete backend to your client app without the hassle that comes with it. It actually fits into **a single YAML file**.

Here is an example of a complete Manifest app:

```yaml
name: Pokemon app 🐣

entities:
  Pokemon 🐉:
    properties:
      - name
      - {
          name: type,
          type: choice,
          options: { values: [Fire, Water, Grass, Electric] }
        }
      - { name: level, type: number }
    belongsTo:
      - Trainer

  Trainer 🧑‍🎤:
    properties:
      - name
      - { name: isChampion, type: boolean }
```

## Install

Simply run this command on your terminal from the root of your project:

```bash
npx add-manifest@latest
```

## Test

```bash
npm run test
npm run test:e2e
```
