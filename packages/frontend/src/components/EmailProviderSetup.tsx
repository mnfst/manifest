import { createSignal, type Component } from "solid-js";
import EmailProviderModal from "./EmailProviderModal.jsx";

interface Props {
  onConfigured: () => void;
}

const EmailProviderSetup: Component<Props> = (props) => {
  const [modalOpen, setModalOpen] = createSignal(false);
  const [selectedProvider, setSelectedProvider] = createSignal<string>("resend");

  const openModal = (provider: string) => {
    setSelectedProvider(provider);
    setModalOpen(true);
  };

  return (
    <>
      <h3 class="provider-setup__title">Configure email provider</h3>
      <p class="provider-setup__subtitle">
        Choose a service to send alert notifications via email.
      </p>

      <div class="provider-setup-grid">
        <button class="provider-setup-card" onClick={() => openModal("resend")}>
          <img src="/logos/resend.svg" alt="" class="provider-setup-card__logo" />
          <div>
            <div class="provider-setup-card__name">Resend</div>
            <div class="provider-setup-card__desc">Modern email API</div>
          </div>
        </button>
        <button class="provider-setup-card" onClick={() => openModal("mailgun")}>
          <img src="/logos/mailgun.svg" alt="" class="provider-setup-card__logo" />
          <div>
            <div class="provider-setup-card__name">Mailgun</div>
            <div class="provider-setup-card__desc">Reliable email service</div>
          </div>
        </button>
      </div>

      <EmailProviderModal
        open={modalOpen()}
        initialProvider={selectedProvider()}
        onClose={() => setModalOpen(false)}
        onSaved={props.onConfigured}
      />
    </>
  );
};

export default EmailProviderSetup;
