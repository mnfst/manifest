#!/bin/bash
# TaskBench Validation Run
# Runs 3 tasks x 3 models x 5 queries = 45 API calls
# Estimated cost: $0.50-2.00
#
# Prerequisites:
#   npm install -g promptfoo
#   export OPENAI_API_KEY=sk-...
#
# Optional (add more models):
#   export ANTHROPIC_API_KEY=sk-ant-...
#   export GOOGLE_API_KEY=...

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check prerequisites
if ! command -v promptfoo &> /dev/null; then
    echo "promptfoo not found. Install with: npm install -g promptfoo"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "OPENAI_API_KEY not set. Export it first:"
    echo "  export OPENAI_API_KEY=sk-..."
    exit 1
fi

echo "=== TaskBench Validation Run ==="
echo "3 tasks x 3 models x 5 queries = 45 API calls"
echo "Estimated cost: \$0.50-2.00"
echo ""

mkdir -p results

# Run each task
for task in tasks/intent_classification.yaml tasks/email_summarization.yaml tasks/sql_generation.yaml; do
    TASK_NAME=$(basename "$task" .yaml)
    echo "--- Running: $TASK_NAME ---"
    promptfoo eval -c "$task" --no-cache
    echo "Results saved to results/${TASK_NAME}.json"
    echo ""
done

echo "=== All tasks complete ==="
echo ""
echo "View results in browser:"
echo "  promptfoo view"
echo ""
echo "Or analyze with the notebook:"
echo "  jupyter notebook analyze.ipynb"
