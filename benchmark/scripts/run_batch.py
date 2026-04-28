#!/usr/bin/env python3
"""
TaskBench Batch Runner v2 — runs a single task across all available models.
Loads cases from JSONL datasets, supports resume, budget tracking, and
dual metrics (LLM-judge + native accuracy).

Usage:
    python scripts/run_batch.py --task sentiment_sst2
    python scripts/run_batch.py --task sentiment_sst2 --models claude-opus-4-7,gpt-4o-mini
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from pathlib import Path
from datetime import datetime


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


# --- Budget ---
BUDGET_LIMIT_USD = 200.0
SPEND_FILE = "results/spend_tracker.json"

# --- Reasoning models ---
REASONING_MODELS = {
    "DeepSeek-R1", "o4-mini", "grok-4-20-reasoning", "gpt-5.1-chat",
    "Kimi-K2.6", "gemini-2.5-pro", "MiniMax-M2.7", "claude-opus-4-7",
    "Phi-4-reasoning", "qwen3-32b",
}

# Models that don't support temperature parameter
NO_TEMPERATURE_MODELS = {"claude-opus-4-7", "DeepSeek-R1", "o4-mini",
                         "grok-4-20-reasoning", "gpt-5.1-chat", "Phi-4-reasoning"}


def strip_thinking(text):
    return re.sub(r"<think>.*?</think>\s*", "", text, flags=re.DOTALL).strip()


def effective_max_tokens(model_name, requested):
    if model_name in REASONING_MODELS:
        return max(requested, 2000)
    return requested


# --- Model registry ---
MODELS = {
    # Anthropic (direct)
    "claude-opus-4-7": {
        "provider": "anthropic", "input_price": 15.00, "output_price": 75.00,
    },
    "claude-sonnet-4-20250514": {
        "provider": "anthropic", "input_price": 3.00, "output_price": 15.00,
    },
    "claude-haiku-4-5-20251001": {
        "provider": "anthropic", "input_price": 0.80, "output_price": 4.00,
    },
    # OpenAI (direct)
    "gpt-4o": {
        "provider": "openai", "input_price": 2.50, "output_price": 10.00,
    },
    "gpt-4o-mini": {
        "provider": "openai", "input_price": 0.15, "output_price": 0.60,
    },
    # Gemini (direct)
    "gemini-2.5-pro": {
        "provider": "gemini", "input_price": 1.25, "output_price": 10.00,
    },
    "gemini-2.5-flash": {
        "provider": "gemini", "input_price": 0.15, "output_price": 0.60,
    },
    "gemini-2.0-flash": {
        "provider": "gemini", "input_price": 0.10, "output_price": 0.40,
    },
    # MiniMax (direct)
    "MiniMax-M2.7": {
        "provider": "minimax", "input_price": 1.10, "output_price": 4.40,
    },
    # Mistral (direct)
    "mistral-large-latest": {
        "provider": "mistral", "input_price": 2.00, "output_price": 6.00,
    },
    "mistral-medium-latest": {
        "provider": "mistral", "input_price": 0.40, "output_price": 2.00,
    },
    "mistral-small-latest": {
        "provider": "mistral", "input_price": 0.10, "output_price": 0.30,
    },
    "ministral-3b-latest": {
        "provider": "mistral", "input_price": 0.04, "output_price": 0.04,
    },
    # Moonshot/Kimi (direct) — auth issue pending
    "kimi-latest": {
        "provider": "moonshot", "input_price": 0.60, "output_price": 2.40,
    },
    # Azure models (re-added when Azure is back)
    "DeepSeek-V3.2": {"provider": "azure", "input_price": 0.30, "output_price": 1.10},
    "DeepSeek-R1": {"provider": "azure", "input_price": 0.55, "output_price": 2.19},
    "gpt-5.1-chat": {"provider": "azure", "input_price": 2.00, "output_price": 8.00},
    "o4-mini": {"provider": "azure", "input_price": 1.10, "output_price": 4.40},
    "grok-4-20-non-reasoning": {"provider": "azure", "input_price": 2.00, "output_price": 8.00},
    "grok-4-20-reasoning": {"provider": "azure", "input_price": 2.00, "output_price": 8.00},
    "Kimi-K2.6": {"provider": "azure", "input_price": 0.60, "output_price": 2.40},
    "Llama-4-Scout-17B-16E-Instruct": {"provider": "azure", "input_price": 0.17, "output_price": 0.17},
    "mistral-medium-2505": {"provider": "azure", "input_price": 0.40, "output_price": 2.00},
    "Codestral-2501": {"provider": "azure", "input_price": 0.30, "output_price": 0.90},
    # New Azure models (when available)
    "gpt-5.5-2026-04-24": {"provider": "azure", "input_price": 5.00, "output_price": 20.00},
    "Mistral-Large-3": {"provider": "azure", "input_price": 2.00, "output_price": 6.00},
    "qwen3-32b": {"provider": "azure", "input_price": 0.30, "output_price": 0.90},
    "Llama-3.3-70B-Instruct": {"provider": "azure", "input_price": 0.27, "output_price": 0.27},
    "gpt-4.1-nano": {"provider": "azure", "input_price": 0.10, "output_price": 0.40},
    "Phi-4-reasoning": {"provider": "azure", "input_price": 0.10, "output_price": 0.40},
    "mistral-small-2503": {"provider": "azure", "input_price": 0.10, "output_price": 0.40},
    "Ministral-3B": {"provider": "azure", "input_price": 0.04, "output_price": 0.12},
}


# --- Task definitions ---
TASK_DEFS = {
    "sentiment_sst2": {
        "dataset": "datasets/sst2_sentiment.jsonl",
        "prompt_template": 'Classify the sentiment of the following text as exactly one of: positive, negative\n\nRespond with ONLY the sentiment label, nothing else.\n\nText: "{input}"',
        "eval_type": "exact",
        "max_output_tokens": 20,
        "judge_prompt": None,
        "native_metric": "accuracy",
    },
    "reasoning_gsm8k": {
        "dataset": "datasets/gsm8k_reasoning.jsonl",
        "prompt_template": "Solve the following math problem step by step. After your reasoning, write your final numerical answer on the last line in this exact format:\nANSWER: <number>\n\nProblem: {input}",
        "eval_type": "llm_judge",
        "max_output_tokens": 800,
        "judge_prompt": "Rate the answer on a 1-5 scale. 5=completely correct final answer with sound reasoning. 4=correct answer with minor reasoning gaps. 3=partially correct. 2=wrong answer but some correct steps. 1=completely wrong. Respond with ONLY a number 1-5.",
        "native_metric": "exact_answer",  # extract number after ANSWER: and compare to expected
    },
    "intent_clinc150": {
        "dataset": "datasets/clinc150_intent.jsonl",
        "prompt_template": 'Classify the following user message into exactly one intent from this list:\naccept_reservations, account_blocked, alarm, application_status, apr, are_you_a_bot, balance, bill_balance, bill_due, book_flight, book_hotel, calculator, calendar, calendar_update, calories, cancel, cancel_reservation, car_rental, card_declined, carry_on, change_accent, change_ai_name, change_language, change_speed, change_user_name, change_volume, confirm_reservation, cook_time, credit_limit, credit_limit_change, credit_score, current_location, damaged_card, date, definition, direct_deposit, directions, discount, do_you_have_pets, exchange_rate, expiration_date, find_phone, flight_status, flip_coin, food_last, freeze_account, fun_fact, gas, gas_type, goodbye, greeting, how_busy, how_old_are_you, improve_credit_score, income, ingredients_list, insurance, insurance_change, interest_rate, international_fees, international_visa, jump_start, last_maintenance, lost_luggage, make_call, meal_suggestion, meaning_of_life, measurement_conversion, meeting_schedule, min_payment, mpg, new_card, next_holiday, next_song, no, nutrition_info, oil_change_how, oil_change_when, order, order_checks, order_status, pay_bill, payday, pin_change, play_music, plug_type, pto_balance, pto_request, pto_used, recipe, redeem_rewards, remind, remind_update, repeat, replacement_card_duration, report_fraud, report_lost_card, reset_settings, restaurant_reviews, restaurant_suggestion, rewards_balance, roll_dice, rollover_401k, routing, schedule_maintenance, schedule_meeting, share_location, shopping_list, shopping_list_update, smart_home, spending_history, spell_word, sync_device, taxes, tell_joke, text, thank_you, time, timer, timezone, tire_change, tire_pressure, todo_list, todo_list_update, traffic, transactions, transfer, translate, travel_alert, travel_notification, travel_suggestion, uber, update_playlist, user_name, vaccines, w2, weather, what_are_your_hobbies, what_can_i_ask_you, what_is_your_name, what_song, where_are_you_from, whisper_mode, who_do_you_work_for, who_made_you, yes\n\nRespond with ONLY the intent label, nothing else.\n\nMessage: "{input}"',
        "eval_type": "exact",
        "max_output_tokens": 20,
        "judge_prompt": None,
        "native_metric": "accuracy",
    },
}


# --- API callers ---
def call_openai(model, messages, max_tokens):
    import requests as req
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0}
    resp = req.post(url, json=body, headers=headers, timeout=120)
    return resp.json()


def call_anthropic(model, messages, max_tokens):
    import requests as req
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "Content-Type": "application/json", "anthropic-version": "2023-06-01"}
    body = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if model not in NO_TEMPERATURE_MODELS:
        body["temperature"] = 0
    resp = req.post(url, json=body, headers=headers, timeout=180)
    data = resp.json()
    if "error" in data:
        return {"error": data["error"].get("message", str(data["error"]))}
    content = data.get("content", [{}])[0].get("text", "")
    usage = data.get("usage", {})
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {"prompt_tokens": usage.get("input_tokens", 0), "completion_tokens": usage.get("output_tokens", 0)},
    }


def call_gemini(model, messages, max_tokens):
    import requests as req
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    headers = {"Authorization": f"Bearer {os.environ['GEMINI_API_KEY']}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "temperature": 0, "max_completion_tokens": 8192}
    resp = req.post(url, json=body, headers=headers, timeout=180)
    data = resp.json()
    if isinstance(data, list):
        return {"error": data[0].get("error", {}).get("message", str(data))}
    return data


def call_minimax(model, messages, max_tokens):
    import requests as req
    url = "https://api.minimaxi.chat/v1/chat/completions"
    headers = {"Authorization": f"Bearer {os.environ['MINIMAX_API_KEY']}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "max_tokens": max(max_tokens, 500), "temperature": 0}
    resp = req.post(url, json=body, headers=headers, timeout=180)
    return resp.json()


def call_mistral(model, messages, max_tokens):
    """Call Mistral API (OpenAI-compatible)."""
    import requests as req
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {os.environ['MISTRAL_API_KEY']}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0}
    resp = req.post(url, json=body, headers=headers, timeout=180)
    return resp.json()


def call_moonshot(model, messages, max_tokens):
    """Call Moonshot/Kimi API (OpenAI-compatible)."""
    import requests as req
    url = "https://api.moonshot.cn/v1/chat/completions"
    headers = {"Authorization": f"Bearer {os.environ['MOONSHOT_API_KEY']}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0}
    resp = req.post(url, json=body, headers=headers, timeout=180)
    return resp.json()


def call_azure(model, messages, max_tokens):
    import requests as req
    endpoint = os.environ.get("AZURE_ENDPOINT", "")
    if not endpoint:
        return {"error": "AZURE_ENDPOINT not set"}
    url = f"{endpoint}chat/completions"
    headers = {"api-key": os.environ["AZURE_API_KEY"], "Content-Type": "application/json"}
    mtp = "max_completion_tokens" if model in ("o4-mini", "gpt-5.1-chat") else "max_tokens"
    body = {"model": model, "messages": messages, mtp: max_tokens}
    if model not in NO_TEMPERATURE_MODELS:
        body["temperature"] = 0
    resp = req.post(url, json=body, headers=headers, timeout=180)
    return resp.json()


def call_model(model_name, messages, max_tokens):
    config = MODELS[model_name]
    provider = config["provider"]
    mt = effective_max_tokens(model_name, max_tokens)
    if provider == "openai":
        return call_openai(model_name, messages, mt)
    elif provider == "anthropic":
        return call_anthropic(model_name, messages, mt)
    elif provider == "gemini":
        return call_gemini(model_name, messages, mt)
    elif provider == "minimax":
        return call_minimax(model_name, messages, mt)
    elif provider == "mistral":
        return call_mistral(model_name, messages, mt)
    elif provider == "moonshot":
        return call_moonshot(model_name, messages, mt)
    elif provider == "azure":
        return call_azure(model_name, messages, mt)
    return {"error": f"Unknown provider: {provider}"}


def compute_cost(model_name, response):
    config = MODELS[model_name]
    usage = response.get("usage", {})
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    cost = (input_tokens * config["input_price"] + output_tokens * config["output_price"]) / 1_000_000
    return cost, input_tokens, output_tokens


def judge_response(response_text, original_input, judge_prompt):
    messages = [
        {"role": "system", "content": "You are an evaluation judge. " + judge_prompt},
        {"role": "user", "content": f"Input: {original_input[:500]}\n\nResponse to evaluate:\n{response_text[:1000]}"},
    ]
    result = call_openai("gpt-4o-mini", messages, 5)
    if "error" in result:
        return 0
    text = result.get("choices", [{}])[0].get("message", {}).get("content", "0")
    try:
        return int("".join(c for c in text if c.isdigit())[:1])
    except (ValueError, IndexError):
        return 0


# --- Spend tracking ---
def load_spend():
    if os.path.exists(SPEND_FILE):
        with open(SPEND_FILE) as f:
            return json.load(f)
    return {"total_usd": 0.0, "calls": 0}


def save_spend(spend):
    with open(SPEND_FILE, "w") as f:
        json.dump(spend, f)


# --- Resume logic ---
def load_completed(results_file, task_name):
    completed = set()
    if os.path.exists(results_file):
        with open(results_file, newline="") as f:
            reader = csv.DictReader(f)
            pair_counts = {}
            for row in reader:
                if row["task"] != task_name:
                    continue
                key = row["model"]
                pair_counts[key] = pair_counts.get(key, 0) + 1
            # Need to know expected case count to mark complete
            return pair_counts
    return {}


# --- Check provider availability ---
def is_provider_available(provider):
    """Quick check if a provider's API key is configured."""
    key_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "minimax": "MINIMAX_API_KEY",
        "mistral": "MISTRAL_API_KEY",
        "moonshot": "MOONSHOT_API_KEY",
        "azure": "AZURE_API_KEY",
    }
    env_var = key_map.get(provider, "")
    return bool(os.environ.get(env_var, ""))


