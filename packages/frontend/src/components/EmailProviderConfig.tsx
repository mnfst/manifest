import { createSignal, createResource, createEffect, Show, type Component } from "solid-js";
import {
  getEmailConfig,
  saveEmailConfig,
  testEmailConfig,
  clearEmailConfig,
  getNotificationEmail,
} from "../services/api.js";
import { toast } from "../services/toast-store.js";
import { authClient } from "../services/auth-client.js";

const PROVIDERS = [
  { value: "mailgun", label: "Mailgun" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "resend", label: "Resend" },
] as const;

const EmailProviderConfig: Component = () => {
  const session = authClient.useSession();
  const userEmail = () => session()?.data?.user?.email ?? "";

  const [config, { refetch }] = createResource(getEmailConfig);
  const [provider, setProvider] = createSignal("resend");
  const [apiKey, setApiKey] = createSignal("");
  const [domain, setDomain] = createSignal("");
  const [fromEmail, setFromEmail] = createSignal("");
  const [testing, setTesting] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    const c = config();
    if (c?.configured && c.provider) {
      setProvider(c.provider);
      if (c.domain) setDomain(c.domain);
      if (c.fromEmail) setFromEmail(c.fromEmail);
    }
  });

  const handleTest = async () => {
    let to = userEmail();

    try {
      const notifEmail = await getNotificationEmail();
      if (notifEmail.email) to = notifEmail.email;
    } catch {
      // fall through to session email
    }

    if (!to || to === "local@manifest.local") {
      toast.error("Set a notification email in the section above before sending a test");
      return;
    }

    setTesting(true);
    try {
      const result = await testEmailConfig({
        provider: provider(),
        apiKey: apiKey(),
        domain: domain() || undefined,
        fromEmail: fromEmail() || undefined,
      }, to);
      if (result.success) {
        toast.success(`Test email sent to ${to}`);
      } else {
        toast.error(result.error ?? "Test email failed");
      }
    } catch {
      // fetchMutate already shows toast
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEmailConfig({
        provider: provider(),
        apiKey: apiKey(),
        domain: domain() || undefined,
        fromEmail: fromEmail() || undefined,
      });
      toast.success("Email provider saved");
      setApiKey("");
      refetch();
    } catch {
      // fetchMutate already shows toast
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    try {
      await clearEmailConfig();
      toast.success("Email provider removed");
      setApiKey("");
      setDomain("");
      setFromEmail("");
      setProvider("resend");
      refetch();
    } catch {
      // fetchMutate already shows toast
    }
  };

  return (
    <>
      <h3 class="settings-section__title">Email Provider</h3>
      <div class="settings-card">
        <div class="settings-card__body">
          <p class="settings-card__desc">
            Configure an email provider to receive notification alerts. Your API key is stored locally and never sent to any third party.
          </p>

          <Show when={!config.loading} fallback={<p>Loading...</p>}>
            <Show when={config()?.configured}>
              <div class="waiting-banner waiting-banner--success" role="status">
                <i class="bxd bx-check-circle" />
                <p>Email delivery is configured via <strong>{config()?.provider}</strong>.</p>
              </div>
            </Show>

            <div class="email-config__form">
              <div class="settings-card__row">
                <div class="settings-card__label">
                  <span class="settings-card__label-title">Provider</span>
                </div>
                <div class="settings-card__control">
                  <select
                    class="settings-card__input"
                    value={provider()}
                    onChange={(e) => setProvider(e.currentTarget.value)}
                  >
                    {PROVIDERS.map((p) => (
                      <option value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div class="settings-card__row">
                <div class="settings-card__label">
                  <span class="settings-card__label-title">API Key</span>
                  <Show when={config()?.configured}>
                    <span class="settings-card__label-desc">Leave blank to keep existing key.</span>
                  </Show>
                </div>
                <div class="settings-card__control">
                  <input
                    class="settings-card__input"
                    type="password"
                    value={apiKey()}
                    onInput={(e) => setApiKey(e.currentTarget.value)}
                    placeholder={config()?.configured ? "********" : "Enter API key"}
                  />
                </div>
              </div>

              <Show when={provider() === "mailgun"}>
                <div class="settings-card__row">
                  <div class="settings-card__label">
                    <span class="settings-card__label-title">Domain</span>
                    <span class="settings-card__label-desc">Your Mailgun sending domain (e.g. mg.example.com)</span>
                  </div>
                  <div class="settings-card__control">
                    <input
                      class="settings-card__input"
                      type="text"
                      value={domain()}
                      onInput={(e) => setDomain(e.currentTarget.value)}
                      placeholder="mg.example.com"
                    />
                  </div>
                </div>
              </Show>

              <div class="settings-card__row">
                <div class="settings-card__label">
                  <span class="settings-card__label-title">From Email</span>
                  <span class="settings-card__label-desc">Sender address for notifications (optional)</span>
                </div>
                <div class="settings-card__control">
                  <input
                    class="settings-card__input"
                    type="email"
                    value={fromEmail()}
                    onInput={(e) => setFromEmail(e.currentTarget.value)}
                    placeholder="noreply@example.com"
                  />
                </div>
              </div>
            </div>
          </Show>
        </div>

        <div class="settings-card__footer">
          <Show when={config()?.configured}>
            <button class="btn btn--ghost" onClick={handleRemove} style="color: hsl(var(--destructive));">
              Remove
            </button>
          </Show>
          <button
            class="btn btn--outline"
            onClick={handleTest}
            disabled={testing() || (!apiKey() && !config()?.configured)}
            style="font-size: var(--font-size-sm);"
          >
            {testing() ? "Sending..." : "Send test email"}
          </button>
          <button
            class="btn btn--primary"
            onClick={handleSave}
            disabled={saving() || !apiKey()}
            style="font-size: var(--font-size-sm);"
          >
            {saving() ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
};

export default EmailProviderConfig;
