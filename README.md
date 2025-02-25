<br>

<p align="center">
  <a href="https://manifest.build/#gh-light-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-transparent.svg" height="55px" alt="Manifest logo" title="Manifest - The 1-file micro-backend" />
  </a>
  <a href="https://manifest.build/#gh-dark-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-light.svg" height="55px" alt="Manifest logo" title="Manifest - The 1-file micro-backend" />
  </a>
</p>

<p align='center'>
<strong>The 1-file micro-backend</strong>
<br><br>  
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/dt/manifest.svg"></a>
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/manifest"></a>
  <a href="https://www.codefactor.io/repository/github/mnfst/manifest" target="_blank"><img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/mnfst/manifest"></a>
  <a href="https://github.com/mnfst/manifest/blob/master/.github/workflows/ci-cd.yml"><img  alt="CI-CD Status badge" src="https://github.com/mnfst/manifest/actions/workflows/ci-cd.yml/badge.svg"></a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank"><img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord"></a>
  <a href="https://opencollective.com/mnfst"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://codecov.io/gh/mnfst/manifest" ><img src="https://codecov.io/gh/mnfst/manifest/graph/badge.svg?token=9URG40MEWY"/></a>
  <a href="https://github.com/mnfst/manifest/blob/develop/LICENSE" target="_blank"><img alt="License MIT" src="https://img.shields.io/badge/licence-MIT-green"></a>
<br>

</p>

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

<a href="https://manifest.new" target="_blank"><img alt="Open in StackBlitz" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"></a>

## Why Manifest?

80% of websites and apps only use the most basic backend features. Using over-engineered solutions lead to unnecessary costs and complexity.

Manifest keeps it simple, delivering only the essential backend features and smoothly integrating in your project like any other file in your codebase.

## Use cases

Manifest fits great in those type of projects:

- 🛠️ Rapid prototyping: POCs and MVPs
- 🧩 Micro services: notification, payment, logging, file services...
- 🏭 CRUD-heavy apps: mobile apps, directories, PIMs, E-shops
- 🌐 Headless CMS: dynamic corporate websites, portfolios, blogs...

## Key features

<a href="https://manifest.build/docs/authentication" target="_blank">Auth</a> | <a href="https://manifest.build/docs/validation" target="_blank">Validation</a> | <a href="https://manifest.build/docs/upload#upload-a-file" target="_blank">Storage</a> | <a href="https://manifest.build/docs/upload#upload-an-image" target="_blank">Image resizing</a> | <a href="https://manifest.build/docs/install" target="_blank">Admin panel</a> | <a href="https://manifest.build/docs/endpoints" target="_blank">Dynamic endpoints</a> |
<a href="https://manifest.build/docs/rest-api" target="_blank">REST API</a> | <a href="https://manifest.build/docs/javascript-sdk" target="_blank">JS SDK</a> | <a href="https://manifest.build/docs/webhooks" target="_blank">Webhooks</a>

## Getting started

Simply run this terminal command to add Manifest locally:

```bash
npx add-manifest@latest
```

> [!NOTE]  
> Manifest is currently in BETA, use it at your own risk. It is stable enough to power small projects, prototypes and MVPs but we do not recommend to use it on critical platforms.

## Community & Resources

- [Read the Docs](https://manifest.build/docs) to get started
- [Chat with us](https://discord.gg/FepAked3W7) on our Discord
- [Report bugs](https://github.com/mnfst/manifest/issues) on Github issues
- [Suggest new features](https://github.com/mnfst/manifest/discussions/new?category=feature-request) on Github Discussions

## Want to help Manifest grow? 💗

Here is a few small things you can do:

- Star the Manifest repository (this one)
- Give us your feedback on [Discord](https://discord.gg/FepAked3W7)
- Sponsor Manifest through [OpenCollective](https://opencollective.com/mnfst)

## Contributors

We welcome contributions to Manifest, Please see our [Contributing Guidelines](./CONTRIBUTING.md) to get started and join the journey.

Thanks to our wonderful contributors!

<a href="https://github.com/mnfst/manifest/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mnfst/manifest" />
</a>

## Sponsors

Manifest is an MIT-licensed open-source project. If you find it useful and want to support its development, consider [becoming a sponsor](https://opencollective.com/mnfst).

<h3 align="center">Backers</h3>

![manifest-backers](https://github.com/user-attachments/assets/4ab3d33e-6e44-4368-b0d3-e2de988f28f5)

<h3 align="center">Partners</h3>
<div align="center" style="display:flex; width:100%; flex-wrap:wrap; align-items: center; justify-content: space-between">
<br>

[![kreezalid-partner-logo](https://github.com/user-attachments/assets/7576273c-7468-4f98-afb5-00fb71af6ade)](https://kreezalid.com/)

[![rise-work-parneter-logo](https://github.com/user-attachments/assets/e89e2b0e-91eb-4a24-8c3f-39e0a77e8285)](https://rise.work/)

[![feature_logo 1](https://github.com/user-attachments/assets/da69e2cb-10e1-4cb5-8809-ea51f490d2ad)](https://feature.sh/)


</div>
