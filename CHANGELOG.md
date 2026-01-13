# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Community growth report and governance documentation
- GitHub Discussions for community Q&A
- FUNDING.yml for sponsorship visibility

## [2.0.3] - 2025-01-13

### Added
- Event ticket flow components (ticket-select, tier-select, event-checkout, event-confirmation)
- Events category with EventCard, EventList, and EventDetail components
- Category field to components in registry.json
- Contact form initialValues prop for pre-filled fields

### Fixed
- Memory leaks causing browser slowdown in manifest-ui
- Event-list component using absolute URL for event-card dependency
- Duplicate payment-success component entry in registry
- Create-manifest starter folder duplication during publish
- Block variant header layout alignment
- Post list fullwidth mode pagination

### Changed
- Removed id property from all component interfaces (breaking change)

## [2.0.0] - 2025-01-XX

### Added
- Complete rewrite as UI component registry for ChatGPT/MCP apps
- Production-ready UI blocks built on shadcn/ui
- Component categories: blogging, events, form, list, messaging, payment, miscellaneous
- Nested workspace structure with manifest-ui and starter packages
- Create-manifest CLI for scaffolding new projects

### Changed
- Migrated from 1-file backend to UI component library
- New monorepo structure with pnpm workspaces

---

**Note:** For the 1-file backend version, see [manifest-baas repository](https://github.com/mnfst/manifest-baas).
