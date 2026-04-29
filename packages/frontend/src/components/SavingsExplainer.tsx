import { type Component } from 'solid-js';

interface SavingsExplainerProps {
  baselineModelName: string | null;
  onClose: () => void;
}

const SavingsExplainer: Component<SavingsExplainerProps> = (props) => {
  return (
    <div class="savings-explainer">
      <div class="savings-explainer__header">
        <button
          class="savings-explainer__back"
          onClick={props.onClose}
          type="button"
          aria-label="Back to Overview"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Overview
        </button>
      </div>

      <div class="savings-explainer__content">
        <h1>How savings are calculated</h1>

        <section class="savings-explainer__section">
          <h2>How it works</h2>
          <p>
            For each request, Manifest compares how much your request cost with what it would have
            cost using the most expensive model in your routing setup. That difference is what you
            saved.
          </p>
          <p>
            You can override which model is used for this comparison from the dropdown on the
            Overview page.
          </p>
          {props.baselineModelName && (
            <p>
              Current reference: <strong>{props.baselineModelName}</strong>.
            </p>
          )}
        </section>

        <section class="savings-explainer__section">
          <h2>Savings by access type</h2>

          <div class="savings-explainer__case">
            <h3>API key providers</h3>
            <p>
              You pay per token. Your saving is the difference between the most expensive model in
              your setup and the model that was actually used.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Subscription providers</h3>
            <p>
              Your per-request cost is $0 since the subscription covers usage, so your saving is the
              full cost of the most expensive model for those tokens. The subscription fee itself is
              not factored in.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Local models</h3>
            <p>
              Your per-request cost is $0, so your saving is the full cost of the most expensive
              model for those tokens.
            </p>
          </div>
        </section>

        <section class="savings-explainer__section">
          <h2>Examples</h2>

          <div class="savings-explainer__example">
            <div class="savings-explainer__example-title">Routing picks a cheap API model</div>
            <div class="savings-explainer__example-row">
              <span>Model actually used</span>
              <span>GPT-4.1 mini via API key</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>10,000 input, 2,000 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Cost of the most expensive model in setup (Claude Sonnet 4.5)</span>
              <span>$0.060</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.0028</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span class="savings-explainer__example-saved">$0.0572</span>
            </div>
          </div>

          <div class="savings-explainer__example">
            <div class="savings-explainer__example-title">Routing picks a subscription model</div>
            <div class="savings-explainer__example-row">
              <span>Model actually used</span>
              <span>Kimi k2.5 via subscription</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>25,000 input, 400 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Cost of the most expensive model in setup (Claude Opus 4.6)</span>
              <span>$0.382</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.00</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span class="savings-explainer__example-saved">$0.382</span>
            </div>
          </div>

          <div class="savings-explainer__example">
            <div class="savings-explainer__example-title">Routing picks a local model</div>
            <div class="savings-explainer__example-row">
              <span>Model actually used</span>
              <span>Qwen 3 32B via Ollama (local)</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>8,000 input, 3,000 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Cost of the most expensive model in setup (GPT-4.1)</span>
              <span>$0.028</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.00</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span class="savings-explainer__example-saved">$0.028</span>
            </div>
          </div>
        </section>

        <section class="savings-explainer__section">
          <h2>What is not included yet</h2>
          <ul class="savings-explainer__list">
            <li>
              <strong>Prompt caching</strong>: Some providers charge less when parts of the prompt
              are cached. Cache hit rates are not tracked yet, so these discounts don't show up.
            </li>
            <li>
              <strong>Batch API</strong>: Some providers offer lower rates for batch requests.
              There's no way to know if a request could have been batched, so this is not accounted
              for.
            </li>
            <li>
              <strong>Subscription fees</strong>: For subscription providers, the savings show
              API-equivalent cost but do not subtract the monthly subscription fee.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default SavingsExplainer;
