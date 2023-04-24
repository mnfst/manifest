# CASE Documentation 👋

Welcome to the CASE Developer documentation !

CASE is a framework that allows you to **create web apps, ERPs and dashboards easily**.

![CASE App](./assets/images/case-projects.png ':size=60%')

## Main features

- Instant **CRUD system** for your entities ⚡
- Out-of-the-box **authentication** and **role-based access control (RBAC)** 🔐
- Nice and clear **UI** ✨

## Why CASE ?

CASE's purpose is to **allow developers to create very quickly and easily digital tools** that help organizations and companies to work effectively.

Think of it as a **resource management dashboard** where developers can quickly add CRUD features and business logic. CASE was first design to meet SMEs needs but it is very effective in many environments.

## Architecture

CASE is a monorepo composed of 2 components: a client app and a server app.

The full application works in [TypeScript](https://www.typescriptlang.org/) as the client app is based on [Angular](https://angular.io/) and the server app in [Nest](https://nestjs.com/) (a TypeScript Express JS framework heavily inspired by Angular). A knowledge of those frameworks is recommended but not mandatory.

If you would like to to see CASE powered by a different stack, let us know !

## CASE features available out-of-the-box

Those features can make you save a lot of time as they come along with any CASE install:

- A [Command Line Interface](resources/create-a-resource.md) to generate resources files in one command
- 20 [CASE inputs](elements/inputs.md) ready for your forms: text, email, date picker, rich text, color picker...
- 13 [CASE yields](list/yields.md) to custom the display of your lists: date, currency, icon, progress bar...
- 7 [CASE filters](list/filters.md) for your lists: checkbox, single and multi select dropdown, date range...
- File generation based on your data: PDF, Excel and Word
- [Send emails](features/send-emails.md)
- [Advanced search](features/search.md)
- CRON tasks and notifications
- File upload and image upload
- [Filters](list/filters.md) for your lists

> [!Tip]
> Ready to go ?
>
> Follow our [quick start guide](getting-started/quick-start-guide.md) to create your CASE project in minutes !
