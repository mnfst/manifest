---
"manifest": patch
---

Fix the dashboard "Messages" totals so every view agrees. The Overview card counted failed requests (including agents that have no provider set up yet) while the per-agent and per-provider views did not, so the headline number could sit ~35% above the sum of its parts. Every "messages" metric now counts the same thing: real messages, excluding error and rate-limited rows. The Messages log still lists failed rows so you can see what went wrong.
