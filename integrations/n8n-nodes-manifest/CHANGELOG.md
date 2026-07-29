# Changelog

## 0.2.1

- Mark the Manifest action node as usable by AI agents, as required by the n8n community-node linter.
- Use the supported `Development` codex category for the Manifest Chat Model and remove unsupported subcategory metadata.
- Remove dependency overrides that are no longer allowed in n8n community node packages.

## 0.2.0

- Add the **Manifest Chat Model** sub-node (`lmChatManifest`), built on `@n8n/ai-node-sdk`. It plugs into the AI Agent and Basic LLM Chain nodes as a language model, so Manifest can be used as a drop-in replacement for any chat model provider.
- The Manifest Chat Model node loads the model list from your Manifest instance, with `auto` (Manifest routing) as the default.
- **Breaking:** the Manifest action node is no longer exposed as an AI Agent tool (`usableAsTool` removed). Manifest is a model router, not a tool — use the new Manifest Chat Model node to connect agents to Manifest. Existing workflows that call the action node directly are unaffected.

## 0.1.4

- Correct the node codex identifier and category for n8n verification.
- Remove unsupported node codex metadata.

## 0.1.3

- Respect the response mode configured by Manifest routing.
- Parse streaming responses into n8n workflow output.

## 0.1.2

- Mirror node source files at the repository root for n8n Creator Portal verification.

## 0.1.1

- Include build artifacts required by the n8n Creator Portal repository checks.

## 0.1.0

- Initial Manifest community node for n8n.
