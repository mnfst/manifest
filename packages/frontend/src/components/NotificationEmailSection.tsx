import { createSignal, createResource, Show, type Component } from "solid-js";
import { getNotificationEmail, saveNotificationEmail } from "../services/api.js";
import { toast } from "../services/toast-store.js";

const NotificationEmailSection: Component = () => {
  const [data, { refetch }] = createResource(getNotificationEmail);
  const [email, setEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const handleSave = async () => {
    const value = email().trim();
    if (!value) {
      toast.error("Please enter an email address");
      return;
    }
    setSaving(true);
    try {
      await saveNotificationEmail(value);
      toast.success("Notification email saved");
      setEmail("");
      refetch();
    } catch {
      // fetchMutate already shows toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h3 class="settings-section__title">Notification Email</h3>
      <div class="settings-card">
        <div class="settings-card__body">
          <p class="settings-card__desc">
            Set the email address where threshold alerts and notifications will be sent.
          </p>

          <Show when={!data.loading} fallback={<p>Loading...</p>}>
            <Show
              when={data()?.email}
              fallback={
                <div class="waiting-banner waiting-banner--warning" role="alert">
                  <i class="bxd bx-x-circle" />
                  <p>No notification email configured. Alerts will not be delivered until you set one.</p>
                </div>
              }
            >
              <div class="waiting-banner waiting-banner--success" role="status">
                <i class="bxd bx-check-circle" />
                <p>Notifications will be sent to <strong>{data()!.email}</strong>.</p>
              </div>
            </Show>

            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">Email address</span>
                <span class="settings-card__label-desc">Where to receive notification alerts.</span>
              </div>
              <div class="settings-card__control">
                <input
                  class="settings-card__input"
                  type="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  placeholder={data()?.email ?? "you@example.com"}
                />
              </div>
            </div>
          </Show>
        </div>

        <div class="settings-card__footer">
          <button
            class="btn btn--primary"
            onClick={handleSave}
            disabled={saving() || !email().trim()}
            style="font-size: var(--font-size-sm);"
          >
            {saving() ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationEmailSection;
