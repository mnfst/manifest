---
'manifest': patch
---

Replace the redundant "Click the link in your email" green box on the post-signup screen with a hint that surfaces the resend flow inline. When a duplicate signup quietly returns no email (Better Auth's anti-enumeration behavior), users now have a visible path to recover via the inline "Resend verification email" link.
