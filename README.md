<br>
<p align="center">
  <a href="https://manifest.build">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-transparent.svg" height="55px" />
  </a>
</p>

<p align='center'>
<strong>Effortless backends</strong>
<br><br>
  <a href="https://www.npmjs.com/package/manifest" target="_blank">
    <img alt="npm" src="https://img.shields.io/npm/v/manifest">
  </a>
  <a href="https://www.codefactor.io/repository/github/mnfst/manifest" target="_blank">
    <img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/ManifestOfficial/manifest">
  </a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank">
    <img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord">
  </a>
  <a href="https://opencollective.com/mnfst"  target="_blank">
    <img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us">
  </a>
  <a href="https://github.com/mnfst/manifest/blob/develop/LICENSE" target="_blank">
    <img alt="License MIT" src="https://img.shields.io/badge/licence-MIT-green">
  </a>
  <br>
</p>

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

## Community & Resources

- [Docs](https://manifest.build/docs) - Get started with Manifest
- [Discord](https://discord.gg/FepAked3W7) - Come chat with the community
- [Github](https://github.com/ManifestOfficial/manifest/issues) - Report bugs and share ideas to improve the product.

## Contributors

Thanks to our first wonderful contributors !

<a href="https://github.com/ManifestOfficial/manifest/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ManifestOfficial/manifest" />
</a>
