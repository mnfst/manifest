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
          <h2>The baseline</h2>
          <p>
            The baseline is the most expensive model in your routing setup at the time each request
            is made. It represents what you would have paid without routing, since that model would
            have been needed to handle any request.
          </p>
          <p>
            Manifest goes through every model in your routing setup (tiers and fallbacks) and
            compares their API key prices. Models on a subscription or running locally get priced at
            what they'd cost as API keys at their original provider. Whichever model costs the most
            at API key rates becomes the baseline.
          </p>
          <p>
            You can override this by picking a specific model from the dropdown on the Overview
            page.
          </p>
          {props.baselineModelName && (
            <p>
              Current baseline: <strong>{props.baselineModelName}</strong>.
            </p>
          )}
        </section>

        <section class="savings-explainer__section">
          <h2>The formula</h2>
          <div class="savings-explainer__formula">
            <span>Saved</span>
            <span class="savings-explainer__formula-op">=</span>
            <span>Baseline cost &minus; Actual cost</span>
          </div>
          <p>
            The baseline cost is what you would have paid if every request used your most expensive
            model. The actual cost is what you really paid thanks to routing. The difference is your
            saving.
          </p>
          <p>
            The total on the dashboard is the sum of per-request savings across all requests in the
            selected time period.
          </p>
        </section>

        <section class="savings-explainer__section">
          <h2>How different setups are handled</h2>

          <div class="savings-explainer__case">
            <h3>API key providers</h3>
            <p>
              You pay per token. If a cheaper model is used for the request, the difference with the
              baseline is your saving.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Subscription providers</h3>
            <p>
              The per-request cost is $0 since the subscription covers usage. The saving is the full
              baseline cost for those tokens. The subscription fee itself is not factored in.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Local models</h3>
            <p>
              The per-request cost is $0. The saving is the full baseline cost for those tokens.
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
              <span>Most expensive model in your routing setup (baseline)</span>
              <span>Claude Sonnet 4.5</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline cost</span>
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
              <span>Most expensive model in your routing setup (baseline)</span>
              <span>Claude Opus 4.6 (API equivalent)</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline cost</span>
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
              <span>Most expensive model in your routing setup (baseline)</span>
              <span>GPT-4.1</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline cost</span>
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
              <strong>Prompt caching</strong>: Some providers reduce pricing when parts of the
              prompt are cached. Cache hit rates are not tracked yet, so these discounts are not
              reflected.
            </li>
            <li>
              <strong>Batch API</strong>: Some providers offer lower rates for batch requests.
              Whether a given request could have been batched cannot be determined, so this is not
              reflected.
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
