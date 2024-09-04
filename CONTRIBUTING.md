# Contributing to Manifest

Thank you for taking the time to contribute to Manifest! 🫶 🎉

Manifest aims to simplify backend development. We want to make backends simple and fun, allowing more people to create and share their own tools.

Manifest is an Open Source project hosted under the [Manifest organization on GitHub](https://github.com/mnfst)

## How can I contribute?

There are several ways to contribute to Manifest other than developing:

- 🐛 Report a bug using [GitHub issues](https://github.com/mnfst/manifest/issues/new?assignees=SebConejo&labels=bug&projects=&template=%F0%9F%90%9B-bug-report.md&title=)
- ✨ Suggest an enhancement using [GitHub discussions](https://github.com/mnfst/manifest/discussions/new?category=feature-request)
- 🪶 Correct or improve the doc in its [own repository](https://github.com/mnfst/docs/issues/new)

Otherwise, you also can offer your help by talking to a team member on our [Discord](https://discord.com/invite/FepAked3W7) 🤗.

## Packages and repositories

Before coding it is important to understand where the functionality you want to change is located.

Manifest is a set of several packages and [repositories](https://github.com/orgs/mnfst/repositories) built with open source software, using TypeScript as the main language.

| Name           | Description                                | Stack                      | Repo                                          | Package                                                    |
| -------------- | ------------------------------------------ | -------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Manifest       | Manifest core                              | NestJS / Express / TypeORM | [manifest](https://github.com/mnfst/manifest) | [manifest](https://www.npmjs.com/package/manifest)         |
| Manifest Admin | Official Admin Panel                       | Angular                    | [manifest](https://github.com/mnfst/manifest) | [@mnfst/admin](https://www.npmjs.com/package/@mnfst/admin) |
| Add Manifest   | NPX install script                         | OCLIF                      | [manifest](https://github.com/mnfst/manifest) | [add-manifest](https://www.npmjs.com/package/add-manifest) |
| JS SDK         | JavaScript SDK                             | TypeScript                 | [js-sdk](https://github.com/mnfst/js-sdk)     | [@mnfst/sdk](https://www.npmjs.com/package/@mnfst/sdk)     |
| Website        | Official website: https://manifest.build   | NextJS                     | [website](https://github.com/mnfst/website)   | -                                                          |
| Docs           | Documentation: https://manifest.build/docs | Markdown / Docusaurus      | [docs](https://github.com/mnfst/docs)         | -                                                          |

## Development workflow and guidelines

### Prerequisites

- You are familiar with Git (issues and PR)
- You have read the [docs](https://manifest.build/docs)
- You have looked at the [Code of Conduct](https://github.com/mnfst/manifest/blob/master/CODE_OF_CONDUCT.md) and [MIT License](https://github.com/mnfst/manifest/blob/master/LICENSE)

### Before you start

- Manifest is built on the concept of simplicity, contributions should go in that direction
- Each PR is linted with Prettier, and code quality is checked with CodeFactor
- Commit labels should be made using the [Conventional Commits convention](https://www.conventionalcommits.org/en/v1.0.0/)
- Please create only one thing per pull request as it is easier to validate and merge

### Workflow

1. Make sure that there is an [existing issue](https://github.com/mnfst/manifest/issues) for what you will be working on. If not, [create one](https://github.com/mnfst/manifest/issues/new) as this ensures that others can contribute with thoughts or suggest alternatives
2. When ready, fork the correct repository and branch out from the `develop` branch (or `master` for a hotfix)
3. Make your changes
4. Open a [Pull Request from your fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)
5. The core team will review it soon, ask for feedback, and eventually merge it

### Branches

There are 2 main branches:

- `master`: production version
- `develop`: development branch

When contributing, please follow this branch naming convention:

- `feature/x` branches add new features and the PR should be done to the `develop` branch
- `hotfix/x` branches create a hotfix and the PR should be done to the `master` branch

This rule applies to all repositories.

**Happy coding!** 🤗
