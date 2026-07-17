---
"manifest": patch
---

The password reset page now detects when no email provider is configured and shows a clear notice (pointing to the authenticated Change Password flow) instead of silently pretending a reset link was sent. Self-hosted installs without an `EMAIL_PROVIDER` no longer dead-end here.
