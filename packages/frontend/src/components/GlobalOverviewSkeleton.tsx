import { For } from 'solid-js';

const GlobalOverviewSkeleton = () => (
  <>
    {/* Stats cards */}
    <div class="overview-stats">
      <For each={[1, 2, 3, 4]}>
        {() => (
          <div class="overview-stat-card">
            <div class="skeleton skeleton--text" style="width: 70px; height: 12px;" />
            <div
              class="skeleton skeleton--text"
              style="width: 50px; height: 28px; margin-top: 4px;"
            />
          </div>
        )}
      </For>
    </div>

    {/* Chart card placeholder */}
    <div
      class="skeleton"
      style="width: 100%; height: 340px; border-radius: var(--radius); margin-bottom: 24px;"
    />

    {/* Row 1: Models + Messages */}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
      <div class="panel" style="margin-bottom: 0;">
        <div
          class="skeleton skeleton--text"
          style="width: 80px; height: 16px; margin-bottom: 16px;"
        />
        <For each={[1, 2, 3, 4]}>
          {() => (
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <div class="skeleton skeleton--text" style="width: 140px;" />
              <div class="skeleton skeleton--text" style="width: 50px;" />
              <div class="skeleton" style="width: 60px; height: 6px; border-radius: 3px;" />
            </div>
          )}
        </For>
      </div>
      <div class="panel" style="margin-bottom: 0;">
        <div
          class="skeleton skeleton--text"
          style="width: 120px; height: 16px; margin-bottom: 16px;"
        />
        <For each={[1, 2, 3, 4]}>
          {() => (
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <div class="skeleton skeleton--text" style="width: 60px;" />
              <div class="skeleton skeleton--text" style="width: 100px;" />
              <div class="skeleton skeleton--text" style="width: 50px;" />
            </div>
          )}
        </For>
      </div>
    </div>

    {/* Row 2: Connections + Agents */}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div class="panel" style="margin-bottom: 0;">
        <div
          class="skeleton skeleton--text"
          style="width: 100px; height: 16px; margin-bottom: 16px;"
        />
        <For each={[1, 2, 3]}>
          {() => (
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <div class="skeleton" style="width: 20px; height: 20px; border-radius: 50%;" />
              <div class="skeleton skeleton--text" style="width: 100px;" />
              <div class="skeleton skeleton--text" style="width: 50px;" />
              <div class="skeleton" style="width: 60px; height: 20px; border-radius: 3px;" />
            </div>
          )}
        </For>
      </div>
      <div class="panel" style="margin-bottom: 0;">
        <div
          class="skeleton skeleton--text"
          style="width: 90px; height: 16px; margin-bottom: 16px;"
        />
        <For each={[1, 2, 3]}>
          {() => (
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;">
              <div class="skeleton" style="width: 20px; height: 20px; border-radius: 50%;" />
              <div class="skeleton skeleton--text" style="width: 100px;" />
              <div class="skeleton skeleton--text" style="width: 50px;" />
              <div class="skeleton" style="width: 60px; height: 20px; border-radius: 3px;" />
            </div>
          )}
        </For>
      </div>
    </div>
  </>
);

export default GlobalOverviewSkeleton;
