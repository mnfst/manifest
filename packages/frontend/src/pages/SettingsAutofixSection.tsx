import { createResource, createSignal, createEffect, Show, type Component } from 'solid-js';
import { useFocusTrap } from '../services/use-focus-trap.js';
import { useSearchParams } from '@solidjs/router';
import { Portal } from 'solid-js/web';
import { getAutofix, updateAutofix } from '../services/api.js';
import { checkIsSelfHosted } from '../services/setup-status.js';

/**
 * Per-agent Auto-fix toggle on the Settings page. Fetches its own status and
 * persists the on/off choice. The effective value shown here already reflects
 * the deployment-mode default resolved by the backend (ON in cloud, OFF in
 * self-hosted) when the agent has made no explicit choice.
 */
const SettingsAutofixSection: Component<{ agentName: () => string }> = (props) => {
  const [config, { mutate }] = createResource(() => props.agentName(), getAutofix);
  const [selfHosted] = createResource(checkIsSelfHosted);
  const [saving, setSaving] = createSignal(false);
  const [confirmingEnable, setConfirmingEnable] = createSignal(false);

  // Guard the errored read: accessing an errored SolidJS resource re-throws, so
  // short-circuit to off (the switch stays disabled via busy() below). Also gate
  // on `config.loading`: Solid keeps the previous agent's value during a refetch,
  // so without this the switch would briefly show the prior agent's state when
  // you switch harnesses.
  const enabled = () => (!config.loading && !config.error ? (config()?.enabled ?? false) : false);
  // `consented` is true in cloud (no gate) and once the self-hosted install
  // consented. Falls back to true on a failed read so a network blip can never
  // dead-end the toggle behind a modal it can't dismiss.
  const consented = () => (!config.loading && !config.error ? (config()?.consented ?? true) : true);
  // The modal's "enable for all existing agents" slider. Defaults on.
  const [applyToAll, setApplyToAll] = createSignal(true);
  // Also disabled after a failed read: without a known current state a click
  // would blindly write a value the user never saw.
  const busy = () => saving() || config.loading || selfHosted.loading || Boolean(config.error);

  const saveEnabled = async (nextEnabled: boolean, applyToAll = false) => {
    if (busy()) return;
    // Pin the agent this click targets. If the user switches harnesses before
    // the save resolves, don't mutate the (now different) agent's resource.
    const agentName = props.agentName();
    setSaving(true);
    try {
      const next = await updateAutofix(agentName, { enabled: nextEnabled, applyToAll });
      if (props.agentName() === agentName) mutate(next);
    } catch {
      // `updateAutofix` (via `fetchMutate`) already surfaces the backend error as a
      // toast, so don't raise a second generic one here — just stop the spinner.
    } finally {
      setSaving(false);
    }
  };

  let dialogRef: HTMLDivElement | undefined;

  // Focus management: the existing useFocusTrap hook traps Tab inside the
  // dialog while it's open and restores focus on close.
  useFocusTrap(confirmingEnable, () => dialogRef);

  const closeConsent = () => {
    setConfirmingEnable(false);
    setApplyToAll(true);
  };

  const toggle = () => {
    if (busy()) return;
    if (!enabled() && selfHosted() && !consented()) {
      setConfirmingEnable(true);
      return;
    }
    void saveEnabled(!enabled());
  };

  const [searchParams] = useSearchParams();
  const [highlighted, setHighlighted] = createSignal(searchParams.highlight === 'autofix');
  createEffect(() => {
    if (highlighted()) {
      const timer = setTimeout(() => setHighlighted(false), 1500);
      return () => clearTimeout(timer);
    }
  });

  return (
    <>
      <h2 class="settings-section__title">Auto-fix</h2>
      <div class="settings-card" classList={{ 'settings-card--highlight': highlighted() }}>
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Auto-fix failing requests</span>
            <span class="settings-card__label-desc">
              When a request fails with a fixable error, Manifest repairs it and retries once before
              falling back, so a bad request gets fixed instead of just failing over.
            </span>
          </div>
          <div class="settings-card__control settings-card__control--end">
            <button
              type="button"
              role="switch"
              aria-checked={enabled()}
              aria-label="Auto-fix"
              class="settings-switch"
              classList={{ 'settings-switch--on': enabled() }}
              disabled={busy()}
              onClick={toggle}
            >
              <span class="settings-switch__track">
                <span class="settings-switch__thumb" />
              </span>
            </button>
          </div>
        </div>
      </div>
      <Portal>
        <Show when={confirmingEnable()}>
          <div
            class="modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeConsent();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeConsent();
            }}
          >
            <div
              ref={dialogRef}
              class="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="autofix-consent-title"
              aria-describedby="autofix-consent-description"
              style="max-width: 500px;"
            >
              <h2 class="modal-card__title" id="autofix-consent-title">
                Enable hosted Auto-fix?
              </h2>
              <p class="modal-card__desc" id="autofix-consent-description">
                Failed requests will be sent to Manifest Auto-fix for diagnosis and repair. Provider
                authorization credentials are not sent.{' '}
                <a
                  href="https://manifest.build/docs/autofix/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How Auto-fix works
                </a>
                .
              </p>
              <div class="autofix-consent__all-row">
                <div class="autofix-consent__all-label">
                  <span>Auto-fix for all existing agents</span>
                  <span class="autofix-consent__all-desc">
                    Every existing agent gets Auto-fix, including any you previously turned off.
                  </span>
                </div>
                <div class="settings-card__control settings-card__control--end">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={applyToAll()}
                    aria-label="Auto-fix for all existing agents"
                    class="settings-switch"
                    classList={{ 'settings-switch--on': applyToAll() }}
                    onClick={() => setApplyToAll(!applyToAll())}
                  >
                    <span class="settings-switch__track">
                      <span class="settings-switch__thumb" />
                    </span>
                  </button>
                </div>
              </div>
              <p class="autofix-consent__legal">
                By enabling Auto-fix, you agree to Manifest&apos;s{' '}
                <a href="https://manifest.build/terms" target="_blank" rel="noopener noreferrer">
                  Terms
                </a>{' '}
                and{' '}
                <a href="https://manifest.build/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                .
              </p>
              <div class="modal-card__footer">
                <button type="button" class="btn btn--ghost btn--sm" onClick={closeConsent}>
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  onClick={() => {
                    // Capture before closeConsent() resets the slider to its
                    // default for next time.
                    const all = applyToAll();
                    closeConsent();
                    void saveEnabled(true, all);
                  }}
                >
                  Agree &amp; enable Auto-fix
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Portal>
    </>
  );
};

export default SettingsAutofixSection;
