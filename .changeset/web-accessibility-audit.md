---
"manifest": patch
---

Improve web accessibility (WCAG AA) across the frontend

- Add `aria-hidden="true"` to all decorative SVG icons (30+ instances)
- Add `role="alert"` to form error messages on Login, Register, ResetPassword, EmailProviderModal, and Limits warning banner
- Associate form labels with inputs via `for`/`id` on Workspace, LimitRuleModal, and EmailProviderModal
- Add `aria-labelledby` to dialogs missing it (DeleteRuleModal, RemoveProviderModal, DisableRoutingModal, Settings delete modal)
- Add `role="dialog"` and `aria-modal="true"` to Settings delete modal and DisableRoutingModal
- Add `role="menu"` and `role="menuitem"` to kebab menu dropdown in LimitModals
- Add `aria-label` to buttons missing accessible names (SetupWizard close, Account copy)
- Add ESC key handling to Settings delete modal
- Add `aria-live` region to ToastContainer for screen reader announcements
- Add `role="status"` to standalone loading spinner in Routing page
