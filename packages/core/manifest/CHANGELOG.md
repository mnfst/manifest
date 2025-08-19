# manifest

## 4.17.6

### Patch Changes

- 5a5ab4e: added S3 folder prefix

## 4.17.5

### Patch Changes

- b8d889d: validate that no duplicate declaration of belongsToMany relationship

## 4.17.4

### Patch Changes

- c62d097: fix signup does not store non authenticable props

## 4.17.3

### Patch Changes

- f7a5e57: fix new version available displayed twice

## 4.17.2

### Patch Changes

- 4d12ad8: feat: display version and upgrade message depending on dev environment

## 4.17.1

### Patch Changes

- be965bd: fix error on image uploads on nested entities

## 4.17.0

### Minor Changes

- 0050a83: added groups (nested entities)

## 4.16.3

### Patch Changes

- 1afa7eb: accept png image format, thanks @myurtsev

## 4.16.2

### Patch Changes

- e71dcb9: fix wrong npm command

## 4.16.1

### Patch Changes

- d15fb95: update readme commands

## 4.16.0

### Minor Changes

- cc8a1c3: added rate limiting

## 4.15.0

### Minor Changes

- c29bc12: added admin panel input help texts, thanks @ronaldaug

## 4.14.0

### Minor Changes

- 2193b6b: generate openapi spec and types from backend

## 4.13.0

### Minor Changes

- 426c11b: added ownership based access, thanks @tvanh3

## 4.12.4

### Patch Changes

- d3f1aac: fixed 400 error on signup admins, thanks @chriskacerguis

## 4.12.3

### Patch Changes

- c74b428: fixed path error on windows with handler files, thanks @akvgergo

## 4.12.2

### Patch Changes

- c806577: Update installation instructions in README and keywords more appropriate to ai code editors

## 4.12.1

### Patch Changes

- 67dd5a6: Fixed In operator on filterQuery

## 4.12.0

### Minor Changes

- beb4317: Replaced incremental int IDs by UUIDs, thanks @jerryjappinen

## 4.11.11

### Patch Changes

- da62deb: Fixed PATCH request password update issue and return token on JS SDK

## 4.11.10

### Patch Changes

- 111efd4: added --mountedDrive arg to manifest command to prevent watch issues on integrations

## 4.11.9

### Patch Changes

- 73aeba2: prevent nodemon to reload when db change

## 4.11.8

### Patch Changes

- 2e79a19: display app name on admin login and register page

## 4.11.7

### Patch Changes

- 7fcb7af: fix error on watching changes

## 4.11.6

### Patch Changes

- d481786: fixed empty admin panel if user not loaded yet

## 4.11.5

### Patch Changes

- 6bf51d2: fix manifest:seed cmd failing on stackblitz

## 4.11.4

### Patch Changes

- 960f1fc: Removed public access by default for CRUD operations, thanks @lexicality

## 4.11.3

### Patch Changes

- b4e5adc: Prevent error when adding id property, Thanks @ryuujo1573
- 7f40b79: fixed namePlural causes errors, thanks @MatFluor

## 4.11.2

### Patch Changes

- 9f2bbcb: prevent using uncontrolled data in path

## 4.11.1

### Patch Changes

- a100be4: chore: optimize image and PDF assets
- 3b693dc: refactor scss files replacing import by use and removing unused files

## 4.11.0

### Minor Changes

- cc8fef6: added MySQL / MariaDB connection, Thanks @stefanolab

## 4.10.1

### Patch Changes

- 745c8fb: replaced bcrypt by bcryptjs

## 4.10.0

### Minor Changes

- f24defa: added default values on create item, thanks @ajpiano

## 4.9.2

### Patch Changes

- 002d110: replaced SHA3 encryption by bcrypt with salt, thanks @prokofitch @BennySama94

## 4.9.1

### Patch Changes

- 9f6157b: fix cannot filter by id, thanks @mindreframer

## 4.9.0

### Minor Changes

- a44651a: added middlewares

## 4.8.2

### Patch Changes

- 88b7edb: improved admin panel for production usage, thanks @larbikhounti

## 4.8.1

### Patch Changes

- 70bb1a0: fix PostgreSQL SSL connections not working with local certificate

## 4.8.0

### Minor Changes

- 0d3feb2: added S3 storage @Blaise1030

## 4.7.1

### Patch Changes

- 2ad5da3: added PNPM support

## 4.7.0

### Minor Changes

- de762de: added Postgres compatibility, asked by @ToxesFoxes, @dotku

## 4.6.2

### Patch Changes

- e05bd4d: added dynamic path for db and public folder

## 4.6.1

### Patch Changes

- 880265f: Add route to 404 page if item not found in detail page or edit page

## 4.6.0

### Minor Changes

- 7f3c127: Added custom endpoints

## 4.5.5

### Patch Changes

- dcc1115: Refactor: reduce font-icon size removing unused icons on the admin panel

## 4.5.4

### Patch Changes

- 990ae12: Simplofoed and optimized SCSS files, including login styles, spinners and navbar. Remove unused images and scss

## 4.5.3

### Patch Changes

- e48e221: reduced bundle size, thanks @nicholas-codecov

## 4.5.2

### Patch Changes

- bf5fd5d: fixed timestamp type validation fail for future dates. Thanks @levinside

## 4.5.1

### Patch Changes

- 6f85624: fixed admin files duplicate in bundle

## 4.5.0

### Minor Changes

- 41e699e: Added webhooks

## 4.4.0

### Minor Changes

- 2dc8679: Added PATCH requests for item update

## 4.3.3

### Patch Changes

- 01aed5b: fixed admins cannot be managed in admin panel

## 4.3.2

### Patch Changes

- 3190b9a: Fix seed failing if entity name is a reserved word on SQLite

## 4.3.1

### Patch Changes

- 609add0: Remove unused code on pagination

## 4.3.0

### Minor Changes

- 9aa6502: Fix build not including admin

## 4.2.0

### Minor Changes

- daf41a9: Added support for external YAML file
