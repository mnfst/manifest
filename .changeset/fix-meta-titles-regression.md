---
"manifest": patch
---

fix: remove static title from DOM so @solidjs/meta can manage document.title

The static `<title>` in index.html (added for SEO/Lighthouse) conflicted with
@solidjs/meta's dynamic title management. Browsers use the first `<title>`
element in the document, so the static tag always won and page-specific titles
never appeared in the browser tab. The static tag is now removed on app mount,
preserving the SEO fallback for pre-JS crawlers while letting @solidjs/meta
control the title during navigation.
