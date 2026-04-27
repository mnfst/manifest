#!/usr/bin/env python3
"""
TaskBench Analysis — generates paper-ready figures and tables from benchmark CSV.

Outputs:
  results/figures/pareto_<task>.png     — Per-task Pareto frontier (cost vs quality)
  results/figures/heatmap.png           — Cross-task quality heatmap
  results/figures/cheapest_adequate.png — Bar chart of cheapest adequate model per task
  results/analysis_report.md            — Markdown summary with all findings

Usage:
    python scripts/analyze_costs.py
"""

import csv
import os
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import numpy as np


# --- Price classes ---
PRICE_CLASSES = {
    "Premium":  (5.0, float("inf")),
    "Standard": (1.0, 5.0),
    "Economy":  (0.1, 1.0),
    "Micro":    (0.0, 0.1),
}

PRICE_CLASS_COLORS = {
    "Premium": "#e74c3c",
    "Standard": "#f39c12",
    "Economy": "#27ae60",
    "Micro": "#3498db",
}

# Short display names for models
MODEL_SHORT = {
    "Llama-4-Scout-17B-16E-Instruct": "Llama-4-Scout",
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "grok-4-20-non-reasoning": "Grok-4",
    "grok-4-20-reasoning": "Grok-4-R",
    "gpt-5.1-chat": "GPT-5.1",
    "mistral-medium-2505": "Mistral Medium",
    "Codestral-2501": "Codestral",
    "MiniMax-M2.7": "MiniMax M2.7",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "DeepSeek-V3.2": "DeepSeek V3.2",
    "DeepSeek-R1": "DeepSeek R1",
    "Kimi-K2.6": "Kimi K2.6",
}


def short_name(model):
    return MODEL_SHORT.get(model, model)


def load_csv(path):
    """Load benchmark_results.csv into structured data."""
    data = defaultdict(lambda: defaultdict(lambda: {"scores": [], "costs": [], "input_price": 0}))
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            task = row["task"]
            model = row["model"]
            data[task][model]["scores"].append(float(row["score"]))
            data[task][model]["costs"].append(float(row["cost_usd"]))
            data[task][model]["input_price"] = float(row["input_price_per_m"])
    return data


def get_price_class(input_price):
    for cls, (low, high) in PRICE_CLASSES.items():
        if low <= input_price < high:
            return cls
    return "Unknown"


def compute_pareto_frontier(points):
    """Given list of (cost, quality), return Pareto-optimal points (min cost for max quality)."""
    sorted_pts = sorted(points, key=lambda p: p[0])
    frontier = []
    max_quality = -1
    for cost, quality in sorted_pts:
        if quality > max_quality:
            frontier.append((cost, quality))
            max_quality = quality
    return frontier


def plot_pareto(task, models, fig_dir):
    """Plot Pareto frontier for one task."""
    fig, ax = plt.subplots(figsize=(10, 6))

    points_for_frontier = []
    for model, d in models.items():
        avg_score = sum(d["scores"]) / len(d["scores"])
        avg_cost = sum(d["costs"]) / len(d["costs"])
        pc = get_price_class(d["input_price"])
        color = PRICE_CLASS_COLORS.get(pc, "#999")

        ax.scatter(avg_cost * 1000, avg_score, c=color, s=100, zorder=5, edgecolors="white", linewidth=0.5)
        ax.annotate(short_name(model), (avg_cost * 1000, avg_score),
                    textcoords="offset points", xytext=(5, 5), fontsize=7, alpha=0.85)
        points_for_frontier.append((avg_cost * 1000, avg_score, model))

    # Draw Pareto frontier
    frontier = compute_pareto_frontier([(c, q) for c, q, _ in points_for_frontier])
    if len(frontier) > 1:
        fx, fy = zip(*frontier)
        ax.plot(fx, fy, "k--", alpha=0.4, linewidth=1.5, label="Pareto frontier")

    # Legend for price classes
    for cls, color in PRICE_CLASS_COLORS.items():
        ax.scatter([], [], c=color, s=60, label=cls)
    ax.legend(loc="lower right", fontsize=8)

    ax.set_xlabel("Cost per query (millicents $)", fontsize=11)
    ax.set_ylabel("Average quality score (1-5)", fontsize=11)
    ax.set_title(f"TaskBench: {task}", fontsize=13, fontweight="bold")
    ax.set_ylim(0, 5.5)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(f"{fig_dir}/pareto_{task}.png", dpi=150)
    plt.close(fig)


