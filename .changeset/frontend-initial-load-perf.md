---
"manifest": patch
---

Speed up the dashboard's first load. Heavy code now loads on demand instead of up front: the syntax highlighter is a slim 6-language build, charts load per tab, and the markdown renderer loads when the first message renders. Dev-only tooling no longer ships in production bundles.
