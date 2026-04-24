import { createSignal, Show, type Component, type JSX } from 'solid-js';

export type RoutingTabId = 'default' | 'complexity' | 'specificity' | 'custom';

interface Tab {
  id: RoutingTabId;
  label: string;
  dot?: () => boolean;
}

export interface RoutingTabsProps {
  complexityEnabled: () => boolean;
  specificityEnabled: () => boolean;
  customEnabled: () => boolean;
  pipelineHelp?: () => JSX.Element | null;
  children: {
    default: JSX.Element;
    complexity: JSX.Element;
    specificity: JSX.Element;
    custom: JSX.Element;
  };
}

const RoutingTabs: Component<RoutingTabsProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<RoutingTabId>('default');
  const [helpOpen, setHelpOpen] = createSignal(false);

  const tabs: Tab[] = [
    { id: 'default', label: 'Default', dot: () => true },
    { id: 'complexity', label: 'Complexity', dot: () => props.complexityEnabled() },
    { id: 'specificity', label: 'Task-specific', dot: () => props.specificityEnabled() },
    { id: 'custom', label: 'Custom', dot: () => props.customEnabled() },
  ];

  return (
    <div class="routing-tabs">
      <div class="routing-tabs__header">
        <div class="panel__tabs" role="tablist" aria-label="Routing layers">
          {tabs.map((tab) => (
            <button
              class="panel__tab"
              classList={{ 'panel__tab--active': activeTab() === tab.id }}
              role="tab"
              aria-selected={activeTab() === tab.id}
              aria-controls={`routing-tabpanel-${tab.id}`}
              id={`routing-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Show when={tab.dot}>
                <span
                  class="routing-tabs__dot"
                  classList={{
                    'routing-tabs__dot--on': tab.dot!(),
                    'routing-tabs__dot--off': !tab.dot!(),
                  }}
                />
              </Show>
              {tab.label}
            </button>
          ))}
        </div>
        <Show when={props.pipelineHelp?.()}>
          <button
            class="routing-pipeline-help"
            onClick={() => setHelpOpen(true)}
            aria-label="How routing works"
            title="How routing works"
          >
            <span class="routing-pipeline-help__label">How routing works</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 15A1 1 0 1 0 12 17 1 1 0 1 0 12 15z" />
              <path d="m9.65,10.5c.4,0,.81-.2.96-.57.07-.18.18-.34.33-.49.57-.57,1.55-.57,2.12,0,.28.28.44.66.44,1.06s-.16.78-.44,1.06c-.28.28-.64.43-1.03.44-.56,0-1.03.44-1.03,1v.5h0c0,.13.03.26.08.38.05.12.12.23.21.33.19.19.44.29.71.29s.52-.1.71-.29c.11-.11.18-.24.23-.38.53-.17,1.14-.45,1.54-.85.66-.66,1.03-1.54,1.03-2.47,0-1.19-.59-2.28-1.62-2.96-1.12-.73-2.63-.73-3.75,0-.65.42-1.13,1.02-1.39,1.7-.24.61.27,1.26.92,1.26Z" />
              <path d="m2.72,19.65c-.32.46-.36,1.05-.1,1.55.26.5.77.8,1.33.8h8.05c4.35,0,8.26-2.81,9.51-6.82,1.06-3.41.4-6.9-1.81-9.56-2.18-2.62-5.5-3.94-8.91-3.54C6.07,2.63,2.3,6.63,2.02,11.39c-.14,2.34.55,4.66,1.91,6.51l-1.21,1.75Zm1.29-8.14c.23-3.81,3.24-7.01,7.01-7.45,2.73-.32,5.39.74,7.13,2.83,1.77,2.13,2.3,4.94,1.44,7.69-.99,3.19-4.12,5.42-7.6,5.42h-7.09l.67-.96c.49-.7.48-1.63-.02-2.3-1.12-1.52-1.66-3.33-1.55-5.23Z" />
            </svg>
          </button>
        </Show>
      </div>
      <div
        class="routing-tabs__panel"
        role="tabpanel"
        id={`routing-tabpanel-${activeTab()}`}
        aria-labelledby={`routing-tab-${activeTab()}`}
      >
        <Show when={activeTab() === 'default'}>{props.children.default}</Show>
        <Show when={activeTab() === 'complexity'}>{props.children.complexity}</Show>
        <Show when={activeTab() === 'specificity'}>{props.children.specificity}</Show>
        <Show when={activeTab() === 'custom'}>{props.children.custom}</Show>
      </div>

      <Show when={helpOpen() && props.pipelineHelp?.()}>
        {(content) => (
          <div
            class="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setHelpOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setHelpOpen(false);
            }}
          >
            <div
              class="modal-card"
              style="max-width: 480px;"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pipeline-help-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="pipeline-help-title"
                style="margin: 0 0 16px; font-size: var(--font-size-lg); font-weight: 600;"
              >
                How routing works
              </h2>
              {content()}
              <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
                <button class="btn btn--primary btn--sm" onClick={() => setHelpOpen(false)}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default RoutingTabs;
