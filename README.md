<br>
<p align="center">
  <a href="https://www.case.app">
    <img alt="manifest" src="https://manifest.build/logo-transparent.svg" height="55px" />
  </a>
</p>

<p align='center'>
<strong>Effortless backends</strong>
<br><br>
  <a href="https://www.npmjs.com/package/manifest" target="_blank">
    <img alt="npm" src="https://img.shields.io/npm/v/manifest">
  </a>
  <a href="https://www.codefactor.io/repository/github/casejs/case" target="_blank">
    <img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/casejs/case">
  </a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank">
    <img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord">
  </a>
  <a href="https://opencollective.com/casejs"  target="_blank">
    <img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us">
  </a>
  <a href=https://github.com/casejs/CASE/blob/develop/LICENSE" target="_blank">
    <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-green">
  </a>
  <br>
</p>

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
- [Github](https://github.com/casejs/case/issues) - Report bugs and share ideas to improve the product.

## Contributors

Thanks to our first wonderful contributors !

<a href="https://github.com/casejs/CASE/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=casejs/CASE" />
</a>
