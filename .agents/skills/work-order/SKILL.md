---
name: work-order
description: "Turn brief problem notes into complete, verifiable GitHub issues (work orders). Use when the user describes bugs or improvement ideas and wants them drafted into agent-ready, verification-grade issues — the user decides the desired solution, you propose options when ambiguous, then draft and create the issues."
---

# Work-Order Issue Creation

The user spots problems and describes them briefly. You turn those notes into **work-order-grade GitHub issues** — executable by a context-less agent later (paseo spawn, Hub trigger, parallel worktrees).

## Decision Model

- **The user decides WHAT** — the desired end result, including any technical preference they have.
- When several credible ways to reach the goal exist, **you propose options with strengths and weaknesses** and the user picks. Offer options only when genuinely ambiguous — not for obvious fixes.
- **You own HOW** — figuring out the path to the chosen goal is your job, not a question you ask the user.
- Issues record the user's **solution intent** (the decision), never an implementation plan. The implementing agent derives HOW.

## Flow

1. Collect the user's brief problem notes (they may dump several at once).
2. Interrogate — ask for what is missing, never guess.
3. Propose solutions — for each problem with multiple viable approaches, present options + trade-offs; user picks the WHAT.
4. Draft every issue using the template below.
5. Run the Verifiability Test on every draft.
6. Confirm with the user, explicitly: target repo, grouping, titles + bodies, and Priority/Size.
7. Check duplicates (`gh issue list`), create (`gh issue create --body-file`), set project fields if a project exists.
8. Report created issues: numbers, titles, labels, milestone, field updates.

## Interrogation Checklist

Ask for anything missing from the brief. Batch related questions; keep the count minimal. **Never invent** file paths, modules, behavior, or technical details. If you don't know where the problem lives, offer to investigate the codebase (read `AGENTS.md` and `docs/glossary.md` first).

Per issue, you need:

- **Problem** — what happens, or what is missing (one line).
- **Location** — route/module/component/files. Unknown? Offer to search the code rather than guess paths.
- **Impact** — who suffers and how (users, developers, providers, reliability).
- **Solution intent (WHAT)** — the desired end result; the user's technical preference if they have one. Ask this as a decision, not as "how should this be implemented".
- **Expected** — the exact behavior when fixed.
- **Verification** (non-negotiable) — how to prove it works: specific test command, manual steps, or measurable threshold. At least one concrete check per issue.
- **Visual verification** (UI-affecting changes) — which pages/routes to inspect, which states (loading, empty, error, hover), which viewports (desktop/mobile). Default: desktop + mobile for every touched route.
- **Scope** — what is in, what is explicitly out.
- **Reproduction** — steps and environment, for bugs only.
- **Metadata** — type label, area label(s), milestone (if any).
- **Priority and Size** — via repo project fields, never in the body.

Rules:
- If verification cannot be stated after asking, keep asking until it can. **An issue without verification is not creatable.**
- Never ask "how should it be implemented" — that is yours to figure out. Ask what result the user wants, propose options when there are real choices.

## Adaptive Depth

- Small (S) issues: confirm only problem, solution intent, and verification. Infer scope; confirm in one line.
- Medium/Large (M/L): run the full checklist.

## Drafting

- Title: imperative, specific, ≤ ~60 chars — "Fix <thing> in <place>".
- Body: sections in fixed order (template below), GitHub Flavored Markdown, human tone, English.
- Record the **solution intent** — the user's decision, with brief rationale if alternatives were compared. Do not write an implementation plan; the implementing agent derives HOW.
- Use Manifest domain terminology correctly: a **Manifest Request** is one logical request from an agent to Manifest; a **Provider Attempt** is one request from Manifest to an AI provider. See `docs/glossary.md` — it is the canonical contract.
- Never put Priority or Size in the body — they live in project fields.
- Scope must bound the work: a fresh agent needs to know where to look and where to stop.

## Issue Body Template

```markdown
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

- <the desired end result / chosen approach — decided by the user>
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
```

## Grouping

- One cohesive problem per issue — not tiny, not umbrella.
- Group only tightly coupled items (same module, single delivery boundary).
- Split anything exceeding Size `L` (see repo conventions below).
- Ask for clarification before creating, not after.

## Verifiability Test (self-check before creating)

Answer for every draft:

1. Can a fresh agent with only this issue locate the code?
2. Is "done" observable from the Expected Outcome and criteria?
3. Is there at least one concrete verification step?
4. Is the solution intent recorded (what the user decided)?
5. Do the scope boundaries prevent wandering?

Any "no" → go back to interrogation before showing drafts. For UI changes, additionally: **is there at least one concrete visual check** (route + viewport + state)?

## Repo Conventions

Read `AGENTS.md` for repo guidance and `docs/glossary.md` for domain terminology. For dev-environment specifics (prod 2099 / dev 2100 dual stack, `switch-manifest.sh`), the `manifest-dev` skill covers it.

### Labels

- Type (exactly one): `bug`, `enhancement`, `refactor`, `docs` — upstream uses `docs`, not `documentation`.
- Area (one or more, existing upstream labels): `UX`, `Website`, `Cloud`, `Self-hosted`, `DX`.
- Use only existing upstream labels — this set already exists on `mnfst/manifest`. Create new labels only if genuinely needed (with user approval).

### Size and Priority

- Manifest upstream has no Priority/Size project fields — use its existing labels instead:
  - `Priority: High` · `Priority: Medium` · `Priority: Low`
  - `size: XS` (< 10 lines) · `size: S` (10-50) · `size: M` (50-200) · `size: L` (200-500) · `size: XL` (500+)
  - `severity: critical` · `severity: medium` · `Severity: low` (note casing) — for bugs.

### Verification commands (for acceptance criteria)

- Tests: `npm run test` (turbo, all packages).
- Lint: `npm run lint`.
- API prefix check: `npm run check:api-prefix`.
- Release-relevant changes need a changeset: `npm run changeset` (validated by `npm run check:changesets`).
- Manual verification: exercise the Dev stack (`switch-manifest.sh dev`, port 2100) before promoting to Prod (2099).
- **Visual/browser (UI changes):** run the Dev stack (`switch-manifest.sh dev`, port 2100), then inspect the issue's route set with browser tooling (Playwright or equivalent) at desktop + mobile widths. Check layout/overflow, alignment, spacing, contrast, and key states; capture screenshots as evidence and attach them to the PR/issue comment.

## Target Repository

Issues and labels live on the **upstream** repo (the project tracker), never on the fork. Default target: the upstream remote — `mnfst/manifest` — confirmed with the user before creating. Create with `gh issue create -R <owner/repo> --body-file`.
