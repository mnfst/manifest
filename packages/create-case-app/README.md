oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g create-case-app
$ create-case-app COMMAND
running command...
$ create-case-app (--version)
create-case-app/0.0.0 linux-x64 node-v18.17.0
$ create-case-app --help [COMMAND]
USAGE
  $ create-case-app COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`create-case-app hello PERSON`](#create-case-app-hello-person)
* [`create-case-app hello world`](#create-case-app-hello-world)
* [`create-case-app help [COMMANDS]`](#create-case-app-help-commands)
* [`create-case-app plugins`](#create-case-app-plugins)
* [`create-case-app plugins:install PLUGIN...`](#create-case-app-pluginsinstall-plugin)
* [`create-case-app plugins:inspect PLUGIN...`](#create-case-app-pluginsinspect-plugin)
* [`create-case-app plugins:install PLUGIN...`](#create-case-app-pluginsinstall-plugin-1)
* [`create-case-app plugins:link PLUGIN`](#create-case-app-pluginslink-plugin)
* [`create-case-app plugins:uninstall PLUGIN...`](#create-case-app-pluginsuninstall-plugin)
* [`create-case-app plugins reset`](#create-case-app-plugins-reset)
* [`create-case-app plugins:uninstall PLUGIN...`](#create-case-app-pluginsuninstall-plugin-1)
* [`create-case-app plugins:uninstall PLUGIN...`](#create-case-app-pluginsuninstall-plugin-2)
* [`create-case-app plugins update`](#create-case-app-plugins-update)

## `create-case-app hello PERSON`

Say hello

```
USAGE
  $ create-case-app hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/brunobuddy/create-case-app/blob/v0.0.0/src/commands/hello/index.ts)_

## `create-case-app hello world`

Say hello world

```
USAGE
  $ create-case-app hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ create-case-app hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/brunobuddy/create-case-app/blob/v0.0.0/src/commands/hello/world.ts)_

## `create-case-app help [COMMANDS]`

Display help for create-case-app.

```
USAGE
  $ create-case-app help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for create-case-app.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.12/src/commands/help.ts)_

## `create-case-app plugins`

List installed plugins.

```
USAGE
  $ create-case-app plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ create-case-app plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/index.ts)_

## `create-case-app plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ create-case-app plugins add plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ create-case-app plugins add

EXAMPLES
  $ create-case-app plugins add myplugin 

  $ create-case-app plugins add https://github.com/someuser/someplugin

  $ create-case-app plugins add someuser/someplugin
```

## `create-case-app plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ create-case-app plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ create-case-app plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/inspect.ts)_

## `create-case-app plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ create-case-app plugins install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -s, --silent   Silences yarn output.
  -v, --verbose  Show verbose yarn output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into the CLI.
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.


ALIASES
  $ create-case-app plugins add

EXAMPLES
  $ create-case-app plugins install myplugin 

  $ create-case-app plugins install https://github.com/someuser/someplugin

  $ create-case-app plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/install.ts)_

## `create-case-app plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ create-case-app plugins link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ create-case-app plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/link.ts)_

## `create-case-app plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ create-case-app plugins remove plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ create-case-app plugins unlink
  $ create-case-app plugins remove

EXAMPLES
  $ create-case-app plugins remove myplugin
```

## `create-case-app plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ create-case-app plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/reset.ts)_

## `create-case-app plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ create-case-app plugins uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ create-case-app plugins unlink
  $ create-case-app plugins remove

EXAMPLES
  $ create-case-app plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/uninstall.ts)_

## `create-case-app plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ create-case-app plugins unlink plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ create-case-app plugins unlink
  $ create-case-app plugins remove

EXAMPLES
  $ create-case-app plugins unlink myplugin
```

## `create-case-app plugins update`

Update installed plugins.

```
USAGE
  $ create-case-app plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v4.2.2/src/commands/plugins/update.ts)_
<!-- commandsstop -->
