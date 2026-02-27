---
"manifest": minor
---

Allow spaces in agent names by adding a display_name column. User input like "My Cool Agent" is auto-slugified to "my-cool-agent" for URLs and internal references, while the original name is stored as display_name and shown in the UI.
