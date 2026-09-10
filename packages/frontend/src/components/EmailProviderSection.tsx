import { For, Show, type Component } from 'solid-js';
import ProviderBanner from './ProviderBanner.js';
import EmailProviderSetup from './EmailProviderSetup.js';
import type { EmailProviderConfig } from '../services/api.js';

interface EmailProviderSectionProps {
  emailProvider: EmailProviderConfig | null | undefined;
  loading: boolean;
  onConfigured: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

const EmailProviderSection: Component<EmailProviderSectionProps> = (props) => (
  <div style="margin-bottom: var(--gap-lg);">
    <Show
      when={!props.loading}
      fallback={
        <Show
          when={!!props.emailProvider}
          fallback={
            <div class="panel">
              <div class="skeleton skeleton--text" style="width: 180px; height: 16px;" />
              <div
                class="skeleton skeleton--text"
                style="width: 280px; height: 13px; margin-top: 6px;"
              />
              <div style="display: flex; gap: var(--gap-md); margin-top: var(--gap-lg);">
                <For each={[1, 2, 3]}>
                  {() => (
                    <div
                      class="skeleton skeleton--rect"
                      style="flex: 1; height: 64px; border-radius: var(--radius);"
                    />
                  )}
                </For>
              </div>
            </div>
          }
        >
          <div class="provider-card">
            <div class="provider-card__header">
              <span class="provider-card__label">Your provider</span>
              <div
                class="skeleton skeleton--text"
                style="width: 16px; height: 16px; border-radius: calc(var(--radius) - 2px);"
              />
            </div>
            <div class="provider-card__body">
              <div
                class="skeleton skeleton--rect"
                style="width: 32px; height: 32px; border-radius: calc(var(--radius) - 2px); flex-shrink: 0;"
              />
              <div>
                <div class="skeleton skeleton--text" style="width: 80px; height: 14px;" />
                <div
                  class="skeleton skeleton--text"
                  style="width: 160px; height: 12px; margin-top: 6px;"
                />
              </div>
            </div>
          </div>
        </Show>
      }
    >
      <Show
        when={props.emailProvider}
        fallback={<EmailProviderSetup onConfigured={props.onConfigured} />}
      >
        <ProviderBanner
          config={props.emailProvider!}
          onEdit={props.onEdit}
          onRemove={props.onRemove}
        />
      </Show>
    </Show>
  </div>
);

export default EmailProviderSection;
