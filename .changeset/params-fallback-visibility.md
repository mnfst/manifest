---
'manifest': patch
---

Show the Model Parameters button on a routing tier when any route in the tier — primary or fallback — uses a params-compatible provider. Previously the button was gated to the primary route only, so a tier with DeepSeek configured as a fallback hid the toggle even though the proxy already applies tier-level `param_defaults` to whichever provider an attempt actually targets. The dialog's provider-default hint follows the first compatible route in the ordered (primary, …fallbacks) list.