def test_provider(provider):
    """Test if a provider is actually responding (not just configured)."""
    try:
        if provider == "azure":
            result = call_azure("DeepSeek-V3.2", [{"role": "user", "content": "hi"}], 5)
        elif provider == "openai":
            result = call_openai("gpt-4o-mini", [{"role": "user", "content": "hi"}], 5)
        elif provider == "anthropic":
            result = call_anthropic("claude-haiku-4-5-20251001", [{"role": "user", "content": "hi"}], 5)
        elif provider == "gemini":
            result = call_gemini("gemini-2.5-flash", [{"role": "user", "content": "hi"}], 5)
        elif provider == "minimax":
            result = call_minimax("MiniMax-M2.7", [{"role": "user", "content": "hi"}], 5)
        else:
            return False
        return "error" not in result and "choices" in result
    except Exception:
        return False


# --- Main ---
def main():
    parser = argparse.ArgumentParser(description="TaskBench batch runner")
    parser.add_argument("--task", required=True, help="Task ID (e.g., sentiment_sst2)")
    parser.add_argument("--models", help="Comma-separated model list (default: all available)")
    parser.add_argument("--skip-azure", action="store_true", help="Skip Azure models (when Azure is down)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run without calling APIs")
    args = parser.parse_args()

    os.chdir(Path(__file__).parent.parent)
    os.makedirs("results/raw", exist_ok=True)

    if args.task not in TASK_DEFS:
        print(f"Unknown task: {args.task}")
        print(f"Available: {', '.join(TASK_DEFS.keys())}")
        sys.exit(1)

    task_def = TASK_DEFS[args.task]
    task_name = args.task

    # Load cases from dataset
    cases = []
    with open(task_def["dataset"]) as f:
        for line in f:
            cases.append(json.loads(line))
    n_cases = len(cases)

    # Determine which models to run
    if args.models:
        model_names = [m.strip() for m in args.models.split(",")]
    else:
        model_names = list(MODELS.keys())

    # Filter by provider availability
    available_models = []
    skipped_providers = set()
    for m in model_names:
        provider = MODELS[m]["provider"]
        if args.skip_azure and provider == "azure":
            skipped_providers.add("azure")
            continue
        if not is_provider_available(provider):
            skipped_providers.add(provider)
            continue
        available_models.append(m)

    # Check resume state
    results_file = "results/benchmark_results.csv"
    completed_counts = load_completed(results_file, task_name)
    models_to_run = []
    for m in available_models:
        done = completed_counts.get(m, 0)
        if done >= n_cases:
            continue  # Already complete
        models_to_run.append(m)

    spend = load_spend()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Ensure CSV header exists
    if not os.path.exists(results_file):
        with open(results_file, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "task", "case_idx", "model", "provider", "input_price_per_m",
                "output_price_per_m", "input_tokens", "output_tokens", "cost_usd",
                "score", "eval_type", "response_preview"
            ])

    print(f"{'='*70}")
    print(f"TaskBench Batch: {task_name}")
    print(f"Cases: {n_cases} | Models to run: {len(models_to_run)} | Already done: {len(available_models) - len(models_to_run)}")
    if skipped_providers:
        print(f"Skipped providers (unavailable): {', '.join(skipped_providers)}")
    print(f"Budget: ${spend['total_usd']:.4f} / ${BUDGET_LIMIT_USD:.0f}")
    print(f"{'='*70}\n")

    if args.dry_run:
        print("DRY RUN — would run these models:")
        for m in models_to_run:
            print(f"  {m} ({MODELS[m]['provider']}, ${MODELS[m]['input_price']}/M input)")
        print(f"\nEstimated calls: {len(models_to_run) * n_cases}")
        return

    # Run benchmark
    all_scores = {}  # model -> list of (score, expected, predicted)
    for model_name in models_to_run:
        if spend["total_usd"] >= BUDGET_LIMIT_USD:
            print(f"\n*** BUDGET LIMIT REACHED: ${spend['total_usd']:.2f} ***")
            break

        model_config = MODELS[model_name]
        model_scores = []
        model_cost = 0.0
        model_correct = 0

        for case_idx, case in enumerate(cases):
            prompt = task_def["prompt_template"].format(**case)
            messages = [{"role": "user", "content": prompt}]

            try:
                response = call_model(model_name, messages, task_def["max_output_tokens"])
            except Exception as e:
                print(f"  ERROR {model_name} case {case_idx}: {e}")
                continue

            if "error" in response:
                err = response["error"]
                if isinstance(err, dict):
                    err = err.get("message", str(err))
                print(f"  ERROR {model_name} case {case_idx}: {str(err)[:80]}")
                continue

            choices = response.get("choices", [])
            if not choices:
                continue
            response_text = choices[0].get("message", {}).get("content", "") or ""
            response_text = strip_thinking(response_text)

            cost, in_tok, out_tok = compute_cost(model_name, response)
            spend["total_usd"] += cost
            spend["calls"] += 1
            model_cost += cost

            # Evaluate
            if task_def["eval_type"] == "exact":
                expected = case.get("expected", "")
                clean = response_text.lower().strip()
                score = 5 if expected.lower() in clean else 0
                if expected.lower() in clean:
                    model_correct += 1
            elif task_def["eval_type"] == "llm_judge":
                score = judge_response(response_text, prompt, task_def["judge_prompt"])
                spend["total_usd"] += 0.0001
            else:
                score = 0

            # Native metric: exact_answer (extract number from ANSWER: line)
            if task_def.get("native_metric") == "exact_answer":
                expected_ans = case.get("expected_answer", "")
                # Try to extract number after ANSWER:
                ans_match = re.search(r'ANSWER:\s*\$?\s*([\d,]+(?:\.\d+)?)', response_text, re.IGNORECASE)
                if ans_match:
                    extracted = ans_match.group(1).replace(",", "")
                    if extracted == expected_ans.replace(",", ""):
                        model_correct += 1

            model_scores.append(score)

            # Write to CSV
            with open(results_file, "a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp, task_name, case_idx, model_name, model_config["provider"],
                    model_config["input_price"], model_config["output_price"],
                    in_tok, out_tok, f"{cost:.6f}",
                    score, task_def["eval_type"], response_text[:100].replace("\n", " ")
                ])

            # Save raw
            raw_file = f"results/raw/{task_name}_{model_name}_{case_idx}.json"
            with open(raw_file, "w") as f:
                json.dump({"model": model_name, "task": task_name, "case": case_idx,
                           "response": response_text, "score": score, "cost": cost,
                           "expected": case.get("expected", case.get("expected_answer", "")),
                           "tokens": {"input": in_tok, "output": out_tok}}, f, indent=2)

            save_spend(spend)

        # Print model summary
        if model_scores:
            avg = sum(model_scores) / len(model_scores)
            accuracy = model_correct / len(model_scores) * 100 if task_def.get("native_metric") in ("accuracy", "exact_answer") else None
            status = "PASS" if avg >= 4 else "MIXED" if avg >= 2.5 else "FAIL"
            acc_str = f"  acc={accuracy:.0f}%" if accuracy is not None else ""
            print(f"  {model_name:<42} avg={avg:.1f}/5{acc_str}  cost=${model_cost:.4f}  [{status}]")
            all_scores[model_name] = {"avg": avg, "accuracy": accuracy, "cost": model_cost, "n": len(model_scores)}
        else:
            print(f"  {model_name:<42} NO RESULTS")

        time.sleep(0.5)

    # Summary
    print(f"\n{'='*70}")
    print(f"BATCH COMPLETE: {task_name}")
    print(f"Total spend: ${spend['total_usd']:.4f} | Calls: {spend['calls']}")

    if all_scores:
        print(f"\n--- Results ranked by quality ---")
        for m in sorted(all_scores, key=lambda x: -all_scores[x]["avg"]):
            s = all_scores[m]
            acc_str = f"  acc={s['accuracy']:.0f}%" if s["accuracy"] is not None else ""
            print(f"  {m:<42} {s['avg']:.1f}/5{acc_str}  ${s['cost']:.4f}  ({s['n']} cases)")

        if any(s["accuracy"] is not None for s in all_scores.values()):
            print(f"\n--- Native metric (accuracy) ---")
            for m in sorted(all_scores, key=lambda x: -(all_scores[x].get("accuracy") or 0)):
                s = all_scores[m]
                if s["accuracy"] is not None:
                    print(f"  {m:<42} {s['accuracy']:.0f}%")

    print(f"{'='*70}")
    save_spend(spend)


if __name__ == "__main__":
    main()
