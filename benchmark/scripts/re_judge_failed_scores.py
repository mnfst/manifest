#!/usr/bin/env python3
"""
Re-judge responses that received score=0 due to judge crash (OpenAI quota exhaustion).

Reads raw JSON responses from results/raw/, re-calls ONLY the judge (GPT-4o-mini)
on responses that have score=0 and non-empty response text, then updates both the
JSON raw file and the CSV.

Usage:
    python scripts/re_judge_failed_scores.py --dry-run    # preview what would be re-judged
    python scripts/re_judge_failed_scores.py               # actually re-judge
"""

import argparse
import csv
import json
import os
import shutil
import time
from datetime import datetime
from pathlib import Path


# --- Load .env ---
def load_dotenv():
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())

load_dotenv()


# --- Affected models and tasks (from investigation) ---
AFFECTED_MODELS = {
    "deepseek/deepseek-v4-pro",
    "nvidia/nemotron-3-super-120b-a12b",
    "bytedance-seed/seed-2.0-mini",
    "meta-llama/llama-4-maverick",
    "x-ai/grok-code-fast-1",
    "qwen/qwen-max",
    "x-ai/grok-4-fast",
    "qwen/qwen3.6-plus",
    "qwen/qwen3-coder",
}

AFFECTED_TASKS = {
    "code_explanation",
    "code_generation",
    "code_review_v2",
    "data_to_text",
    "email_summary_v2",
    "instruction_following",
    "json_transform_v2",
    "long_summarization",
    "rag_qa",
    "structured_output",
    "test_generation_v2",
}

# --- Judge prompts (EXACT copy from run_batch.py TASK_DEFS) ---
JUDGE_PROMPTS = {
    "code_explanation": "Rate this code explanation on a 1-5 scale. 5=perfectly identifies the algorithm/pattern and explains behavior clearly. 4=correct but misses a detail. 3=partially correct or vague. 2=mostly wrong. 1=completely wrong or empty. Respond with ONLY a number 1-5.",
    "code_generation": "Rate this code completion on a 1-5 scale. 5=correct implementation that would pass all tests. 4=mostly correct with minor bugs. 3=right approach but significant errors. 2=partially relevant but fundamentally wrong. 1=empty, wrong language, or completely off. Respond with ONLY a number 1-5.",
    "code_review_v2": "Rate this code review on a 1-5 scale. 5=identifies all major bugs and security issues with specific fixes. 4=catches major issues with good suggestions. 3=catches some issues but misses important ones. 2=vague or mostly irrelevant. 1=wrong or empty. Respond with ONLY a number 1-5.",
    "data_to_text": "Rate this data-to-text conversion on a 1-5 scale. 5=all data points included in natural flowing prose. 4=most data included with good readability. 3=some data missing or awkward phrasing. 2=major data omissions. 1=wrong or empty. Respond with ONLY a number 1-5.",
    "email_summary_v2": "Rate this email summary on a 1-5 scale. 5=captures all key points and action items in 2 clear sentences. 4=captures main point with minor omissions. 3=gets topic right but misses specifics. 2=vaguely related. 1=wrong or empty. Respond with ONLY a number 1-5.",
    "instruction_following": "The user gave a specific instruction with constraints. Rate how well the response follows ALL constraints on a 1-5 scale. 5=all constraints met perfectly. 4=minor constraint violation. 3=one major constraint missed. 2=most constraints ignored. 1=completely off. Respond with ONLY a number 1-5.",
    "json_transform_v2": "Rate this JSON transformation on a 1-5 scale. 5=valid JSON matching target format with all data correctly mapped. 4=valid JSON with minor data mapping issues. 3=valid JSON but significant mapping errors. 2=invalid JSON or mostly wrong. 1=not JSON or completely wrong. Respond with ONLY a number 1-5.",
    "long_summarization": "Rate this summary on a 1-5 scale. 5=captures all key points concisely. 4=good but misses one detail. 3=gets the topic but misses important facts. 2=vaguely related. 1=wrong or empty. Respond with ONLY a number 1-5.",
    "rag_qa": "Rate this answer on a 1-5 scale. 5=correct and directly supported by the context. 4=correct but could be more precise. 3=partially correct. 2=wrong answer. 1=hallucinated (not in context) or empty. Respond with ONLY a number 1-5.",
    "structured_output": "Rate this JSON extraction on a 1-5 scale. 5=valid JSON with all fields correctly extracted. 4=valid JSON with 1 minor error. 3=valid JSON but multiple errors. 2=invalid JSON but right idea. 1=not JSON or completely wrong. Respond with ONLY a number 1-5.",
    "test_generation_v2": "Rate these unit tests on a 1-5 scale. 5=comprehensive tests covering happy path, edge cases, and errors with good assertions. 4=good coverage with minor gaps. 3=basic happy path tests only. 2=tests exist but incomplete or incorrect. 1=not valid tests or empty. Respond with ONLY a number 1-5.",
}


