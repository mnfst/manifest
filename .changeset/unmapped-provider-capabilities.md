---
'manifest': patch
---

Report modalities and capability flags for Kilo, Pioneer, Cline Pass and Xiaomi models. These providers publish no modality data on their own `/models` endpoints, and models.dev may not price them: they list resold vendor models under the vendor's own ID, so their rates would overwrite the real vendor price in the shared cache. A new capability-only provider map carries them, separate from the map that grants pricing authority.
