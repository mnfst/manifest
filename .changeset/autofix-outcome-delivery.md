---
"manifest": patch
---

Auto-fix always closes the evidence loop with Phoenix: a retry that dies mid-flight is reported as a synthetic 499 instead of leaving the heal attempt pending, and a dropped outcome report is resent before giving up