def call_judge(response_text, original_input, judge_prompt, max_retries=3):
    """
    Call GPT-4o-mini judge with retry and exponential backoff.
    Returns (score, judge_raw_response, error_message).
    Never returns 0 silently on error — returns (None, None, error_msg) instead.
    """
    import requests

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
        "Content-Type": "application/json",
    }
    messages = [
        {"role": "system", "content": "You are an evaluation judge. " + judge_prompt},
        {"role": "user", "content": f"Input: {original_input[:2000]}\n\nResponse to evaluate:\n{response_text[:2000]}"},
    ]
    body = {"model": "gpt-4o-mini", "messages": messages, "max_tokens": 20, "temperature": 0}

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=body, headers=headers, timeout=30)
            data = resp.json()

            if "error" in data:
                error_msg = data["error"].get("message", str(data["error"]))
                if attempt < max_retries - 1:
                    wait = 2 ** (attempt + 1)
                    time.sleep(wait)
                    continue
                return (None, None, f"API error after {max_retries} retries: {error_msg}")

            raw = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            try:
                score = int("".join(c for c in raw if c.isdigit())[:1])
                return (score, raw, None)
            except (ValueError, IndexError):
                return (None, raw, f"Could not parse score from judge response: {raw}")

        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                time.sleep(wait)
                continue
            return (None, None, f"Timeout after {max_retries} retries")
        except Exception as e:
            return (None, None, f"Unexpected error: {str(e)}")

    return (None, None, "Max retries exhausted")


def check_quota():
    """Verify OpenAI credits are available before starting."""
    import requests
    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
                "Content-Type": "application/json",
            },
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "1"}], "max_tokens": 1},
            timeout=10,
        )
        data = resp.json()
        if "error" in data and "quota" in str(data["error"]).lower():
            return False, data["error"].get("message", "Quota exceeded")
        if "choices" in data:
            return True, "OK"
        return False, f"Unexpected response: {str(data)[:100]}"
    except Exception as e:
        return False, str(e)


def find_cases_to_rejudge(raw_dir):
    """Find all JSON files that need re-judging."""
    cases = []
    for model in AFFECTED_MODELS:
        safe_model = model.replace("/", "_")
        for task in AFFECTED_TASKS:
            for case_idx in range(60):  # up to 60 cases per task
                filename = f"{task}_{safe_model}_{case_idx}.json"
                filepath = os.path.join(raw_dir, filename)
                if not os.path.exists(filepath):
                    continue
                try:
                    with open(filepath) as f:
                        data = json.load(f)
                    # Only re-judge if: score=0, response non-empty, not already rerun
                    if (data.get("score", 0) == 0
                            and data.get("response", "").strip()
                            and not data.get("judge_rerun", False)):
                        cases.append({
                            "filepath": filepath,
                            "model": model,
                            "task": task,
                            "case_idx": case_idx,
                            "response": data["response"],
                            "data": data,
                        })
                except (json.JSONDecodeError, KeyError):
                    continue
    return cases


