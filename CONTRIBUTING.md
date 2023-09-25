# CASE Contribution

First off all, thanks you very much for contribute and Happy Hacktoberfest ! 🎉

[CASE](https://case.app/) is an Open-Source CRUD app generator that helps developers to build CRUD web applications in 15 minutes by focusing on the data.

The following is a set of guidelines for contributing to CASE and its packages, which are hosted in the [CASE Organization](https://github.com/casejs) on GitHub. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

#### Table Of Contents

[Code of Conduct](#code-of-conduct)

[How Can I Contribute?](#how-can-i-contribute)

- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Your First Code Contribution](#your-first-code-contribution)
- [Pull Requests](#pull-requests)

[Serve CASE in contribution mode](#serve-case-in-contribution-mode)
[Publish your contribution](#publish-your-contribution)

## Code of Conduct

This project and everyone participating in it is governed by the [CASE Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [hello@case.app](mailto:hello@case.app).

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for CASE. Following these guidelines helps maintainers and the community understand your report :pencil:, reproduce the behavior :computer:, and find related reports :mag_right:.

When you are creating a bug report, please include as many details as possible. Fill out [the required template](.github/ISSUE_TEMPLATE/🐛-bug-report.md), the information it asks for helps us resolve issues faster.

> **Note:** If you find a **Closed** issue that seems like it is the same thing that you're experiencing, open a new issue and include a link to the original issue in the body of your new one.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for CASE, including completely new features and minor improvements to existing functionality. Following these guidelines helps maintainers and the community understand and find your suggestion :pencil: :mag_right:.

When you are creating an enhancement suggestion, please include as many details as possible. Start a new discussion by following [the template](.github/ISSUE_TEMPLATE/config.yml), including the steps that you imagine you would take if the feature you're requesting existed.

### Your First Code Contribution

Unsure where to begin contributing to CASE ? You can start by looking through these `good first issue` and `help wanted` issues:

### Pull Requests

The process described here has several goals:

- Maintain CASE's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible CASE
- Enable a sustainable system for CASE's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in [the template](.github/pull_request_template.md)
2. After you submit your pull request, verify that all [status checks](https://help.github.com/articles/about-status-checks/) are passing <details><summary>What if the status checks are failing ?</summary>If a status check is failing, and you believe that the failure is unrelated to your change, please leave a comment on the pull request explaining why you believe the failure is unrelated. A maintainer will re-run the status check for you. If we conclude that the failure was a false positive, then we will open an issue to track that problem with our status check suite.</details>

While the prerequisites above must be satisfied prior to having your pull request reviewed, the reviewer(s) may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted.

## Serve CASE in contribution mode

To run the client app on `http://localhost:4200`:

```bash
#From root of the repo.
cd packages/case/client
npm install
ng serve --configuration=contribution
```

```bash
# From packages/case/server
npm i
npm run start:dev

# Seed in dev mode
npm run seed:dev
```

You have to generate users credentials by seeding data to be able to auth with.

The folder `packages/case/server/src/_contribution-root` replicates the app root folder of the `CASE Starter` repo.

Using `npm link` you can link your `/node_modules/@casejs/case` to the `dist` folder in your project made with CASE starter.

```bash
#From this repo CASE.
cd server/dist

# May require sudo.
npm link
```

Then go to your CASE starter project and run :

```bash
#From your CASE starter project.
npm link @casejs/case
npm start
```

## Publish your contribution

Update the version number in `package.json` and run:

```bash
npm run build
cd server/dist
npm publish

# For beta versions
npm publish --tag beta
```
