# TaskBench Session Notes

Notes that don't fit in formal documentation but matter for continuity.
Read this file at the start of any new session to avoid repeating mistakes.

Last updated: 2026-04-30

## Working with the user

- He speaks French, types in French, thinks in French. Respond in French
  when he writes in French, English when he writes in English.
- He uses voice-to-text, so his messages can be long and stream-of-consciousness.
  Extract the actual request, don't get lost in the phrasing.
- He does NOT want time estimates. Every estimate I gave was wrong. Just say
  "it's running" and report when it finishes.
- He wants to be informed immediately when something goes wrong, not reassured.
- He commits and pushes frequently to protect against power cuts and session loss.
  Always commit after each lot. Never batch commits.
- He is a senior engineer (16+ years). Do not explain basic concepts unless asked.
- When he says "stop" or "pause", he means: finish the current case, kill the
  process, dedup, commit, push, learn. In that order. Do it immediately.

## Things that went wrong and how we fixed them

**Power cut killed the first session.** All data survived because we had committed
before. Lesson: commit after every lot, not in batches.

**Azure went down and never came back.** We lost 10 models (DeepSeek, Grok, Kimi,
Llama, GPT-5.x, o4-mini via Azure). We added direct APIs (Mistral, Moonshot,
OpenRouter) and rebuilt coverage. Azure models remain absent from all v2 tasks.

**Gemini 2.5 Pro returned empty responses.** Thinking tokens consumed the
max_completion_tokens budget. Fix: set max_completion_tokens to 8192.

**Kimi rejected temperature=0.** It's a reasoning model that only accepts
temperature=1. The error message was "invalid temperature: only 1 is allowed."
We added it to NO_TEMPERATURE_MODELS.

**Moonshot endpoint was wrong.** api.moonshot.cn rejected the key. The correct
endpoint is api.moonshot.ai. The old endpoint (api.moonshot.cn) works with older
keys, the new platform keys only work on api.moonshot.ai.

**OpenRouter model IDs have slashes.** bytedance-seed/seed-2.0-lite breaks file
paths. Fix: sanitize with .replace("/", "_") for filenames.

**Reasoning models scored 0 on exact match.** They wrap answers in <think> tags
or verbose explanations. Fix: strip_thinking() + effective_max_tokens().

**Mistral Large rate-limits even on paid tier.** With $20 credits, Mistral Medium
completes 50/50 on all tasks. Mistral Large only gets 15-50 per task. This is a
model-level rate limit, not an account-level one. We ran the catchup 3 times
before accepting partial data.

**Bash for loop with variable didn't work.** The variable containing space-separated
task names was treated as a single string. Fix: either list tasks literally in the
bash loop, or use Python subprocess per task.

**The runner crashed on OpenAI judge empty response.** The judge (gpt-4o-mini)
occasionally returns an empty body. Fix: wrap call_openai in try/except.

**Parallel runs create duplicate CSV rows.** Running two processes on the same task
simultaneously causes duplicates because resume logic checks at startup, not per-write.
Fix: always dedup after each lot.

**The resume logic has a subtle bug with partial data.** If a model has 23 out of 50
cases, the resume logic considers it "not complete" and re-runs it, adding 50 new
rows alongside the 23 old ones. This creates 73 rows. The dedup removes exact
duplicates but not the partial+full overlap. Fix: always delete partial rows before
re-running a model.

## Task difficulty observations

These are gut-level observations, not formal findings:

- data_to_text and code_explanation are useless as benchmark tasks. All models ace
  them. They exist in the data but add nothing to the analysis.
- RAG QA was the biggest surprise. Models that look smart everywhere else hallucinate
  here. It tests a fundamentally different capability: restraint.
- ToxiGen is the adversarial gold. The subtle cases (coded language, cultural sarcasm)
  break premium models that overthink.
- Instruction following is harder than it looks. Simple constraints like "exactly 3
  bullet points" trip up many models.

## Provider reliability ranking (from this session)

1. OpenAI (direct): never failed
2. Anthropic (direct): never failed
3. Mistral (direct): works but rate-limits large
4. MiniMax (direct): never failed
5. Gemini (direct): works, free tier rate-limits 2.0-flash
6. Moonshot (direct): works after endpoint fix
7. OpenRouter: works but slow on expensive models (Qwen Max)
8. Azure: down for the entire session, never recovered

## What the next session should do first

1. Run `/taskbench` to load full context
2. Read this file
3. Check if Azure is back (test DeepSeek-V3.2)
4. Create and run the 2 remaining tasks (extraction_hard_v2, multistep_reasoning)
5. Regenerate analysis (Pareto plots, heatmaps) on v2 data only
6. Update FINDINGS.md with final numbers
