---
"manifest": patch
---

Fix MiniMax Token Plan activation redirecting to the homepage. The MiniMax `/oauth/code` endpoint returns a `verification_uri` pointing at `https://www.minimax.io/oauth-authorize?...`, which 307-redirects to the homepage with no instructions. The real authorize page lives on `platform.minimax.io` (and `platform.minimaxi.com` for the CN region). The MiniMax OAuth start flow now rewrites the host before returning the URI, so users land on the actual page where their 6-digit code can be entered. Closes #1796.
