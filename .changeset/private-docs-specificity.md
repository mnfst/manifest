---
'manifest': minor
---

Add `private_docs` as a specificity category for deterministic routing. Conversations containing private-document signals (HIPAA, attorney-client, medical records, confidential documents, etc.) can now be pinned to a specific route — e.g. a Privatemode-compatible OpenAI endpoint at `https://api.privatemode.ai/v1` — via the existing specificity override assignment. Detection uses weighted keyword anchors so a single distinctive term (e.g. "HIPAA") outscores generic verbs ("analyze") that also fire the data_analysis dimension. The `x-manifest-specificity: private_docs` header can also force the category with confidence 1.0. Removed `hipaa`/`gdpr` from the `domainSpecificity` keyword set to prevent cross-dimension overlap.
