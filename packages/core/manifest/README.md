<p align="center">
  <a href="https://manifest.build/#gh-light-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-transparent.svg" height="55px" alt="Manifest logo" title="Manifest - 1-file backend to ship fast" />
  </a>
</p>

<p align='center'>
<strong>1-file backend to ship fast</strong>
<br><br>  
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm download" src="https://img.shields.io/npm/dt/manifest.svg"></a>
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/manifest"></a>
  <a href="https://www.codefactor.io/repository/github/mnfst/manifest" target="_blank"><img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/mnfst/manifest"></a>
  <a href="https://github.com/mnfst/manifest/blob/master/.github/workflows/ci-cd.yml"><img  alt="CI-CD Status badge" src="https://github.com/mnfst/manifest/actions/workflows/ci-cd.yml/badge.svg"></a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank"><img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord"></a>
  <a href="https://codecov.io/gh/mnfst/manifest" ><img src="https://codecov.io/gh/mnfst/manifest/graph/badge.svg?token=9URG40MEWY"/></a>
  <a href="https://www.jsdelivr.com/package/npm/manifest" target="_blank"><img alt="jsdelivr" src="https://data.jsdelivr.com/v1/package/npm/manifest/badge"></a>
  <a href="https://github.com/mnfst/manifest/blob/develop/LICENSE" target="_blank"><img alt="License MIT" src="https://img.shields.io/badge/licence-MIT-green"></a>
<br>
</p>
Manifest is an open source, portable backend that bundles data, storage, logic, auth and even an admin panel to speed up your prototypes and MVPs.
<br>
<br>
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
# NPM
npx create-manifest@latest

# Yarn
yarn create manifest
```

Using an AI coding editor or LLM-powered workflow? These commands configure your project to work seamlessly with it:

```bash
yarn create manifest --cursor # Installs Cursor IDE rules
yarn create manifest --copilot # Installs Copilot rules
yarn create manifest --windsurf # Install Windsurf rules
```
