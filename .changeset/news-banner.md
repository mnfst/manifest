---
"manifest": patch
---

Add a dismissible News banner to the top of the global Overview. It links out to a Manifest video about choosing an AI subscription. Dismissals persist per news item in localStorage, so publishing a new item re-shows it. The thumbnail is self-hosted to keep the CSP strict, and the content is a single code-managed item in `services/news.ts`.
