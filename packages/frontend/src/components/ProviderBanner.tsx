import { createSignal, Show, onCleanup, type Component } from "solid-js";
import type { EmailProviderConfig } from "../services/api.js";

interface Props {
  config: EmailProviderConfig;
  onEdit: () => void;
  onRemove: () => void;
}

const ProviderBanner: Component<Props> = (props) => {
  const logo = () => props.config.provider === "resend" ? "/logos/resend.svg" : "/logos/mailgun.svg";
  const name = () => props.config.provider === "resend" ? "Resend" : "Mailgun";

  const [menuOpen, setMenuOpen] = createSignal(false);

  const closeMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".provider-card__menu")) {
      setMenuOpen(false);
    }
  };

  const toggle = () => {
    const opening = !menuOpen();
    setMenuOpen(opening);
    if (opening) {
      document.addEventListener("click", closeMenu, { once: true });
    }
  };

  onCleanup(() => document.removeEventListener("click", closeMenu));

  return (
    <div class="provider-card">
      <div class="provider-card__header">
        <span class="provider-card__label">Your provider</span>
        <div class="provider-card__menu">
          <button class="provider-card__menu-btn" onClick={toggle} aria-label="Provider options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          <Show when={menuOpen()}>
            <div class="provider-card__dropdown">
              <button class="provider-card__dropdown-item" onClick={() => { setMenuOpen(false); props.onEdit(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
              <button class="provider-card__dropdown-item provider-card__dropdown-item--danger" onClick={() => { setMenuOpen(false); props.onRemove(); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Remove
              </button>
            </div>
          </Show>
        </div>
      </div>
      <div class="provider-card__body">
        <img src={logo()} alt="" class="provider-card__logo" />
        <div>
          <div class="provider-card__name">{name()}</div>
          <div class="provider-card__meta">
            <span>{props.config.domain}</span>
            <span class="provider-card__key">{props.config.keyPrefix}...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderBanner;
