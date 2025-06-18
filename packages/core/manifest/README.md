[Manifest](https://manifest.build) is a **backend** your AI can understand and your team can trust.

It allows you to create a backend with data, storage, logic and an admin panel. All is defined in **1 YAML file** that both humans and LLMs can understand and edit. ✨

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

## Installation

Create a new Manifest project by running:

```bash
yarn create manifest my-project
```

Using an AI coding editor or LLM-powered workflow? These commands configure your project to work seamlessly with it:

##### Cursor

```bash
yarn create manifest my-project --cursor
```

##### Copilot

```bash
yarn create manifest my-project --copilot
```

##### Windsurf

```bash
yarn create manifest my-project --windsurf
```

This sets up my-project with Manifest, tailored to your environment.

`npm create` also works if you don’t use Yarn.
