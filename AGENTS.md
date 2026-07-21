# Manifest Agent Guidelines

## Domain Terminology

Manifest terminology is directional:

- A **Manifest Request** is one logical request from an agent to Manifest and lives in `requests`.
- A **Provider Attempt** is one request from Manifest to an AI provider and lives in `agent_messages`.

[`docs/glossary.md`](docs/glossary.md) is the canonical contract for statuses, ordering, recovery, database mapping, and counting rules. Do not duplicate those definitions in agent guides.
