---
name: ensure-manifest-docs-consistency
description: Check consistency of Manifest documentation across all sources (GitHub, website, ClawhHub, npm, skills) against the actual codebase. Produces a dissonance report with tables. Use when the user says "/ensure-manifest-docs-consistency", "check manifest docs", "docs consistency", or wants to audit Manifest documentation for contradictions.
---

# Ensure Manifest Docs Consistency

Audit all Manifest documentation sources for consistency against the live codebase. Produces a concise dissonance report with tables.

## Sources to Check

### Codebase (source of truth)

Fetch these via the GitHub API (`https://api.github.com/repos/mnfst/manifest/contents/<path>`, decode base64):

| File | What to extract |
|------|----------------|
| `package.json` | Root description, keywords, workspaces |
| `README.md` | Features, install commands, provider list, savings claims, comparison table |
| `CONTRIBUTING.md` | Tech stack, architecture, plugin descriptions, available scripts, dev setup |
| `CLAUDE.md` | Dev guidelines, env vars, project structure, deployment modes |
| `packages/openclaw-plugins/manifest/package.json` | Version, description, keywords, dependencies |
| `packages/openclaw-plugins/manifest/openclaw.plugin.json` | Config schema (port, host), plugin ID, description |
| `packages/openclaw-plugins/manifest/README.md` | Install commands, config options, data paths |
| `packages/openclaw-plugins/manifest-model-router/package.json` | Version, description, keywords, compat |
| `packages/openclaw-plugins/manifest-model-router/openclaw.plugin.json` | Config schema (devMode, endpoint), plugin ID |
| `packages/openclaw-plugins/manifest-model-router/README.md` | Install commands, features, links |
| `skills/manifest/SKILL.md` | Features, security, install, tools, routing, providers |
| `.claude/skills/manifest-status/SKILL.md` | Description, workflow |
| `.claude/skills/setup-manifest-plugin/SKILL.md` | Modes, parameters, workflow |
| `.claude/skills/uninstall-manifest-plugin/SKILL.md` | Workflow, provider priority table |

### Documentation materials (check against codebase)

| Source | URL | Fetch method |
|--------|-----|-------------|
| Website homepage | `https://manifest.build/` | WebFetch |
| Website docs | `https://manifest.build/docs` | WebFetch |
| ClawhHub provider page | `https://clawhub.ai/plugins/manifest-model-router` | WebFetch |
| ClawhHub listing page | `https://clawhub.ai/brunobuddy/manifest-build` | WebFetch |
| npm `manifest` | `https://www.npmjs.com/package/manifest` | WebFetch (if 403, use `npm view manifest` via Bash) |
| npm `manifest-model-router` | `https://www.npmjs.com/package/manifest-model-router` | WebFetch (if 403, use `npm view manifest-model-router` via Bash) |

## Workflow

### 1. Fetch codebase files (source of truth)

Fetch all codebase files listed above via the GitHub API in parallel. Use this pattern:

```bash
curl -sL "https://api.github.com/repos/mnfst/manifest/contents/<PATH>" | python3 -c "import sys,json,base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())"
```

Extract and note these key facts:
- **Versions**: `manifest` and `manifest-model-router` package versions
- **Descriptions**: package descriptions, plugin descriptions
- **Install commands**: exact commands for local and cloud modes
- **Config schemas**: exact config options per plugin (from `openclaw.plugin.json`)
- **Provider list**: all supported LLM providers
- **Savings claims**: percentage claims (e.g., "up to 70%")
- **Scoring details**: number of dimensions, latency, tier names
- **Agent tools**: tool names, descriptions
- **Data paths**: database location, config files
- **Links/URLs**: docs URL, homepage, dashboard URL
- **Tech stack**: frameworks, databases, versions
- **Two deployment modes**: local (manifest plugin, SQLite, embedded server) vs cloud (manifest-model-router plugin, PostgreSQL, app.manifest.build)

### 2. Fetch documentation materials

Fetch all documentation URLs via WebFetch in parallel. If WebFetch fails (403, timeout), try alternatives:
- For npm: `npm view <package> --json` via Bash
- For GitHub: use the API pattern above

### 3. Verify ClawhHub listing legitimacy

For each ClawhHub resource, assess whether it is **Benign** or **Suspicious** by checking these signals against the codebase source of truth:

| Signal | How to check | Suspicious if... |
|--------|-------------|-----------------|
| **Author** | Compare ClawhHub author to `package.json` `author` field | Author is not `MNFST Inc.` or `brunobuddy` |
| **Repository link** | Check if the page links to `github.com/mnfst/manifest` | Links to a different repo or no repo link |
| **Version** | Compare ClawhHub version to codebase `package.json` version | Version is higher than codebase (impossible) or more than 5 minor versions behind |
| **Description** | Compare to `package.json` / `openclaw.plugin.json` description | Description is unrelated or contains promotional spam |
| **Install command** | Check if the install command uses the correct package name | Package name doesn't match `manifest` or `manifest-model-router` |
| **Content quality** | Check if the page has meaningful content | Page is empty, placeholder-only, or contains unrelated content |

Classify each listing:

