import { createSignal, createEffect, Show, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { setEmailProvider, testEmailProvider, testSavedEmailProvider } from "../services/api.js";
import { authClient } from "../services/auth-client.js";
import { isLocalMode } from "../services/local-mode.js";
import { toast } from "../services/toast-store.js";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const PROVIDER_NAMES: Record<string, string> = {
  resend: "Resend",
  mailgun: "Mailgun",
  sendgrid: "SendGrid",
};

interface Props {
  open: boolean;
  initialProvider: string;
  editMode?: boolean;
  existingKeyPrefix?: string | null;
  existingDomain?: string | null;
  existingNotificationEmail?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const EmailProviderModal: Component<Props> = (props) => {
  const [provider, setProvider] = createSignal("resend");
  const [apiKey, setApiKey] = createSignal("");
  const [domain, setDomain] = createSignal("");
  const [notificationEmail, setNotificationEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [keyError, setKeyError] = createSignal("");
  const [domainError, setDomainError] = createSignal("");
  const [editingKey, setEditingKey] = createSignal(false);

  const session = authClient.useSession();

  const hasExistingKey = () => props.editMode && !!props.existingKeyPrefix && provider() === props.initialProvider;

  const maskedKey = () => {
    const prefix = props.existingKeyPrefix ?? "";
    return prefix + "••••••••";
  };

  createEffect(() => {
    if (props.open) {
      setProvider(props.initialProvider);
      setApiKey("");
      const hasKey = props.editMode && !!props.existingKeyPrefix;
      setEditingKey(!hasKey);
      setDomain(props.existingDomain ?? "");
      const defaultEmail = props.existingNotificationEmail ?? (!isLocalMode() ? session()?.data?.user?.email ?? "" : "");
      setNotificationEmail(defaultEmail);
      setKeyError("");
      setDomainError("");
    }
  });

  const needsDomain = () => provider() === "mailgun";

  const validateFields = (): boolean => {
    let valid = true;
    const key = apiKey().trim();
    const dom = domain().trim().toLowerCase();

    // Skip API key validation when keeping the existing key
    if (!editingKey() && hasExistingKey()) {
      setKeyError("");
    } else if (!key) {
      setKeyError("API key is required");
      valid = false;
    } else if (key.length < 8) {
      setKeyError("API key must be at least 8 characters");
      valid = false;
    } else if (provider() === "resend" && !key.startsWith("re_")) {
      setKeyError("Resend API key must start with re_");
      valid = false;
    } else if (provider() === "sendgrid" && !key.startsWith("SG.")) {
      setKeyError("SendGrid API key must start with SG.");
      valid = false;
    } else {
      setKeyError("");
    }

    if (needsDomain()) {
      if (!dom) {
        setDomainError("Domain is required");
        valid = false;
      } else if (!DOMAIN_RE.test(dom)) {
        setDomainError("Invalid domain format");
        valid = false;
      } else {
        setDomainError("");
      }
    } else {
      if (dom && !DOMAIN_RE.test(dom)) {
        setDomainError("Invalid domain format");
        valid = false;
      } else {
        setDomainError("");
      }
    }

    return valid;
  };

  const getTestRecipient = () => {
    const notif = notificationEmail().trim();
    if (notif) return notif;
    return session()?.data?.user?.email ?? null;
  };

  const runTest = async (): Promise<boolean> => {
    const trimmedKey = apiKey().trim();
    const trimmedDomain = domain().trim().toLowerCase();
    const recipient = getTestRecipient();

    if (!recipient) {
      toast.error("Enter a notification email to send the test to");
      return false;
    }

    setTesting(true);
    try {
      const testData: { provider: string; apiKey: string; domain?: string; to: string } = {
        provider: provider(),
        apiKey: trimmedKey,
        to: recipient,
      };
      if (trimmedDomain) testData.domain = trimmedDomain;
      const result = await testEmailProvider(testData);

      if (!result.success) {
        toast.error(result.error ?? "Email test failed — check your credentials");
        return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      setTesting(false);
    }
  };

  const runTestSaved = async (): Promise<boolean> => {
    const recipient = getTestRecipient();
    if (!recipient) {
      toast.error("Enter a notification email to send the test to");
      return false;
    }

    setTesting(true);
    try {
      const result = await testSavedEmailProvider(recipient);
      if (!result.success) {
        toast.error(result.error ?? "Email test failed — check your credentials");
        return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      setTesting(false);
    }
  };

  const handleTestOnly = async () => {
    if (!validateFields()) return;
    if (busy()) return;
    const keepingExistingKey = !editingKey() && hasExistingKey();
    const ok = keepingExistingKey ? await runTestSaved() : await runTest();
    if (ok) toast.success(`Test email sent to ${getTestRecipient()}`);
  };

  const handleSave = async () => {
    if (!validateFields()) return;
    if (saving() || testing()) return;

    const keepingExistingKey = !editingKey() && hasExistingKey();

    const ok = keepingExistingKey ? await runTestSaved() : await runTest();
    if (!ok) return;

    const trimmedDomain = domain().trim().toLowerCase();

    setSaving(true);
    try {
      const saveData: { provider: string; apiKey?: string; domain?: string; notificationEmail?: string } = {
        provider: provider(),
      };
      if (!keepingExistingKey) saveData.apiKey = apiKey().trim();
      if (trimmedDomain) saveData.domain = trimmedDomain;
      const trimmedEmail = notificationEmail().trim();
      if (trimmedEmail) saveData.notificationEmail = trimmedEmail;
      await setEmailProvider(saveData);
      const name = PROVIDER_NAMES[provider()] ?? provider();
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

  const isDisabled = () => {
    // When keeping existing key, only domain matters
    if (!editingKey() && hasExistingKey()) {
      if (needsDomain() && !domain().trim()) return true;
      return false;
    }
    if (!apiKey().trim()) return true;
    if (needsDomain() && !domain().trim()) return true;
    return false;
  };

  const buttonLabel = () => {
    if (testing()) return "Testing...";
    if (saving()) return "Saving...";
    return props.editMode ? "Test & Save" : "Test & Connect";
  };

  const keyPlaceholder = () => {
    switch (provider()) {
      case "resend": return "re_xxxx...";
      case "sendgrid": return "SG.xxxx...";
      default: return "key-xxxx...";
    }
  };

  return (
    <Portal>
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
            <button
              class="provider-modal-option"
              classList={{ "provider-modal-option--active": provider() === "sendgrid" }}
              onClick={() => { setProvider("sendgrid"); setKeyError(""); }}
              type="button"
            >
              <img src="/logos/sendgrid.svg" alt="" class="provider-modal-option__logo" />
              <span>SendGrid</span>
            </button>
          </div>

          <label class="modal-card__field-label">API Key</label>
          <Show
            when={editingKey() || !hasExistingKey()}
            fallback={
              <div class="masked-key">
                <span class="masked-key__value">{maskedKey()}</span>
                <button
                  class="btn btn--ghost masked-key__edit"
                  type="button"
                  onClick={() => { setEditingKey(true); setApiKey(""); }}
                >
                  Change
                </button>
              </div>
            }
          >
            <input
              class="modal-card__input"
              classList={{ "modal-card__input--error": !!keyError() }}
              type="password"
              placeholder={keyPlaceholder()}
              value={apiKey()}
              onInput={(e) => { setApiKey(e.currentTarget.value); setKeyError(""); }}
              onKeyDown={handleKeyDown}
              autofocus
            />
          </Show>
          <Show when={keyError()}>
            <p class="modal-card__field-error">{keyError()}</p>
          </Show>

          <Show when={needsDomain()}>
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
          </Show>

          <label class="modal-card__field-label">Notification email</label>
          <input
            class="modal-card__input"
            type="email"
            placeholder={!isLocalMode() ? (session()?.data?.user?.email ?? "you@example.com") : "you@example.com"}
            value={notificationEmail()}
            onInput={(e) => setNotificationEmail(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
          <p class="modal-card__field-hint">Where threshold alerts will be sent.</p>

          <div class="modal-card__footer modal-card__footer--split">
            <button
              class="btn btn--ghost"
              onClick={handleTestOnly}
              disabled={busy() || isDisabled()}
              type="button"
            >
              {testing() ? "Sending..." : "Send test email"}
            </button>
            <button
              class="btn btn--primary"
              onClick={handleSave}
              disabled={busy() || isDisabled()}
            >
              {buttonLabel()}
            </button>
          </div>
        </div>
      </div>
    </Show>
    </Portal>
  );
};

export default EmailProviderModal;
