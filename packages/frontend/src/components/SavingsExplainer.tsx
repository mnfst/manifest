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
        <p class="savings-explainer__intro">
          Savings compare what you actually paid for your routed requests against what you would
          have paid using a single model for all of them.
        </p>

        <section class="savings-explainer__section">
          <h2>The baseline model</h2>
          <p>
            The baseline is the model used as a reference point. It represents the single model you
            would need if you had no routing and had to use one model for everything, from simple
            messages to complex reasoning tasks.
          </p>
          <p>
            In auto mode, the baseline is computed per request. At the time each request is
            processed, the cheapest reasoning-capable model from your connected providers is
            selected as the baseline for that specific request. This means the baseline can vary
            over time as you connect or disconnect providers.
          </p>
          <p>
            You can also pick a specific model from the dropdown on the Overview page. In that case,
            all requests are compared against that single model regardless of when they were made.
          </p>
          {props.baselineModelName && (
            <p>
              Current baseline: <strong>{props.baselineModelName}</strong>.
            </p>
          )}
        </section>

        <section class="savings-explainer__section">
          <h2>The formula</h2>
          <p>For each request, we compute:</p>
          <div class="savings-explainer__formula">
            <span>Savings = Baseline cost</span>
            <span class="savings-explainer__formula-op">&minus;</span>
            <span>Actual cost</span>
          </div>
          <p>
            <strong>Baseline cost</strong> is what the request would have cost using the baseline
            model, calculated from the actual input and output token counts multiplied by the
            baseline model's per-token pricing.
          </p>
          <p>
            <strong>Actual cost</strong> is what was charged for the request based on the model that
            handled it.
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
              When requests go through API key providers, you pay per token. The savings are the
              difference between what the baseline model would have cost and what the routed model
              actually cost.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Subscription providers</h3>
            <p>
              With subscription providers (ChatGPT Pro, Claude Pro, etc.), the per-request cost is
              $0 since the subscription covers usage. The savings shown represent what those same
              requests would have cost at API rates using the baseline model. The subscription fee
              itself is not factored in.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Local models</h3>
            <p>
              Requests handled by local models (Ollama, LM Studio, etc.) have a per-request cost of
              $0. The savings represent what those requests would have cost using the baseline model
              via API.
            </p>
          </div>

          <div class="savings-explainer__case">
            <h3>Mixed setups</h3>
            <p>
              When combining API keys, subscriptions, and local models, savings are calculated per
              request based on how each request was handled. The total is the sum across all of
              them.
            </p>
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

        <section class="savings-explainer__section">
          <h2>Can savings be negative?</h2>
          <p>
            Individual requests can have negative savings if the model used for that request costs
            more than the baseline. If the total across the entire time period is negative, the
            dashboard shows $0.00.
          </p>
        </section>
      </div>
    </div>
  );
};

export default SavingsExplainer;
