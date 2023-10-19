<p align="center">
  <a href="https://www.case.app">
    <img alt="CASE" src="https://case.app/assets/images/logo-black.svg" height="40px" />
  </a>
</p>

<p align='center'>
<strong>The fastest way to develop CRUD apps</strong>
<br>
  <a target=_blank" href="https://demo2.case.app/auth/login?email=user1@case.app&password=case">Invoicing App Demo</a> •
  <a target=_blank" href="https://demo3.case.app/auth/login?email=user1@case.app&password=case">Project Management App Demo</a> •
  <a target=_blank" href="https://demo1.case.app/auth/login?email=user1@case.app&password=case">HR Dashboard Demo</a>
  <br><br>
  <a href="https://www.npmjs.com/package/@casejs/case" target="_blank">
    <img alt="npm" src="https://img.shields.io/npm/v/%40casejs%2Fcase">
  </a>
  <a href="https://www.codefactor.io/repository/github/casejs/case" target="_blank">
    <img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/casejs/case">
  </a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank">
    <img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord">
  </a>
  <a href="https://github.com/casejs/CASE/issues" target="_blank">
    <img alt="Hacktoberfest" src="https://img.shields.io/github/hacktoberfest/2023/casejs/case">
  </a>
  <a href="https://opencollective.com/casejs"  target="_blank">
    <img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us">
  </a>
  <a >
    <img alt="Licence MIT" src="https://img.shields.io/badge/licence-MIT-green">
  </a>
  <br>
</p>

<img  src="./docs/assets/images/cat-list.png" alt="CASE App" width="100%" style="border: 1px solid #dedede; margin-bottom: 2rem" />

## What is CASE ?

CASE is an **exceptionally fast app builder** for Typescript developers. ⚡

It is focused on **CRUD apps**: custom web apps like internal tools, ERPs, CRMs, admin panels and dashboards.

## "It's like an ORM on steroids"

CASE is based on [TypeORM](https://typeorm.io/) and **pushes further the concept of ORMs**. Not only you can describe your app entities to generate their database storage, you can **generate the app itself** from it:

- The list of the items
- A create / edit view to add and update items
- A detailed view of an item

## Entity files

The few lines below generate a whole app (see screenshot above):

```js
// cat.entity.ts

@Entity({
  nameSingular: 'cat',
  namePlural: 'cats',
  slug: 'cats'
})
export class Cat extends CaseEntity {
  @Prop({})
  name: string

  @Prop({
    type: PropType.Enum,
    options: {
      enum: Breed
    }
  })
  breed: Breed

  @Prop({
    type: PropType.Number
  })
  age: number

  @Prop({
    type: PropType.Date
    label: 'Arriving date'
  })
  arrivingDate: Date

  @Prop({
    type: PropType.Relation,
    options: {
      entity: Owner
    }
  })
  owner: Owner
}
```

## Advantages

- 🧠 **Focus on your data, not on the framework**. Data-oriented approach, no need to learn new stuff
- ⚡ **Ultra-fast development**. 1 command install, simple and effective codebase
- ✨ **Beautiful and clear UI**. Professional quality interface, designed with end-users

## Getting started

1. **Install CASE**

   ```sh
   npx create-case-app my-case-app
   ```

2. **Start the application**

   ```sh
   cd my-case-app
   npm start
   ```

   Voilà ! Your application is accessible at http://localhost:4000

## Community & Resources

- [Docs](https://docs.case.app/) - Learn CASE features
- [Discord](https://discord.gg/FepAked3W7) - Come chat with the CASE community
- [Dev.to](https://dev.to/casejs) - Stay tuned to CASE developments
- [Github](https://github.com/casejs/case/issues) - Report bugs and share ideas to improve the product.

## Contributors

Thanks to our first wonderful contributors !

<a href="https://github.com/casejs/CASE/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=casejs/CASE" />
</a>
