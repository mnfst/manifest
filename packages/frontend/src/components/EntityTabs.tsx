import { A } from '@solidjs/router';
import { For, type Component } from 'solid-js';

export interface EntityTab {
  label: string;
  href: string;
  active: boolean;
}

/** The horizontal tab bar shared by agent, user and project detail pages. */
const EntityTabs: Component<{ tabs: EntityTab[] }> = (props) => (
  <>
    <div class="panel__tabs" role="tablist" style="margin-top: 12px; margin-bottom: 0;">
      <For each={props.tabs}>
        {(tab) => (
          <A
            href={tab.href}
            role="tab"
            aria-selected={tab.active}
            class="panel__tab"
            classList={{ 'panel__tab--active': tab.active }}
          >
            {tab.label}
          </A>
        )}
      </For>
    </div>
    <hr style="border: none; border-top: 1px solid hsl(var(--border)); margin: 8px 0 24px;" />
  </>
);

export default EntityTabs;
