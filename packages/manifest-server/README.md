# @mnfst/server

Embedded [Manifest](https://manifest.build) observability server for local mode. Runs the full Manifest dashboard backed by SQLite — no PostgreSQL, no Docker, no external services.

[![npm version](https://img.shields.io/npm/v/@mnfst/server?color=cb3837&label=npm)](https://www.npmjs.com/package/@mnfst/server)
[![license](https://img.shields.io/github/license/mnfst/manifest?color=blue)](LICENSE)

## What is this?

This package wraps the Manifest backend (NestJS + TypeORM) into a single `start()` function that boots an embedded server with SQLite. It's used by the [Manifest OpenClaw plugin](https://www.npmjs.com/package/manifest) to run a local observability dashboard for AI agents.

## Usage

```typescript
import { start } from '@mnfst/server';

const app = await start({
  port: 2099,       // default: 2099
  host: '127.0.0.1', // default: 127.0.0.1
  dbPath: './my.db',  // default: ~/.openclaw/manifest/manifest.db
});
```

Once started, the dashboard is available at `http://127.0.0.1:2099` and OTLP endpoints accept traces, metrics, and logs.

## Features

- **Zero-config** — starts with sensible defaults, no env files needed
- **SQLite** — all data stored in a single file, no database server required
- **Full dashboard** — same SolidJS frontend as the cloud version
- **OTLP ingestion** — standard OpenTelemetry HTTP endpoints (JSON + Protobuf)
- **Auto-login** — no authentication required in local mode

## API

### `start(options?): Promise<NestApplication>`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `2099` | Server port |
| `host` | `string` | `"127.0.0.1"` | Bind address |
| `dbPath` | `string` | `~/.openclaw/manifest/manifest.db` | SQLite database path |

## Related

- [manifest](https://www.npmjs.com/package/manifest) — OpenClaw plugin that uses this server
- [Manifest](https://github.com/mnfst/manifest) — Full source code and documentation

## License

[MIT](LICENSE)