def plot_heatmap(data, fig_dir):
    """Cross-task quality heatmap."""
    tasks = sorted(data.keys())
    all_models = set()
    for task in tasks:
        all_models.update(data[task].keys())

    # Sort models by average score across all tasks (descending)
    model_avg = {}
    for model in all_models:
        scores = []
        for task in tasks:
            if model in data[task]:
                d = data[task][model]
                scores.append(sum(d["scores"]) / len(d["scores"]))
        model_avg[model] = sum(scores) / len(scores) if scores else 0
    models = sorted(all_models, key=lambda m: -model_avg[m])

    # Build matrix
    matrix = np.full((len(tasks), len(models)), np.nan)
    for i, task in enumerate(tasks):
        for j, model in enumerate(models):
            if model in data[task]:
                d = data[task][model]
                matrix[i, j] = sum(d["scores"]) / len(d["scores"])

    fig, ax = plt.subplots(figsize=(max(14, len(models) * 0.8), max(8, len(tasks) * 0.5)))

    cmap = plt.cm.RdYlGn
    cmap.set_bad(color="lightgray")
    im = ax.imshow(matrix, cmap=cmap, vmin=0, vmax=5, aspect="auto")

    ax.set_xticks(range(len(models)))
    ax.set_xticklabels([short_name(m) for m in models], rotation=45, ha="right", fontsize=8)
    ax.set_yticks(range(len(tasks)))
    ax.set_yticklabels(tasks, fontsize=9)

    # Add score text
    for i in range(len(tasks)):
        for j in range(len(models)):
            val = matrix[i, j]
            if not np.isnan(val):
                color = "white" if val < 2.5 else "black"
                ax.text(j, i, f"{val:.1f}", ha="center", va="center", fontsize=7, color=color)

    plt.colorbar(im, label="Quality Score (1-5)", shrink=0.8)
    ax.set_title("TaskBench: Cross-Task Quality Heatmap", fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(f"{fig_dir}/heatmap.png", dpi=150)
    plt.close(fig)


def plot_cheapest_adequate(data, fig_dir):
    """Bar chart: cheapest model achieving >=90% of max quality, per task."""
    tasks = sorted(data.keys())
    results = []

    for task in tasks:
        models = data[task]
        best_score = max(sum(d["scores"]) / len(d["scores"]) for d in models.values())
        threshold = best_score * 0.9
        adequate = []
        for model, d in models.items():
            avg = sum(d["scores"]) / len(d["scores"])
            cost = sum(d["costs"]) / len(d["costs"])
            if avg >= threshold:
                adequate.append((model, avg, cost))
        if adequate:
            cheapest = min(adequate, key=lambda x: x[2])
            most_expensive = max(adequate, key=lambda x: x[2])
            savings = (1 - cheapest[2] / most_expensive[2]) * 100 if most_expensive[2] > 0 else 0
            results.append({
                "task": task,
                "model": cheapest[0],
                "score": cheapest[1],
                "cost": cheapest[2],
                "savings": savings,
                "vs_model": most_expensive[0],
                "vs_cost": most_expensive[2],
            })

    fig, ax = plt.subplots(figsize=(12, 6))
    x = range(len(results))
    colors = []
    for r in results:
        pc = get_price_class(data[r["task"]][r["model"]]["input_price"])
        colors.append(PRICE_CLASS_COLORS.get(pc, "#999"))

    bars = ax.bar(x, [r["cost"] * 1000 for r in results], color=colors, edgecolor="white")

    ax.set_xticks(x)
    ax.set_xticklabels([r["task"] for r in results], rotation=45, ha="right", fontsize=8)
    ax.set_ylabel("Cost per query (millicents $)", fontsize=11)
    ax.set_title("Cheapest Adequate Model per Task (>=90% of max quality)", fontsize=12, fontweight="bold")

    for i, (bar, r) in enumerate(zip(bars, results)):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
                f"{short_name(r['model'])}\n{r['score']:.1f}/5",
                ha="center", va="bottom", fontsize=7)

    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(f"{fig_dir}/cheapest_adequate.png", dpi=150)
    plt.close(fig)
    return results


