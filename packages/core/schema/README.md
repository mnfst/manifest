# CASE Schema

CASE Schema is the [JSON Schema](https://json-schema.org/) that ensure the format of CASE YAML files.

It has 2 main goals:

- Provide IDE assistance on YML files trough documentation, error highlighting and autocomplete
- Validate the consistency of the data on compilation

## Contribute

The `.vscode/settings.json` at the root of this repository is configured to match any YML file in `case-schema` subfolders (like `/examples`) with the `app-schema.json`. You can adapt the latter to see it live on those YML files.
