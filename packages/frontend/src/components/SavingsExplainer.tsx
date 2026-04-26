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
          For each request, savings are calculated by comparing what you actually paid against what
          the cheapest reasoning-capable model would have cost for the same tokens.
        </p>

        <section class="savings-explainer__section">
          <h2>The baseline</h2>
          <p>
            In auto mode, the baseline is determined per request at the time it is processed. It is
            the cheapest reasoning-capable model available from your connected providers at that
            moment, priced at API rates.
          </p>
          <p>
            You can also pick a specific model from the dropdown on the Overview page to compare all
            requests against a single model.
          </p>
          {props.baselineModelName && (
            <p>
              Current baseline: <strong>{props.baselineModelName}</strong>.
            </p>
          )}
        </section>

        <section class="savings-explainer__section">
          <h2>The formula</h2>
          <p>For each request:</p>
          <div class="savings-explainer__formula">
            <span>Saved</span>
            <span class="savings-explainer__formula-op">=</span>
            <span>max(Baseline cost &minus; Actual cost, $0)</span>
          </div>
          <p>
            If the model you used costs less than the baseline, the difference is your saving for
            that request. If it costs more, the saving is $0. Choosing a more expensive model is
            your decision, not a loss.
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
              You pay per token. If the model you used is cheaper than the baseline, the difference
              is your saving. If it costs more, the saving is $0.
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
            <div class="savings-explainer__example-title">Model from a subscription provider</div>
            <div class="savings-explainer__example-row">
              <span>Model used</span>
              <span>Kimi k2.5 via subscription</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>25,000 input, 400 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.00</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline, based on connected providers (DeepSeek v4 Flash)</span>
              <span>$0.0035</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span class="savings-explainer__example-saved">$0.0035</span>
            </div>
          </div>

          <div class="savings-explainer__example">
            <div class="savings-explainer__example-title">
              Model from an API key provider, cheaper than baseline
            </div>
            <div class="savings-explainer__example-row">
              <span>Model used</span>
              <span>GPT-4.1 mini via API key</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>10,000 input, 2,000 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.0028</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline, based on connected providers (Claude Haiku 4.5)</span>
              <span>$0.020</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span class="savings-explainer__example-saved">$0.0172</span>
            </div>
          </div>

          <div class="savings-explainer__example">
            <div class="savings-explainer__example-title">
              Model from an API key provider, more expensive than baseline
            </div>
            <div class="savings-explainer__example-row">
              <span>Model used</span>
              <span>Claude Sonnet 4.5 via API key</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>20,000 input, 1,000 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.075</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline, based on connected providers (DeepSeek v4 Flash)</span>
              <span>$0.004</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span>$0.00</span>
            </div>
            <div class="savings-explainer__example-note">
              You chose a more capable model. No loss is recorded.
            </div>
          </div>

          <div class="savings-explainer__example">
            <div class="savings-explainer__example-title">Model from a local provider</div>
            <div class="savings-explainer__example-row">
              <span>Model used</span>
              <span>Qwen 3 32B via Ollama (local)</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Tokens</span>
              <span>8,000 input, 3,000 output</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Actual cost</span>
              <span>$0.00</span>
            </div>
            <div class="savings-explainer__example-row">
              <span>Baseline, based on connected providers (Claude Haiku 4.5)</span>
              <span>$0.023</span>
            </div>
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Saved</span>
              <span class="savings-explainer__example-saved">$0.023</span>
            </div>
          </div>

          <div class="savings-explainer__example savings-explainer__example--total">
            <div class="savings-explainer__example-row savings-explainer__example-row--result">
              <span>Total saved across 4 requests</span>
              <span class="savings-explainer__example-saved">$0.0437</span>
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
