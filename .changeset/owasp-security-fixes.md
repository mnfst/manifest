---
"manifest": patch
"manifest-provider": patch
---

fix: OWASP security hardening across backend and plugins

- Use per-key random salt for API key hashing (backward-compatible with legacy hashes)
- Restrict local-mode auth to loopback IPs by default (opt-in LAN trust via MANIFEST_TRUST_LAN)
- Re-enable SSRF protection in local mode for cloud metadata endpoints
- Scope trigger-check endpoint to requesting user's notification rules
- Fix IDOR read in deleteRule by verifying ownership before reading rule data
- Add email validation DTO for test-saved endpoint
- Count all proxy requests toward rate limit (not just successes)
- Restrict dev CORS to ports 3000/3001 only
- Return generic error messages from proxy in production mode
- Remove devMode auto-detection in provider plugin (require explicit opt-in)
- Strengthen URL validation with proper URL parsing
- Add fetch timeout to provider plugin tool API calls
- Add file locking for config file operations in manifest plugin
- Stop forcing NODE_ENV=development in embedded plugin server
- Restrict auto-migrations to development/test environments only
