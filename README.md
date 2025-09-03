@constellation-network/node-pilot
=================

A new CLI generated with oclif


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@constellation-network/node-pilot.svg)](https://npmjs.org/package/@constellation-network/node-pilot)
[![Downloads/week](https://img.shields.io/npm/dw/@constellation-network/node-pilot.svg)](https://npmjs.org/package/@constellation-network/node-pilot)


<!-- toc -->
* [Usage](#usage)
* [The TLDR Version](#the-tldr-version)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @constellation-network/node-pilot
$ cpilot COMMAND
running command...
$ cpilot (--version|-v)
@constellation-network/node-pilot/0.0.7 darwin-arm64 node-v22.15.0
$ cpilot --help [COMMAND]
USAGE
  $ cpilot COMMAND
...
```
<!-- usagestop -->
# The TL;DR Version
#### Simply run cpilot with no commands.
```sh-session
$ cpilot
```
If no command is entered, node-pilot will automatically perform a series of checks to identify the necessary configurations or actions required to bring your validator node online and connect it to the cluster.

# Commands
<!-- commands -->
* [`cpilot config`](#cpilot-config)
* [`cpilot config get [NAME]`](#cpilot-config-get-name)
* [`cpilot config set NAME VALUE`](#cpilot-config-set-name-value)
* [`cpilot help [COMMAND]`](#cpilot-help-command)
* [`cpilot info`](#cpilot-info)
* [`cpilot logs [LAYER]`](#cpilot-logs-layer)
* [`cpilot restart`](#cpilot-restart)
* [`cpilot shutdown`](#cpilot-shutdown)
* [`cpilot status`](#cpilot-status)

## `cpilot config`

Update configuration settings

```
USAGE
  $ cpilot config

DESCRIPTION
  Update configuration settings

EXAMPLES
  $ cpilot config
```

_See code: [src/commands/config.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/config.ts)_

## `cpilot config get [NAME]`

Show all configuration settings or a specific one

```
USAGE
  $ cpilot config get [NAME]

ARGUMENTS
  NAME  configuration to get

DESCRIPTION
  Show all configuration settings or a specific one

EXAMPLES
  $ cpilot config get

  $ cpilot config get CL_EXTERNAL_IP

  $ cpilot config get gl0:CL_PUBLIC_HTTP_PORT
```

_See code: [src/commands/config/get.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/config/get.ts)_

## `cpilot config set NAME VALUE`

Set a configuration setting

```
USAGE
  $ cpilot config set NAME VALUE

ARGUMENTS
  NAME   configuration name
  VALUE  the value to set to the configuration

DESCRIPTION
  Set a configuration setting

EXAMPLES
  $ cpilot config set CL_EXTERNAL_IP 127.0.0.1

  $ cpilot config set gl0:CL_PUBLIC_HTTP_PORT 9000
```

_See code: [src/commands/config/set.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/config/set.ts)_

## `cpilot help [COMMAND]`

Display help for cpilot.

```
USAGE
  $ cpilot help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for cpilot.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.32/src/commands/help.ts)_

## `cpilot info`

Display general info about the validator node

```
USAGE
  $ cpilot info

DESCRIPTION
  Display general info about the validator node

EXAMPLES
  $ cpilot info
```

_See code: [src/commands/info.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/info.ts)_

## `cpilot logs [LAYER]`

view validator node runtime logs

```
USAGE
  $ cpilot logs [LAYER] [-f]

ARGUMENTS
  LAYER  network layer to view. e.g. gl0

FLAGS
  -f, --follow  continuously wait for additional data to be appended

DESCRIPTION
  view validator node runtime logs

EXAMPLES
  $ cpilot logs
```

_See code: [src/commands/logs.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/logs.ts)_

## `cpilot restart`

A full shutdown of the validator node, then restart

```
USAGE
  $ cpilot restart

DESCRIPTION
  A full shutdown of the validator node, then restart

EXAMPLES
  $ cpilot restart
```

_See code: [src/commands/restart.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/restart.ts)_

## `cpilot shutdown`

A full shutdown of the validator node

```
USAGE
  $ cpilot shutdown

DESCRIPTION
  A full shutdown of the validator node

EXAMPLES
  $ cpilot shutdown
```

_See code: [src/commands/shutdown.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/shutdown.ts)_

## `cpilot status`

Display node status and configuration settings

```
USAGE
  $ cpilot status

DESCRIPTION
  Display node status and configuration settings
```

_See code: [src/commands/status.ts](https://github.com/Constellation-Labs/node-pilot/blob/v0.0.7/src/commands/status.ts)_
<!-- commandsstop -->
