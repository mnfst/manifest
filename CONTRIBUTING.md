# Contributing to Manifest

Thank you for taking the time to contribute to Manifest! 🫶 🎉

Manifest aims to simplify backend development. We want to make backends simple and fun, allowing more people to create and share their own tools.

Manifest is an Open Source project hosted under the [Manifest organization on GitHub](https://github.com/mnfst)

## How can I contribute?

There are several ways to contribute to Manifest other than developing:

- 🐛 Report a bug using [GitHub issues](https://github.com/mnfst/manifest/issues/new?assignees=SebConejo&labels=bug&projects=&template=%F0%9F%90%9B-bug-report.md&title=)
- ✨ Suggest an enhancement using [GitHub discussions](https://github.com/mnfst/manifest/discussions/new?category=feature-request)
- 🪶 Correct or improve the doc in its [own repository](https://github.com/mnfst/docs/issues/new)
- 🔧 To work on issues, first check out our [Good First Issue](https://github.com/mnfst/manifest/labels/good%20first%20issue).

Otherwise, you also can offer your help by talking to a team member on our [Discord](https://discord.com/invite/FepAked3W7) 🤗.

## Packages and repositories

Before coding it is important to understand where the functionality you want to change is located.

Manifest is a set of several packages and [repositories](https://github.com/orgs/mnfst/repositories) built with open source software, using TypeScript as the main language.

| Name            | Description                                                     | Stack            | Repo                                          | Package                                                          |
| --------------- | --------------------------------------------------------------- | ---------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Manifest        | Manifest core                                                   | NestJS / TypeORM | [manifest](https://github.com/mnfst/manifest) | [manifest](https://www.npmjs.com/package/manifest)               |
| Manifest Admin  | Official Admin Panel                                            | Angular          | [manifest](https://github.com/mnfst/manifest) | -                                                                |
| Create Manifest | NPX install script                                              | OCLIF            | [manifest](https://github.com/mnfst/manifest) | [create-manifest](https://www.npmjs.com/package/create-manifest) |
| JSON Schema     | Manifest JSON SCHEMA: https://schema.manifest.build/schema.json | JSON             | [manifest](https://github.com/mnfst/manifest) | -                                                                |
| Types           | Manifest Types library                                          | TypeScript       | [manifest](https://github.com/mnfst/manifest) | -                                                                |
| Helpers         | Manifest Helpers library                                        | TypeScript       | [manifest](https://github.com/mnfst/manifest) | -                                                                |
| JS SDK          | Client JavaScript SDK                                           | TypeScript       | [manifest](https://github.com/mnfst/manifest) | [@mnfst/sdk](https://www.npmjs.com/package/@mnfst/sdk)           |
| Website         | Official website: https://manifest.build                        | NextJS           | [website](https://github.com/mnfst/website)   | -                                                                |
| Docs            | Documentation: https://manifest.build/docs                      | Docusaurus       | [docs](https://github.com/mnfst/docs)         | -                                                                |

## Development workflow and guidelines

### Prerequisites

- You are familiar with Git (issues and PR) and **Github flow**
- You have read the [docs](https://manifest.build/docs)
- You have looked at the [Code of Conduct](https://github.com/mnfst/manifest/blob/master/CODE_OF_CONDUCT.md) and [MIT License](https://github.com/mnfst/manifest/blob/master/LICENSE)

### Before you start

- Manifest is built on the concept of simplicity, contributions should go in that direction
- Each PR code quality is checked with [CodeFactor](https://www.codefactor.io/) for syntax, [CodeCov](https://codecov.com/) for testing coverage and [Changesets](https://github.com/changesets/changesets) for version numbers and changelogs
- Commit labels should be made using the [Conventional Commits convention](https://www.conventionalcommits.org/en/v1.0.0/)
- Please create only one thing per pull request as it is easier to validate and merge

### Workflow

1. Make sure that there is an [existing issue](https://github.com/mnfst/manifest/issues) for what you will be working on. If not, [create one](https://github.com/mnfst/manifest/issues/new) as this ensures that others can contribute with thoughts or suggest alternatives
2. When ready, **create a branch** for the issue your are fixing from the Github issue "Development" paragraph in the sidebar
3. Make your changes
4. Run `npx changeset` and add the [changeset](https://github.com/changesets/changesets) for your work
5. Open a [Pull Request from your fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) from your branch to the `master` branch
6. The core team will review it soon, ask for feedback, and eventually merge it

### Getting started

From the root of the repository, run:

```
pnpm install

pnpm run dev
```

Then you can play around with your `manifest.yml` file at `packages/core/manifest/manifest/manifest.yml` and see the results:

- Admin panel `http://localhost:4200`
- API Doc `http://localhost:3000/api`

Once the app is running, don't forget to seed to generate an _admin_ user and dummy data:

```
pnpm run seed
```

### Test

```
pnpm run test
```

**Happy coding!** 🤗
