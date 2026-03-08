---
name: manifest-status
description: Show current Manifest plugin configuration as a diagnostic table. Use when the user says "/manifest-status", "manifest status", "show manifest config", "manifest settings", "is manifest installed", "check manifest plugin", or wants to see the current state of the Manifest OpenClaw plugin configuration. Outputs a table and nothing else.
---

# Manifest Status

Print the current Manifest plugin configuration. No commentary — just the table.

## Workflow

Run the diagnostic script (path relative to repository root):

```bash
bash skills/manifest-status/scripts/manifest_status.sh
```

Output the table exactly as printed by the script. Do not add any extra text, explanation, or suggestions.
