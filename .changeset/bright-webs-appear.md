---
"manifest-provider": patch
---

Remove subscription discovery from cloud provider plugin. The manifest-provider plugin no longer scans local auth profiles or sends provider tokens to the backend. This resolves the ClaHub static analysis warning for file-read combined with network-send. Subscription provider management belongs in the self-hosted manifest plugin.
