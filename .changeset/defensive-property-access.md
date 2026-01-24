---
"manifest": patch
---

Fixed defensive property access in all registry components to handle empty objects and null values

The previous pattern `const { prop = default } = data ?? {}` failed when data was an empty object `{}` or had properties explicitly set to `null`. Now using explicit optional chaining and nullish coalescing: `const prop = data?.prop ?? default`

Affected components (19 total):
- Blogging: post-card, post-detail, post-list
- Events: event-card, event-detail, event-list
- List: product-list
- Messaging: chat-conversation
- Miscellaneous: stats
- Payment: amount-input, bank-card-form, pay-confirm, payment-methods, saved-cards
- Selection: option-list, quick-reply, tag-select
- Status: progress-steps, status-badge
