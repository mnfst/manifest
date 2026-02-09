<p align="center">
  <a href="https://manifest.build/#gh-light-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-transparent.svg" height="55px" alt="Manifest logo" title="Manifest - Tools for building agentic applications
" />
  </a>
  <a href="https://manifest.build/#gh-dark-mode-only">
    <img alt="manifest" src="https://manifest.build/assets/images/logo-light.svg" height="55px" alt="Manifest logo" title="Manifest - Tools for building agentic applications
" />
  </a>
</p>

> [!WARNING]
> Looking for the Manifest 1-file backend? See [this repo](https://github.com/mnfst/manifest-baas) instead.

---

<p align='center'>
<strong>Tools for building agentic applications — a visual flow editor and a production-ready UI component library for ChatGPT and MCP apps.</strong>
<br><br>
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm download" src="https://img.shields.io/npm/dt/manifest.svg"></a>
  <a href="https://www.npmjs.com/package/manifest" target="_blank"><img alt="npm" src="https://img.shields.io/npm/v/manifest"></a>
  <a href="https://www.codefactor.io/repository/github/mnfst/manifest" target="_blank"><img alt="CodeFactor Grade" src="https://img.shields.io/codefactor/grade/github/mnfst/manifest"></a>
  <a href="https://discord.com/invite/FepAked3W7" target="_blank"><img alt="Discord" src="https://img.shields.io/discord/1089907785178812499?label=discord"></a>
  <a href="https://opencollective.com/mnfst"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://codecov.io/gh/mnfst/manifest" ><img src="https://codecov.io/gh/mnfst/manifest/graph/badge.svg?token=9URG40MEWY"/></a>
  <a href="https://github.com/mnfst/manifest/blob/develop/LICENSE" target="_blank"><img alt="License MIT" src="https://img.shields.io/badge/licence-MIT-green"></a>
  <a href="https://www.jsdelivr.com/package/npm/manifest" target="_blank"><img alt="jsdelivr" src="https://data.jsdelivr.com/v1/package/npm/manifest/badge"></a>
<br>

## What's in this repo?

This monorepo contains two projects that work together to help you build agentic applications like ChatGPT plugins and MCP apps:

| Project | Description | Location |
|---------|-------------|----------|
| **[Manifest](#manifest---flow-editor)** | A visual flow editor for designing and running ChatGPT app backends | `packages/manifest/` |
| **[Manifest UI](#manifest-ui---component-library)** | A library of production-ready UI blocks for agentic interfaces, built on shadcn/ui | `packages/manifest-ui/` |

---

## Manifest - Flow Editor

A visual builder for creating ChatGPT app backends. Design server-side flows with a drag-and-drop node editor, connect to APIs, manage data, and deploy — all without writing boilerplate.

**Stack:** NestJS + React + SQLite + @xyflow/react

### Key features

- Visual flow editor for building app logic
- NestJS API backend with SQLite storage
- React frontend with real-time flow execution
- MCP server integration for ChatGPT connectivity

### Quick start

```bash
# Install dependencies
pnpm install

# Build shared packages (first time only)
pnpm --filter @manifest/shared build
pnpm --filter @manifest/nodes build

# Start the flow editor
pnpm run manifest:dev
```

The backend runs on `http://localhost:3847/api` and the frontend on `http://localhost:5176`.

---

## Manifest UI - Component Library

<p align="center">
  <a href="https://ui.manifest.build/">
    <img src="./assets/ui-homepage-screenshot.png" alt="Manifest UI Homepage" width="800">
  </a>
</p>

Production-ready UI blocks for agentic applications, built on top of [shadcn/ui](https://ui.shadcn.com). Each block is a self-contained, customizable component designed for conversational and chat-based interfaces.

**Stack:** Next.js 15 + React 19 + Tailwind CSS v4 + shadcn/ui

### Key features

- Blocks for messaging, blogging, payments, events, forms, and more
- Three display modes per block: `inline`, `pip` (picture-in-picture), and `fullscreen`
- Installable via the shadcn CLI
- Designed for MCP and ChatGPT app UIs

### Install a block

Make sure you have [shadcn/ui](https://ui.shadcn.com) set up in your project, then:

```bash
npx shadcn@latest add @manifest/table
```

Browse all available blocks at [ui.manifest.build](https://ui.manifest.build/).

---

## Repository structure

```
packages/
├── manifest/          # Flow editor application
│   ├── backend/       # NestJS API
│   ├── frontend/      # React SPA
│   ├── shared/        # Shared types and utilities
│   └── nodes/         # Node type definitions
└── manifest-ui/       # UI component registry (Next.js)
    ├── registry/      # Component source files
    ├── app/           # Documentation site (ui.manifest.build)
    └── public/r/      # Built registry JSON files
```

## Development

```bash
# Install dependencies
pnpm install

# Start everything
pnpm run dev

# Or start each project individually
pnpm run manifest:dev      # Flow editor only
pnpm run manifest-ui:dev   # UI registry only (port 3001)

# Build all packages
pnpm run build

# Lint all packages
pnpm run lint

# Run tests
pnpm run test
```

## Community & Resources

- [Chat with us](https://discord.gg/FepAked3W7) on our Discord
- [Report bugs](https://github.com/mnfst/manifest/issues) on GitHub issues
- [Suggest new features](https://github.com/mnfst/manifest/discussions/new?category=feature-request) on GitHub Discussions
- [Browse UI blocks](https://ui.manifest.build/) on the documentation site

## Want to help Manifest grow?

Here are a few ways you can help:

- Star the [Manifest repository](https://github.com/mnfst/manifest)
- Give us your feedback on [Discord](https://discord.gg/FepAked3W7)
- Sponsor Manifest through [GitHub](https://github.com/sponsors/mnfst)

## Contributors

We welcome contributions to Manifest. Please see our [Contributing Guidelines](./CONTRIBUTING.md) to get started and join the journey.

Thanks to our wonderful contributors!

<a href="https://github.com/mnfst/manifest/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mnfst/manifest" />
</a>

## Sponsors

Manifest is an MIT-licensed open-source project. If you find it useful and want to support its development, consider [becoming a sponsor](https://opencollective.com/mnfst).

<h3 align="center">Sponsors</h3>

[![Frame 1587](https://github.com/user-attachments/assets/5826d2d7-50d1-48e3-a32b-503569b90ebb)](https://opencollective.com/mnfst)

<h3 align="center">Backed by</h3>

![manifest-backers](https://github.com/user-attachments/assets/4ab3d33e-6e44-4368-b0d3-e2de988f28f5)

<h3 align="center">Partners</h3>
<div align="center" style="display:flex; width:100%; flex-wrap:wrap; align-items: center; justify-content: space-between">
<br>

<table>
  <tr>
    <td>
      <a href="https://kreezalid.com/" target="_blank">
        <img src="https://github.com/user-attachments/assets/7576273c-7468-4f98-afb5-00fb71af6ade" alt="kreezalid-partner-logo">
      </a>
    </td>
    <td>
      <a href="https://rise.work/" target="_blank">
        <img src="https://github.com/user-attachments/assets/a63fd6b5-995a-4585-a479-3b693b5ed053" alt="rise-work-partner-logo">
      </a>
    </td>
    <td>
      <a href="https://feature.sh/" target="_blank">
        <img src="https://github.com/user-attachments/assets/698a031d-dbd1-43a2-a137-224bd61e1bb9" alt="feature_logo">
      </a>
    </td>
    <td>
      <a href="https://www.lambdatest.com/" target="_blank">
        <img src="https://github.com/user-attachments/assets/8e1a3ec7-15ec-4f80-a1c6-924e9bb84501" alt="Black_Logo_LambdaTest">
      </a>
    </td>
  </tr>
</table>

This project is tested with BrowserStack

</div>
