---
"manifest": minor
---

Add custom header-triggered routing tiers. Configure a tier keyed to an HTTP header key+value pair (e.g. `x-manifest-tier: premium`) and every matching request routes directly to that tier's model, overriding specificity and complexity. Each tier gets a user-picked name + color that shows as a badge on the message row. The create modal autocompletes the header key from the keys Manifest has already seen in the last 7 days, grouped by the SDK that sent them, with example values. Sensitive headers (`authorization`, `cookie`, …) are blocked from being used as match rules.
