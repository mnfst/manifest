import { createSignal, createResource, Show, type Component } from 'solid-js';
import { getAutofixWaitlistStatus, joinAutofixWaitlist } from '../services/api.js';

const AutofixModal: Component<{ open: boolean; onClose: () => void }> = (props) => {
  const [waitlistStatus, { refetch }] = createResource(
    () => props.open,
    async (isOpen) => {
      if (!isOpen) return { joined: false, joinedAt: null };
      return getAutofixWaitlistStatus();
    },
  );
  const [joining, setJoining] = createSignal(false);

  const dismiss = () => props.onClose();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') dismiss();
  };

  const handleJoinWaitlist = async () => {
    setJoining(true);
    try {
      await joinAutofixWaitlist();
      refetch();
    } finally {
      setJoining(false);
    }
  };

  const isJoined = () => waitlistStatus()?.joined === true;

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={dismiss}>
        <div
          class="autofix-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="autofix-modal-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <button
            type="button"
            class="autofix-modal__close"
            onClick={dismiss}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div class="autofix-modal__body">
            {/* Left column */}
            <div class="autofix-modal__left">
              <div class="autofix-modal__brand">
                <img src="/logotype-white.svg" alt="Manifest" class="autofix-modal__logo autofix-modal__logo--light" height="31" />
                <img src="/logotype-dark.svg" alt="Manifest" class="autofix-modal__logo autofix-modal__logo--dark" height="31" />
                <span class="autofix-modal__brand-name">Auto-fix</span>
              </div>
              <h2 id="autofix-modal-title" class="autofix-modal__title">
                Auto-fix repairs failing requests before they reach the model
              </h2>
              <p class="autofix-modal__desc">
                We're rolling out Auto-fix to a select few teams to start. Get on the list while there's still room.
              </p>
              <div class="autofix-modal__ctas">
                <a
                  href="https://calendly.com/sebastien-manifest/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn--primary autofix-modal__cta-book"
                >
                  Book a demo
                </a>
                <Show
                  when={!isJoined()}
                  fallback={
                    <span class="autofix-modal__joined">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      You're on the list
                    </span>
                  }
                >
                  <button
                    type="button"
                    class="btn btn--outline autofix-modal__cta-waitlist"
                    onClick={handleJoinWaitlist}
                    disabled={joining()}
                  >
                    {joining() ? <span class="spinner" /> : 'Claim my spot'}
                  </button>
                </Show>
              </div>
            </div>

            {/* Right column */}
            <div class="autofix-modal__right">
              <span class="autofix-modal__badge">Early Access</span>
              <ul class="autofix-modal__features">
                <li class="autofix-modal__feature">
                  <span class="autofix-modal__feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </span>
                  <span class="autofix-modal__feature-label">Real-time fix</span>
                </li>
                <li class="autofix-modal__feature">
                  <span class="autofix-modal__feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <span class="autofix-modal__feature-label">Zero downtime</span>
                </li>
                <li class="autofix-modal__feature">
                  <span class="autofix-modal__feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                  </span>
                  <span class="autofix-modal__feature-label">Observability</span>
                </li>
                <li class="autofix-modal__feature">
                  <span class="autofix-modal__feature-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </span>
                  <span class="autofix-modal__feature-label">Notifications</span>
                </li>
              </ul>
              <a
                href="https://manifest.build/autofix/"
                target="_blank"
                rel="noopener noreferrer"
                class="autofix-modal__learn-more"
              >
                Learn more about Auto-fix
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default AutofixModal;
