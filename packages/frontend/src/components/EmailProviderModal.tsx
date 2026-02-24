import { createSignal, createEffect, Show, type Component } from "solid-js";
import { setEmailProvider } from "../services/api.js";
import { toast } from "../services/toast-store.js";

interface Props {
  open: boolean;
  initialProvider: string;
  editMode?: boolean;
  existingDomain?: string;
  onClose: () => void;
  onSaved: () => void;
}

const EmailProviderModal: Component<Props> = (props) => {
  const [provider, setProvider] = createSignal("resend");
  const [apiKey, setApiKey] = createSignal("");
  const [domain, setDomain] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    if (props.open) {
      setProvider(props.initialProvider);
      setApiKey("");
      setDomain(props.existingDomain ?? "");
    }
  });

  const handleSave = async () => {
    if (!apiKey().trim() || !domain().trim()) return;

    setSaving(true);
    try {
      await setEmailProvider({ provider: provider(), apiKey: apiKey(), domain: domain() });
      const name = provider() === "resend" ? "Resend" : "Mailgun";
      toast.success(`${name} connected`);
      props.onSaved();
      props.onClose();
    } catch {
      // error toast from fetchMutate
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") props.onClose();
  };

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={() => props.onClose()}>
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provider-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="provider-modal-title">
            {props.editMode ? "Edit email provider" : "Configure email provider"}
          </h2>
          <p class="modal-card__desc">
            Enter your API credentials to enable email alert delivery.
          </p>

          <label class="modal-card__field-label">Provider</label>
          <div class="provider-modal-picker">
            <button
              class="provider-modal-option"
              classList={{ "provider-modal-option--active": provider() === "resend" }}
              onClick={() => setProvider("resend")}
              type="button"
            >
              <img src="/logos/resend.svg" alt="" class="provider-modal-option__logo" />
              <span>Resend</span>
            </button>
            <button
              class="provider-modal-option"
              classList={{ "provider-modal-option--active": provider() === "mailgun" }}
              onClick={() => setProvider("mailgun")}
              type="button"
            >
              <img src="/logos/mailgun.svg" alt="" class="provider-modal-option__logo" />
              <span>Mailgun</span>
            </button>
          </div>

          <label class="modal-card__field-label">API Key</label>
          <input
            class="modal-card__input"
            type="password"
            placeholder={provider() === "resend" ? "re_xxxx..." : "key-xxxx..."}
            value={apiKey()}
            onInput={(e) => setApiKey(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autofocus
          />

          <label class="modal-card__field-label">Sending domain</label>
          <input
            class="modal-card__input"
            type="text"
            placeholder="e.g. notifications.mycompany.com"
            value={domain()}
            onInput={(e) => setDomain(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />

          <div class="modal-card__footer">
            <button
              class="btn btn--primary"
              onClick={handleSave}
              disabled={saving() || !apiKey().trim() || !domain().trim()}
            >
              {saving() ? "Connecting..." : props.editMode ? "Save changes" : "Connect"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default EmailProviderModal;
