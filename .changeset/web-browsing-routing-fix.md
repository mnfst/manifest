---
'manifest': minor
---

Fix web_browsing false positives that misrouted coding sessions. Pruned generic web-dev vocabulary (html, dom, url, http, link, page) from the webBrowsing keyword list, added weighted scoring, URL detection, code-fence/file-path signals, session stickiness across recent turns, a confidence gate, and a "Wrong category?" feedback control in the Messages log that dampens repeatedly-miscategorized categories.