def plot_cost_efficiency(data, fig_dir):
    """Scatter: quality vs cost per model, averaged across all tasks."""
    model_totals = defaultdict(lambda: {"scores": [], "costs": [], "input_price": 0})
    for task, models in data.items():
        for model, d in models.items():
            avg_s = sum(d["scores"]) / len(d["scores"])
            avg_c = sum(d["costs"]) / len(d["costs"])
            model_totals[model]["scores"].append(avg_s)
            model_totals[model]["costs"].append(avg_c)
            model_totals[model]["input_price"] = d["input_price"]

    fig, ax = plt.subplots(figsize=(10, 7))
    for model, d in model_totals.items():
        avg_score = sum(d["scores"]) / len(d["scores"])
        avg_cost = sum(d["costs"]) / len(d["costs"])
        pc = get_price_class(d["input_price"])
        color = PRICE_CLASS_COLORS.get(pc, "#999")
        ax.scatter(avg_cost * 1000, avg_score, c=color, s=120, zorder=5, edgecolors="white", linewidth=0.5)
        ax.annotate(short_name(model), (avg_cost * 1000, avg_score),
                    textcoords="offset points", xytext=(6, 4), fontsize=8)

    for cls, color in PRICE_CLASS_COLORS.items():
        ax.scatter([], [], c=color, s=60, label=cls)
    ax.legend(loc="lower right", fontsize=9)

    ax.set_xlabel("Avg cost per query across all tasks (millicents $)", fontsize=11)
    ax.set_ylabel("Avg quality score across all tasks (1-5)", fontsize=11)
    ax.set_title("TaskBench: Overall Cost-Efficiency by Model", fontsize=13, fontweight="bold")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(f"{fig_dir}/cost_efficiency_overall.png", dpi=150)
    plt.close(fig)


