# PR #2427 — Billing & Pricing Verification Checklist

## Emails

- [x] 80% usage warning email sent and received
- [x] 100% limit reached email sent and received
- [x] Subscription confirmed email (Welcome to Manifest Pro) — styled
- [x] Plan changed email — styled
- [x] Cancellation confirmed email — styled
- [x] Review plan button links to /upgrade (not /account)
- [x] Logo and buttons left-aligned in all emails
- [x] Emails deduplicated (one per period per milestone)
- [x] Cache invalidation fix for 100% email trigger

## Usage Display (sidebar)

- [x] 0–50%: black progress bar
- [x] 50–80%: yellow (warning) progress bar
- [x] 80–100%: red (destructive) progress bar + red text + alert message
- [x] 100%: full red bar + "You've reached your monthly limit" message
- [x] Usage bar hidden for Pro plan users
- [x] Usage bar hidden for self-hosted users
- [x] Usage count and limit are dynamic (from billing API, not hardcoded)

## Global Usage Limit Banner

- [x] Appears at 80%+ on all pages
- [x] Dismissable with "Got it" (reappears next day)
- [x] Not dismissable at 100%
- [x] Upgrade plan button with icon

## Range Filters (PRO gating)

- [x] 30d, 90d, 365d disabled for free plan users
- [x] PRO badge displayed on disabled options
- [x] PRO badge links to /upgrade
- [x] Applied on GlobalOverview, AgentOverview, ConnectionDetail

## Plan Selection (signup flow)

- [x] Plan picker shows after account creation (step 2)
- [x] Pro plan expanded by default
- [x] Plan selection required before accessing dashboard
- [x] Cannot return to plan picker after selection (browser back blocked)
- [x] Plan choice persisted per user ID in localStorage
- [x] Logout does not reset plan choice

## Upgrade Page

- [x] Centered title and subtitle
- [x] Subgrid-aligned cards (buttons on same horizontal axis)
- [x] Pro card glow effect
- [x] "No commitment, cancel anytime" under Pro button
- [x] "Subject to our terms and conditions" link below cards
- [x] Back button checks referrer (no loop with Stripe)
- [x] Pro users see Enterprise upsell card
- [x] Feature lists match website pricing page

## Account Page (billing section)

- [x] "Manage subscription" and "View invoices" buttons (Pro users)
- [x] Cancellation notice shown when subscription cancelled
- [x] PRO badge in header dropdown

## Upgrade Success Modal

- [x] Shows on /overview?upgraded=1 after Stripe checkout
- [x] Renders above header (Portal, z-index)
- [x] Agent creation modal deferred until upgrade modal dismissed

## Logos

- [x] Beta logos replaced with new logotype (no "Beta" text)
- [x] Correct logo per theme (logotype-white for light, logotype-dark for dark)
- [x] Width 104px across header and auth pages

## Dynamic Values

- [x] Request limit uses `FREE_PLAN_REQUESTS_PER_MONTH` constant (not hardcoded 10,000)
- [ ] Pro price dynamically fetched from Stripe (not verified in production)

## Dark Mode

- [x] Destructive color adjusted for visibility (0 80% 62%)

## Not Verified

- [ ] Messages page displays Manifest-origin errors when requests are blocked after 10,000
- [ ] Console drift error on data hydration
- [ ] Retention system applied correctly (365d Pro vs 7d Free)

## Stripe Configuration

- [x] Invoice tax information configured
- [x] Business verification (EIN) completed
- [x] Identity verification (Sébastien) completed

## Website / Platform Consistency

- [ ] Features and pricing consistent between website and platform
- [ ] Terms and conditions link added

---

## To Do Before Deploying

- [ ] Set production Stripe environment variables (live keys, not sandbox)
- [ ] Complete all unchecked items above
- [ ] Deploy the platform first, validate it works
- [ ] Deploy the website after platform is confirmed live
