---
'manifest': patch
---

Stop filtering the canonical `gemini-3.1-flash-lite-preview` (and similar non-dated `flash-lite-preview` aliases) from Gemini model discovery. The previous regex was meant to drop deprecated dated snapshots like `gemini-2.5-flash-lite-preview-09-2025` but over-matched and removed live preview models too. Tightened to require a `-MM-YYYY` date suffix so dated snapshots still get filtered while canonical previews surface.
