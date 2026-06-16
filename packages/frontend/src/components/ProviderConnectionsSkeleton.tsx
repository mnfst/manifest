import { For } from 'solid-js';

const ProviderConnectionsSkeleton = () => (
  <>
    {/* Connected providers heading */}
    <div class="skeleton skeleton--text" style="width: 220px; height: 16px; margin-bottom: 12px;" />

    {/* Connections table */}
    <div class="panel" style="padding: 0; margin-bottom: 24px; overflow-x: auto;">
      <table class="data-table" style="width: 100%;">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Connection</th>
            <th>Usage (30d)</th>
            <th>Status</th>
            <th>Last used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
            {() => (
              <tr>
                <td>
                  <span style="display: flex; align-items: center; gap: 10px;">
                    <div
                      class="skeleton"
                      style="width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;"
                    />
                    <div class="skeleton skeleton--text" style="width: 100px;" />
                  </span>
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 70px;" />
                </td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="skeleton" style="width: 60px; height: 20px; border-radius: 3px;" />
                    <div class="skeleton skeleton--text" style="width: 80px;" />
                  </div>
                </td>
                <td>
                  <div
                    class="skeleton"
                    style="width: 50px; height: 20px; border-radius: var(--radius-sm);"
                  />
                </td>
                <td>
                  <div class="skeleton skeleton--text" style="width: 60px;" />
                </td>
                <td style="text-align: right;">
                  <div
                    class="skeleton"
                    style="width: 80px; height: 28px; border-radius: var(--radius); margin-left: auto;"
                  />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>

    {/* Supported providers heading + view toggle */}
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
      <div class="skeleton skeleton--text" style="width: 240px; height: 16px;" />
      <div class="skeleton" style="width: 64px; height: 30px; border-radius: var(--radius);" />
    </div>

    {/* Supported providers grid */}
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
      <For each={[1, 2, 3, 4, 5, 6, 7, 8]}>
        {() => (
          <div
            class="panel"
            style="padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 0;"
          >
            <div style="display: flex; align-items: center; gap: 10px;">
              <div
                class="skeleton"
                style="width: 24px; height: 24px; border-radius: 4px; flex-shrink: 0;"
              />
              <div class="skeleton skeleton--text" style="width: 100px; height: 14px;" />
            </div>
            <div style="display: flex; align-items: center; justify-content: flex-end;">
              <div
                class="skeleton"
                style="width: 70px; height: 28px; border-radius: var(--radius);"
              />
            </div>
          </div>
        )}
      </For>
    </div>
  </>
);

export default ProviderConnectionsSkeleton;
