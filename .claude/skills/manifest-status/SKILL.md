---
name: manifest-status
description: Show current Manifest configuration as a diagnostic table. Use when the user says "/manifest-status", "manifest status", "show manifest config", "manifest settings", "is manifest installed", "check manifest", or wants to see the current Manifest routing setup. Outputs a table and nothing else.
---

# Manifest Status

Print the current Manifest configuration. Shows both the direct model provider config (`models.providers.manifest`) and the plugin config if installed. No commentary -- just the table.

## Workflow

Run the diagnostic script:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/manifest_status.sh"
```

Output the table exactly as printed by the script. Do not add any extra text, explanation, or suggestions.
