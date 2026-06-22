---
'manifest': patch
---

Speed up dashboard load and the model picker. Tree-shaking the shared package trims ~7KB off the critical-path bundle, and the model picker no longer re-groups every model on each keystroke.
