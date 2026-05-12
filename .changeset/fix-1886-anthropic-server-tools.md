---
'manifest': patch
---

fix(proxy): preserve Anthropic server tools through /v1/messages double-conversion (#1886)

Claude Code requests routed through `POST /v1/messages` to an Anthropic upstream
failed with `tools.N.custom.input_schema: Field required` because server tools
(web_search, bash, text_editor, computer, code_execution) lost their `type` tag
during the Anthropic → OpenAI → Anthropic translation and were re-emitted as
custom tools missing the required `input_schema`. Server tools are now stashed
on the translated body and re-emitted unchanged when the upstream is Anthropic.
