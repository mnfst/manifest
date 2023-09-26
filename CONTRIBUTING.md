# CASE Contribution

Thanks you very much for contributing and Happy Hacktoberfest ! 🎉 🧙‍♂️

[CASE](https://case.app/) is an Open-Source CRUD app generator that helps developers to build CRUD web applications in 15 minutes by focusing only on the data.

[CASE](https://case.app/) is made with love, lo-fi and headaches using [Angular](https://github.com/angular/angular.js), [Nest.js](https://github.com/nestjs/nest) & [TypeORM](https://github.com/typeorm/typeorm).

#### Table Of Contents

- [Pre-requisites](#pre-requisites)
- [Making code contributions](#code-contributions)
- [Making pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Code of Conduct](#code-of-conduct)

### Pre-requisites

[CASE](https://case.app/) is made with [Angular](https://github.com/angular/angular.js), the angular/cli is a pre-requisite.

```bash
npm install -g @angular/cli
```

You may also meet [TypeORM](https://github.com/typeorm/typeorm) concept's like entities, relations or repositories. You can familiarize yourself with [their docs here](https://typeorm.io/).

Also [CASE](https://case.app/) use the concepts of guards, module and controller from [Nest.js](https://github.com/nestjs/nest). You can have a better understanding of those concepts by checking [their docs here](https://docs.nestjs.com/).

**_You don't need to be an expert in those dependencies to contribute - your great ideas, logic, good will & common sense are always welcome to the project ! 🧠🌈_**

### Code contributions

If you are looking for an easy way to help, start by the issues labelled [good first issue](https://github.com/casejs/CASE/labels/good%20first%20issue) or [documentation](https://github.com/casejs/CASE/labels/documentation) ! 💪

##### Serve CASE in Contribution mode

Open a first terminal :

```bash
# From root of the repo.
cd packages/case/client
npm install
ng serve --configuration=contribution
```

The client is now running on `http://localhost:4200` ! 🌸

Open a second terminal simultaneously :

```bash
# From root of the repo.
cd packages/case/server
npm install
npm run start:dev

# You have to generate users credentials by seeding data to be able to auth with.
# Seed in dev mode.
npm run seed:dev
```

The server is now running on contributor mode ! 🌼

⚠️ Times to times you may need to restart your server to see the modifications you brings to the client.

> 💡 To simulate the `app` root folder of a new CASE repo, you can use the folder `packages/case/server/src/_contribution-root`.

### Pull Requests

The process described here has several goals:

- Maintain our quality
- Fix problems that are important to users
- Engage the community in working toward the best possible version of [CASE](https://case.app/)
- Enable a sustainable system for our maintainers to review contributions

Please follow these steps to have your contribution considered by our maintainers:

1. Follow all instructions in [the template](.github/pull_request_template.md)
2. After you submit your pull request, verify that all [status checks](https://help.github.com/articles/about-status-checks/) are passing <details><summary>What if the status checks are failing ?</summary>If a status check is failing, and you believe that the failure is unrelated to your change, please leave a comment on the pull request explaining why you believe the failure is unrelated. A maintainer will re-run the status check for you. If we conclude that the failure was a false positive, then we will open an issue to track that problem with our status check suite.</details>

While the prerequisites above must be satisfied prior to having your pull request reviewed, the reviewer(s) may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted.

> 🧙‍♂️ During Hacktoberfest don't forget to add `hacktoberfest` label to your PR. If it's accepted we will merge it with the `hacktoberfest-accepted` label.
> If we judge it is, we will not hesitate to labelled your PR as `spammy` which can make you disqualified of the Hacktoberfest. 😱

### Reporting Bugs

When you are creating a bug report, please include as many details as possible.

Fill out [the required template](.github/ISSUE_TEMPLATE/🐛-bug-report.md), the information it asks for helps us resolve issues faster.

> 💡 If you find a **Closed** issue that seems to be the same bug that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

### Suggesting Enhancements

When you are creating an enhancement suggestion, please include as many details as possible.

Start a new discussion by following [the template](.github/ISSUE_TEMPLATE/config.yml), including the steps that you imagine you would take if the feature you're requesting existed.

## Code of Conduct

[CASE](https://case.app/) and everyone contributing in it is governed by the [CASE Code of Conduct](CODE_OF_CONDUCT.md). By contributing, you are expected to uphold this code. Please report unacceptable behavior to [hello@case.app](mailto:hello@case.app).
