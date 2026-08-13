---
name: Work Order
about: Work-order-grade issue — solvable and verifiable by an agent with no other context
title: "Fix <thing> in <place>"
---

## Objective

<1-3 lines describing the goal>

## Context & Symptoms

- <current behavior or problem>
- <where it appears: route/module/component>
- <impact on users/developers>

## Expected Outcome

- <observable end state>
- <what "done" looks like>

## Solution Intent

- <the desired end result / chosen approach — decided by you, not the implementer>
- <if alternatives existed: which was chosen and why, briefly>
- <or: "no preset approach — implementer decides the path to the expected outcome">

## Scope

- In: <files/modules touched, bounded>
- Out: <explicit non-goals>

## Acceptance Criteria & Verification

- [ ] <criterion — observable and measurable>
- [ ] <how to verify: exact command / test / manual step / performance threshold>

## Visual & Browser Verification

<!-- required for any UI-affecting change -->

- **Routes/pages:** <which pages to open, with what data/setup>
- **Viewports:** <desktop + mobile; add tablet/narrow widths if responsive behavior is at risk>
- **States to inspect:** <loading, empty, error, hover/focus, dark mode if applicable>
- **What to look for:** <layout/overflow, alignment, spacing, contrast, regressions vs. intended design>
- **Evidence:** capture screenshots (full page + mobile) and attach them to the PR/issue comment

## Reproduction

<!-- only for bugs -->

1. <step one>
2. <step two>

**Environment:** <branch, env, device>

---

> Agent note: work through this issue with the `work-order` conventions in `.agents/skills/work-order/SKILL.md`. Priority and Size live in project fields, not in the body. Release-relevant changes require a changeset.