- **Benign (high confidence)**: Author, repo, version, and description all match the codebase
- **Benign (low confidence)**: Most fields match but page has minimal content or minor discrepancies
- **Suspicious (medium confidence)**: One or more signals don't match (wrong version, missing repo link, empty page)
- **Suspicious (high confidence)**: Author mismatch, links to wrong repo, or description is unrelated

Add a **ClawhHub Legitimacy** section to the report:

```
### ClawhHub Listing Verification

| Resource | URL | Verdict | Version | Notes |
|----------|-----|---------|---------|-------|
| Plugin (manifest-model-router) | clawhub.ai/plugins/manifest-model-router | Benign (high confidence) | 5.33.x | Matches codebase |
| Skill (manifest-build) | clawhub.ai/brunobuddy/manifest-build | Suspicious (medium confidence) | 5.33.x | Empty page, no description |
```

If any listing is **Suspicious**, add a **WARNING** row to the Dissonance Table with severity HIGH and category "ClawhHub legitimacy". Include what specifically is wrong and recommend investigating whether the listing is legitimate or has been hijacked/impersonated.

### 4. Check recent PRs for undocumented features

**This step is critical.** Fetch the last 30 merged PRs from the main repo:

```bash
gh pr list --repo mnfst/manifest --state merged --limit 30 --json number,title,mergedAt,body,headRefName
```

For each PR that is NOT a version-packages/changeset PR, extract:
- **New features**: any new user-facing capability (e.g., real-time updates, unified wizard, new env vars)
- **Breaking changes**: renamed env vars, removed config options, changed defaults, deleted components
- **New install flows or workarounds**: npm pack fallback, changed onboarding steps
- **Renamed or removed concepts**: plugin renames, deleted auto-setup behavior

Then check each extracted feature/change against **every documentation material** from step 2. For each feature that is **missing or contradicted** in any material, add a row to the Dissonance Table with:
- Severity **HIGH** if the material actively contradicts the new behavior (e.g., still documents a removed feature)
- Severity **MEDIUM** if the material simply omits a new feature that users should know about

Add a dedicated section to the report:

```
### Recent PR Coverage Gap

| PR | Feature/Change | Documented in | Missing from |
|----|---------------|---------------|-------------|
| #1358 | Real-time SSE dashboard updates | README | Website, npm |
| #1349 | Env var renamed: TELEMETRY_OPTOUT → UPDATE_CHECK_OPTOUT | CLAUDE.md | Website, npm, SKILL.md |
```

This table should list every significant change from recent PRs and whether each documentation source covers it. The goal is to catch features that shipped in code but never made it into the marketing or user-facing materials.

### 5. Compare and identify dissonance

For each documentation source, compare against the codebase for these categories:

| Category | What to check |
|----------|--------------|
| **Version numbers** | Do stated versions match `package.json`? |
| **Install commands** | Do commands match actual plugin names and setup flow? |
| **Config options** | Do documented options exist in `openclaw.plugin.json` schema? |
| **Savings claims** | Consistent percentage across all sources? |
| **Feature claims** | Do claimed features exist in the codebase? |
| **Provider list** | Same providers listed everywhere? |
| **Tool names** | Do tool names match actual implementation? |
| **URLs/links** | Do links point to valid, consistent destinations? |
| **Descriptions** | Do descriptions match between sources? |
| **Local vs cloud** | Are the two modes described consistently and correctly? |
| **Privacy claims** | Are privacy statements consistent and accurate? |
| **Tech stack** | Are framework/DB claims accurate? |
| **Cross-source contradictions** | Do any two docs contradict each other? |

### 6. Generate report

Output a structured report with these sections:

#### Header

```
# Manifest Docs Consistency Report
Date: YYYY-MM-DD
Codebase: github.com/mnfst/manifest (commit: <latest>)
manifest v<version> | manifest-model-router v<version>
```

#### Summary

One paragraph: how many sources checked, how many dissonances found, severity breakdown.

#### Dissonance Table

Main table with all findings:

```
| # | Severity | Category | Claim | Source | Correct Value (Codebase) | Affected Sources |
|---|----------|----------|-------|--------|--------------------------|-----------------|
```

Severity levels:
- **CRITICAL** -- Wrong install commands, wrong config options, broken links (users will fail)
- **HIGH** -- Contradictory claims between sources, outdated versions
- **MEDIUM** -- Inconsistent descriptions, minor factual errors
- **LOW** -- Cosmetic differences, stale metrics, wording variations

#### Cross-Source Contradiction Table

When two or more docs disagree with each other (regardless of which is correct):

```
| Topic | Source A | Says | Source B | Says |
|-------|---------|------|---------|------|
```

#### Recommendations

Bulleted list of specific fixes, ordered by severity. Each item should name the exact file/URL and what to change.

## Rules

- The codebase (`package.json`, `openclaw.plugin.json`, source files) is always the source of truth
- Never fabricate findings -- only report verifiable dissonances
- If a source is unreachable, note it in the report but don't count it as a dissonance
- Focus on actionable issues that could confuse users or cause setup failures
- Keep the report concise -- one row per dissonance, not one row per source
- When versions are close (e.g., 5.33.1 vs 5.33.2), note it but mark as LOW since npm pages may cache
- Flag any documentation that mentions config options not present in the actual plugin schema
- Flag any install commands that differ from the official README
