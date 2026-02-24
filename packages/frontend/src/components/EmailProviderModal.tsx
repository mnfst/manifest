import { createSignal, createEffect, Show, type Component } from "solid-js";
import { setEmailProvider, testEmailProvider } from "../services/api.js";
import { authClient } from "../services/auth-client.js";
import { toast } from "../services/toast-store.js";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

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
  const [testing, setTesting] = createSignal(false);
  const [keyError, setKeyError] = createSignal("");
  const [domainError, setDomainError] = createSignal("");

  const session = authClient.useSession();

  createEffect(() => {
    if (props.open) {
      setProvider(props.initialProvider);
      setApiKey("");
      setDomain(props.existingDomain ?? "");
      setKeyError("");
      setDomainError("");
    }
  });

  const validateFields = (): boolean => {
    let valid = true;
    const key = apiKey().trim();
    const dom = domain().trim().toLowerCase();

    if (!key) {
      setKeyError("API key is required");
      valid = false;
    } else if (key.length < 8) {
      setKeyError("API key must be at least 8 characters");
      valid = false;
    } else if (provider() === "resend" && !key.startsWith("re_")) {
      setKeyError("Resend API key must start with re_");
      valid = false;
    } else {
      setKeyError("");
    }

    if (!dom) {
      setDomainError("Domain is required");
      valid = false;
    } else if (!DOMAIN_RE.test(dom)) {
      setDomainError("Invalid domain format");
      valid = false;
    } else {
      setDomainError("");
    }

    return valid;
  };

  const handleSave = async () => {
    if (!validateFields()) return;
    if (saving() || testing()) return;

    const trimmedKey = apiKey().trim();
    const trimmedDomain = domain().trim().toLowerCase();
    const userEmail = session()?.data?.user?.email;

    if (!userEmail) {
      toast.error("Unable to determine your email address for testing");
      return;
    }

    setTesting(true);
    try {
      const result = await testEmailProvider({
        provider: provider(),
        apiKey: trimmedKey,
        domain: trimmedDomain,
        to: userEmail,
      });

      if (!result.success) {
        toast.error(result.error ?? "Email test failed — check your credentials");
        return;
      }
    } catch {
      return;
    } finally {
      setTesting(false);
    }

    setSaving(true);
    try {
      await setEmailProvider({ provider: provider(), apiKey: trimmedKey, domain: trimmedDomain });
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

  const busy = () => saving() || testing();

  const buttonLabel = () => {
    if (testing()) return "Testing...";
    if (saving()) return "Saving...";
    return props.editMode ? "Test & Save" : "Test & Connect";
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
              onClick={() => { setProvider("resend"); setKeyError(""); }}
              type="button"
            >
              <img src="/logos/resend.svg" alt="" class="provider-modal-option__logo" />
              <span>Resend</span>
            </button>
            <button
              class="provider-modal-option"
              classList={{ "provider-modal-option--active": provider() === "mailgun" }}
              onClick={() => { setProvider("mailgun"); setKeyError(""); }}
              type="button"
            >
              <img src="/logos/mailgun.svg" alt="" class="provider-modal-option__logo" />
              <span>Mailgun</span>
            </button>
          </div>

          <label class="modal-card__field-label">API Key</label>
          <input
            class="modal-card__input"
            classList={{ "modal-card__input--error": !!keyError() }}
            type="password"
            placeholder={provider() === "resend" ? "re_xxxx..." : "key-xxxx..."}
            value={apiKey()}
            onInput={(e) => { setApiKey(e.currentTarget.value); setKeyError(""); }}
            onKeyDown={handleKeyDown}
            autofocus
          />
          <Show when={keyError()}>
            <p class="modal-card__field-error">{keyError()}</p>
          </Show>

          <label class="modal-card__field-label">Sending domain</label>
          <input
            class="modal-card__input"
            classList={{ "modal-card__input--error": !!domainError() }}
            type="text"
            placeholder="e.g. notifications.mycompany.com"
            value={domain()}
            onInput={(e) => { setDomain(e.currentTarget.value); setDomainError(""); }}
            onKeyDown={handleKeyDown}
          />
          <Show when={domainError()}>
            <p class="modal-card__field-error">{domainError()}</p>
          </Show>

          <div class="modal-card__footer">
            <button
              class="btn btn--primary"
              onClick={handleSave}
              disabled={busy() || !apiKey().trim() || !domain().trim()}
            >
              {buttonLabel()}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default EmailProviderModal;
