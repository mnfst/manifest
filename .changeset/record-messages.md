---
'manifest': minor
---

Add opt-in per-agent message recording. Toggle in Settings → Recording captures the full request body, response body, and response headers for subsequent proxy calls. Recorded rows show a record-dot icon in the Messages log; clicking it opens a formatted modal with Parameters, Conversation turns, Tool calls, Reply, Usage pills, and Headers. Payloads capped at 2 MB and kept out of the hot message-list query via a separate `message_recordings` table. Defaults off; never included in anonymous telemetry.