def generate_report(data, cheapest_results, report_path):
    """Generate markdown analysis report."""
    lines = ["# TaskBench Analysis Report\n"]
    lines.append(f"Generated from {sum(sum(len(d['scores']) for d in models.values()) for models in data.values())} data points\n")

    # Overall stats
    total_spend = sum(sum(sum(d["costs"]) for d in models.values()) for models in data.values())
    all_models = set(m for models in data.values() for m in models)
    lines.append(f"- **Tasks:** {len(data)}")
    lines.append(f"- **Models:** {len(all_models)}")
    lines.append(f"- **Total API spend:** ${total_spend:.2f}\n")

    # Cheapest adequate model table
    lines.append("## Cheapest Adequate Model per Task (>=90% of max quality)\n")
    lines.append("| Task | Cheapest Model | Score | Cost/query | vs Most Expensive | Savings |")
    lines.append("|------|---------------|-------|-----------|-------------------|---------|")
    for r in cheapest_results:
        lines.append(f"| {r['task']} | {short_name(r['model'])} | {r['score']:.1f}/5 | ${r['cost']:.6f} | {short_name(r['vs_model'])} (${r['vs_cost']:.4f}) | {r['savings']:.0f}% |")

    # Price class analysis
    lines.append("\n## Quality by Price Class\n")
    class_scores = defaultdict(list)
    for task, models in data.items():
        for model, d in models.items():
            pc = get_price_class(d["input_price"])
            avg = sum(d["scores"]) / len(d["scores"])
            class_scores[pc].append(avg)

    lines.append("| Price Class | Avg Quality | Min | Max | Models |")
    lines.append("|------------|-------------|-----|-----|--------|")
    for cls in ["Premium", "Standard", "Economy", "Micro"]:
        if cls in class_scores:
            scores = class_scores[cls]
            lines.append(f"| {cls} | {sum(scores)/len(scores):.2f}/5 | {min(scores):.1f} | {max(scores):.1f} | {len(scores)} entries |")

    # Surprise findings
    lines.append("\n## Surprise Findings\n")
    lines.append("Cases where cheap models match or beat expensive ones:\n")
    for task, models in sorted(data.items()):
        scored = []
        for model, d in models.items():
            avg = sum(d["scores"]) / len(d["scores"])
            cost = sum(d["costs"]) / len(d["costs"])
            pc = get_price_class(d["input_price"])
            scored.append((model, avg, cost, pc))

        # Find Economy/Micro models that match Premium/Standard
        premium_best = max((s for s in scored if s[3] in ("Premium", "Standard")), key=lambda x: x[1], default=None)
        if premium_best:
            for model, avg, cost, pc in scored:
                if pc in ("Economy", "Micro") and avg >= premium_best[1] * 0.95:
                    ratio = premium_best[2] / cost if cost > 0 else float("inf")
                    if ratio > 5:
                        lines.append(f"- **{task}**: {short_name(model)} ({pc}, ${cost:.4f}) matches {short_name(premium_best[0])} ({premium_best[3]}, ${premium_best[2]:.4f}) at {ratio:.0f}x less cost")

    lines.append("\n## Figures\n")
    lines.append("- `figures/heatmap.png` — Cross-task quality heatmap")
    lines.append("- `figures/cost_efficiency_overall.png` — Overall cost vs quality scatter")
    lines.append("- `figures/cheapest_adequate.png` — Cheapest adequate model per task")
    lines.append("- `figures/pareto_<task>.png` — Per-task Pareto frontiers")

    with open(report_path, "w") as f:
        f.write("\n".join(lines))


def main():
    os.chdir(Path(__file__).parent.parent)
    csv_path = "results/benchmark_results.csv"
    fig_dir = "results/figures"
    os.makedirs(fig_dir, exist_ok=True)

    if not os.path.exists(csv_path):
        print("No benchmark_results.csv found. Run the benchmark first.")
        sys.exit(1)

    print("Loading data...")
    data = load_csv(csv_path)
    print(f"Loaded {len(data)} tasks, {len(set(m for t in data.values() for m in t))} models")

    # Filter out models with very few results (gemini-2.0-flash rate limited)
    for task in list(data.keys()):
        for model in list(data[task].keys()):
            if len(data[task][model]["scores"]) < 3:
                del data[task][model]

    print("\nGenerating Pareto plots...")
    for task in sorted(data.keys()):
        plot_pareto(task, data[task], fig_dir)
        print(f"  {task}: {len(data[task])} models")

    print("\nGenerating heatmap...")
    plot_heatmap(data, fig_dir)

    print("\nGenerating cheapest adequate chart...")
    cheapest = plot_cheapest_adequate(data, fig_dir)

    print("\nGenerating overall cost-efficiency scatter...")
    plot_cost_efficiency(data, fig_dir)

    print("\nGenerating report...")
    generate_report(data, cheapest, "results/analysis_report.md")

    print(f"\nDone! Outputs in results/figures/ and results/analysis_report.md")
    print(f"\nKey findings:")
    for r in cheapest:
        print(f"  {r['task']}: {short_name(r['model'])} ({r['score']:.1f}/5, ${r['cost']:.6f}/q, saves {r['savings']:.0f}% vs {short_name(r['vs_model'])})")


if __name__ == "__main__":
    main()
