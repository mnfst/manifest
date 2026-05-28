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
              style="width: 40px; height: 28px; margin-top: 4px;"
            />
          </div>
        )}
      </For>
    </div>

    {/* Section cards */}
    <div class="overview-sections">
      <For each={[1, 2, 3]}>
        {() => (
          <div class="overview-section-card" style="pointer-events: none;">
            <div class="overview-section-card__header">
              <div class="skeleton skeleton--text" style="width: 100px; height: 16px;" />
              <div class="skeleton skeleton--text" style="width: 80px; height: 12px;" />
            </div>
            <div class="skeleton skeleton--text" style="width: 140px; height: 14px;" />
          </div>
        )}
      </For>
    </div>

    {/* Agents list */}
    <div class="overview-agents">
      <div
        class="skeleton skeleton--text"
        style="width: 60px; height: 16px; margin-bottom: 12px;"
      />
      <div style="border: 1px solid hsl(var(--border)); border-radius: var(--radius); overflow: hidden;">
        <For each={[1, 2]}>
          {() => (
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid hsl(var(--border));">
              <div class="skeleton skeleton--text" style="width: 120px;" />
              <div class="skeleton skeleton--text" style="width: 80px;" />
            </div>
          )}
        </For>
      </div>
    </div>
  </>
);

export default GlobalOverviewSkeleton;
