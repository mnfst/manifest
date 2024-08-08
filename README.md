<br>
<p align="center">
  <a href="https://manifest.build/#gh-light-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-transparent.svg" height="55px" alt="Manifest logo" title="Manifest - Effortless backends" />
  </a>
  <a href="https://manifest.build/#gh-dark-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-light.svg" height="55px" alt="Manifest logo" title="Manifest - Effortless backends" />
  </a>
</p>

<p align='center'>
<strong>Effortless backends</strong>
<br><br>
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/manifest"></a>
  <a href="https://www.codefactor.io/repository/github/mnfst/manifest" target="_blank"><img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/mnfst/manifest"></a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank"><img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord"></a>
  <a href="https://opencollective.com/mnfst"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://github.com/mnfst/manifest/blob/develop/LICENSE" target="_blank"><img alt="License MIT" src="https://img.shields.io/badge/licence-MIT-green"></a>
  <br>
</p>

> [!NOTE]  
> Manifest is in the Proof of Concept phase (PoC). We are currently developing the first stable version. We would love to have your feedback ! If something do not work as expected, please [open a Github issue](https://github.com/mnfst/manifest/issues/new/choose). For any other thing, let us know trough [The Manifest Discord channel](https://discord.com/invite/FepAked3W7).

[Manifest](https://manifest.build) is the simplest **BaaS (Backend As A Service)** you will find.

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

## Key features

- ⚡ **Instant complete backend** with zero configuration
- 🧠 **Super-easy syntax** to build with ease
- 🛠️ **Plug and play** with your favorite frontend

## Getting started

Simply run this terminal command to add Manifest:

```bash
npx add-manifest
```

## Product roadmap
Our mission is to enable developers of all experience levels to create and share innovative solutions. As an **open source** product, we continuously improve Manifest through community collaboration. After our successful PoC, we are further developing the product with your feedback. Here are the upcoming features:

| Feature | Description | Release date | Status |
| --- | --- | --- | --- |
| **OpenAPI Doc** | Instant live documentation for your REST API | July 2024 | ✅ Available |
| **Auth** | Make any entity authenticatable and add rules for endpoints | August 2024 | 🚧 In progress |
| **Validation** | Custom validation for creating and updating items | Q3 2024 | 📝 To specify |
| **Many-to-many** | Advanced relationship management | Q4 2024 | 📝 To specify |
| **Hooks** | Trigger webhooks at specific events | Q4 2024 | 📝 To specify |
| **Media upload** | Allow file and image uploads with rules and resizing | Q4 2024 | 📝 To specify |

🆕 [Suggest a new feature for the next versions](https://github.com/mnfst/manifest/discussions/new?category=feature-request)


## Community & Resources

- [Docs](https://manifest.build/docs) - Get started with Manifest
- [Discord](https://discord.gg/FepAked3W7) - Come chat with the community
- [Github](https://github.com/mnfst/manifest/issues) - Report bugs and share ideas to improve the product.

## Contributors

Thanks to our first wonderful contributors !

<a href="https://github.com/mnfst/manifest/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mnfst/manifest" />
</a>