def atomic_write_json(filepath, data):
    """Write JSON atomically: backup -> write -> remove backup."""
    backup = filepath + ".bak"
    if os.path.exists(filepath):
        shutil.copy2(filepath, backup)
    try:
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)
        if os.path.exists(backup):
            os.remove(backup)
    except Exception:
        if os.path.exists(backup):
            shutil.move(backup, filepath)
        raise


def update_csv(csv_path, model, task, case_idx, new_score):
    """Update the score in the CSV for a specific (task, model, case_idx) row."""
    rows = []
    updated = False
    with open(csv_path, newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows.append(header)
        for row in reader:
            if row[1] == task and row[3] == model and row[2] == str(case_idx):
                row[10] = str(new_score)  # score column
                updated = True
            rows.append(row)

    if updated:
        with open(csv_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(rows)

    return updated


def main():
    parser = argparse.ArgumentParser(description="Re-judge failed scores from batch 2")
    parser.add_argument("--dry-run", action="store_true", help="List cases without calling the judge")
    args = parser.parse_args()

    os.chdir(Path(__file__).parent.parent)
    raw_dir = "results/raw"
    csv_path = "results/benchmark_results.csv"
    log_path = "results/rejudge_log.jsonl"

    # Find cases
    cases = find_cases_to_rejudge(raw_dir)
    print(f"Found {len(cases)} cases to re-judge")
    print(f"Models: {len(set(c['model'] for c in cases))}")
    print(f"Tasks: {len(set(c['task'] for c in cases))}")

    if args.dry_run:
        print("\nDRY RUN — would re-judge:")
        by_model = {}
        for c in cases:
            by_model.setdefault(c["model"], []).append(c["task"])
        for model in sorted(by_model):
            tasks = set(by_model[model])
            print(f"  {model}: {len(tasks)} tasks, {len(by_model[model])} cases")
        print(f"\nEstimated judge calls: {len(cases)}")
        print(f"Estimated cost: ~${len(cases) * 0.0001:.2f}")
        return

    # Check quota
    print("\nChecking OpenAI quota...")
    ok, msg = check_quota()
    if not ok:
        print(f"QUOTA CHECK FAILED: {msg}")
        print("Add credits to OpenAI before running.")
        return
    print(f"Quota OK: {msg}")

    # Re-judge
    print(f"\nStarting re-judge of {len(cases)} cases...")
    success = 0
    errors = 0
    skipped = 0

    for i, case in enumerate(cases):
        task = case["task"]
        model = case["model"]
        judge_prompt = JUDGE_PROMPTS.get(task)
        if not judge_prompt:
            print(f"  SKIP {model} {task} case {case['case_idx']}: no judge prompt")
            skipped += 1
            continue

        # Build the original input (approximation — we use what we have)
        original_input = case["data"].get("expected", "")

        # Call judge
        score, judge_raw, error = call_judge(case["response"], original_input, judge_prompt)

        # Log
        log_entry = {
            "ts": datetime.utcnow().isoformat(),
            "model": model,
            "task": task,
            "case_idx": case["case_idx"],
            "old_score": 0,
            "new_score": score,
            "judge_raw": judge_raw,
            "judge_error": error,
            "judge_rerun": True,
        }
        with open(log_path, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        if error:
            print(f"  ERROR {model} {task} case {case['case_idx']}: {error}")
            errors += 1
            # Update JSON with error flag but do NOT write score 0
            case["data"]["judge_error"] = error
            case["data"]["judge_rerun"] = True
            atomic_write_json(case["filepath"], case["data"])
            continue

        # Update JSON
        case["data"]["score"] = score
        case["data"]["judge_rerun"] = True
        case["data"]["judge_raw"] = judge_raw
        atomic_write_json(case["filepath"], case["data"])

        # Update CSV
        update_csv(csv_path, model, task, case["case_idx"], score)

        success += 1

        if (i + 1) % 50 == 0:
            print(f"  Progress: {i+1}/{len(cases)} ({success} OK, {errors} errors)")

        # Small delay to avoid rate limits
        time.sleep(0.1)

    print(f"\nDone. {success} re-judged, {errors} errors, {skipped} skipped.")
    print(f"Log: {log_path}")


if __name__ == "__main__":
    main()
