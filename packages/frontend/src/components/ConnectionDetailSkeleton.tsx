import { For } from 'solid-js';

const ConnectionDetailSkeleton = () => (
  <div aria-hidden="true">
    {/* Back link */}
    <div style="margin-bottom: 24px;">
      <div class="skeleton skeleton--text" style="width: 100px; height: 14px;" />
    </div>

    {/* Header */}
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <div class="skeleton" style="width: 32px; height: 32px; border-radius: 8px;" />
          <div class="skeleton skeleton--text" style="width: 160px; height: 24px;" />
          <div class="skeleton skeleton--text" style="width: 80px; height: 20px;" />
          <div
            class="skeleton"
            style="width: 60px; height: 28px; border-radius: var(--radius-sm);"
          />
        </div>
        <div style="display: flex; gap: 24px;">
          <div class="skeleton skeleton--text" style="width: 160px; height: 14px;" />
          <div class="skeleton skeleton--text" style="width: 80px; height: 14px;" />
          <div class="skeleton skeleton--text" style="width: 140px; height: 14px;" />
          <div class="skeleton skeleton--text" style="width: 120px; height: 14px;" />
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="skeleton" style="width: 120px; height: 32px; border-radius: var(--radius);" />
        <div class="skeleton" style="width: 72px; height: 32px; border-radius: var(--radius);" />
      </div>
    </div>

    {/* Chart card */}
    <div class="chart-card">
      <div class="chart-card__header">
        <div class="chart-card__stat chart-card__stat--active">
          <span class="chart-card__label">Messages</span>
          <div class="chart-card__value-row">
            <div class="skeleton skeleton--text" style="width: 50px; height: 28px;" />
          </div>
        </div>
        <div class="chart-card__stat">
          <span class="chart-card__label">Token usage</span>
          <div class="chart-card__value-row">
            <div class="skeleton skeleton--text" style="width: 70px; height: 28px;" />
          </div>
        </div>
      </div>
      <div class="chart-card__body">
        <div class="skeleton skeleton--rect" style="width: 100%; height: 260px;" />
      </div>
    </div>

    {/* Recent Messages */}
    <div class="panel scroll-panel" style="margin-bottom: 24px;">
      <div class="panel__title">Recent Messages</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Message ID</th>
            <th>Model</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          <For each={[1, 2, 3, 4, 5]}>
            {() => (
              <tr>
                <td>
                  <div class="skeleton skeleton--text" style="width: 70%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 50%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 60%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 40%;" />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>

    {/* Models */}
    <div class="panel scroll-panel" style="margin-bottom: 24px;">
      <div class="panel__title">Models</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Tokens</th>
            <th>% of total</th>
          </tr>
        </thead>
        <tbody>
          <For each={[1, 2, 3]}>
            {() => (
              <tr>
                <td>
                  <div class="skeleton skeleton--text" style="width: 60%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 40%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 50%;" />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>

    {/* Harnesses */}
    <div class="panel scroll-panel" style="margin-bottom: 0;">
      <div class="panel__title">Harnesses</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Harness</th>
            <th>Tokens (30d)</th>
            <th>% of total</th>
            <th>Last used</th>
          </tr>
        </thead>
        <tbody>
          <For each={[1, 2, 3]}>
            {() => (
              <tr>
                <td>
                  <div class="skeleton skeleton--text" style="width: 50%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 40%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 50%;" />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 60%;" />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  </div>
);

export default ConnectionDetailSkeleton;
