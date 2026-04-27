# TaskBench

**Cost-Quality Tradeoffs Across Production LLM Tasks**

A benchmark comparing LLM model cost vs quality across specific production tasks. For each task, we identify which model gives the best cost-to-quality ratio.

## Quick Start

```bash
# Install promptfoo
npm install -g promptfoo

# Set your API key
export OPENAI_API_KEY=sk-...

# Run the validation (3 tasks x 3 models x 5 queries)
./run-validation.sh

# View results in browser
promptfoo view

# Or analyze costs
python scripts/analyze_costs.py results/
```

## Tasks

| # | Task | Eval Method |
|---|------|-------------|
| 1 | Intent Classification | Exact match |
| 2 | Email Summarization | LLM-as-judge (1-5) |
| 3 | SQL Generation | LLM-as-judge (1-5) |

## Models

| Model | Price Class | Input $/M tokens |
|-------|------------|-------------------|
| GPT-4o | Standard | $2.50 |
| GPT-4o-mini | Economy | $0.15 |
| GPT-3.5-Turbo | Economy | $0.50 |

## Project Structure

```
benchmark/
  tasks/                    # promptfoo configs per task
  datasets/                 # raw test cases (JSONL)
  scripts/                  # analysis scripts
  results/                  # promptfoo output (gitignored)
  run-validation.sh         # run the benchmark
```
