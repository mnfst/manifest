# YML folder

This folder includes everything related to YML and the conversion of YML to TS/JS.

## Index.ts

This file is responsible to read, validate and generate entities from the `backend.yml` file.

## JSON Schema

CASE Schema is the [JSON Schema](https://json-schema.org/) that ensure the format of CASE YAML files.

It has 2 main goals:

- Provide IDE assistance on YML files trough documentation, error highlighting and autocomplete
- Validate the consistency of the data on compilation
