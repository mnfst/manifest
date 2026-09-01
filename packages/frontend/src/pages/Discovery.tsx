import { useNavigate, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import { type Component, createSignal, createUniqueId, onMount, Show } from 'solid-js';
import Select from '../components/Select.jsx';
import { authClient } from '../services/auth-client.js';
import { isSafeInternalRedirect } from '../services/auth-redirects.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import {
  COMPANY_SIZE_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  completeDiscovery,
  isDiscoveryRequired,
  type DiscoverySubmission,
} from '../services/discovery.js';

/**
 * One-time post-signup step for self-hosted installs. Self-guards like
 * Setup.tsx: anyone who should not see it (cloud, already completed, already
 * skipped, direct navigation later) is redirected to the `next` destination.
 */
const Discovery: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = authClient.useSession();
  const userId = () => session()?.data?.user?.id ?? '';

  const [checking, setChecking] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [projectType, setProjectType] = createSignal('');
  const [companySize, setCompanySize] = createSignal('');
  const nameId = createUniqueId();
  const emailId = createUniqueId();

  const next = () => {
    const raw = searchParams.next;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return isSafeInternalRedirect(value) ? value : '/';
  };

  const leave = () => navigate(next(), { replace: true });

  onMount(async () => {
    if (!(await checkIsSelfHosted())) {
      leave();
      return;
    }
    if (!(await isDiscoveryRequired(userId()))) {
      leave();
      return;
    }
    setChecking(false);
  });

  const finish = async (submission: DiscoverySubmission) => {
    if (busy()) return;
    setBusy(true);
    try {
      await completeDiscovery(userId(), submission);
    } finally {
      setBusy(false);
    }
    leave();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await finish({
      ...(name().trim() && { name: name().trim() }),
      ...(email().trim() && { email: email().trim() }),
      ...(projectType() && { projectType: projectType() }),
      ...(companySize() && { companySize: companySize() }),
    });
  };

  return (
    <div class="auth-layout">
      <Title>Welcome - Manifest</Title>
      <Meta name="description" content="Tell us a little about how you use Manifest." />
      <Show when={!checking()} fallback={<div class="auth-header__subtitle">Loading...</div>}>
        <div class="discovery-card">
          <aside class="discovery-card__intro">
            <div class="auth-logo discovery-card__logo">
              <a href="https://manifest.build" class="auth-logo__link">
                <img
                  src="/logotype-white.svg"
                  alt="Manifest"
                  class="auth-logo__img auth-logo__img--light"
                />
                <img src="/logotype-dark.svg" alt="" class="auth-logo__img auth-logo__img--dark" />
              </a>
            </div>
            <h1 class="discovery-card__title">Help us understand who uses Manifest</h1>
            <div class="discovery-card__desc">
              <p>
                Manifest is <strong>open source</strong> and self-hosted, so we don't usually know
                who's using it or what they're building.
              </p>
              <p>
                If you're open to it, tell us a little about yourself. We may reach out personally
                to learn about your experience and get your feedback.{' '}
                <strong>No newsletters or marketing emails.</strong>
              </p>
            </div>
          </aside>
          <div class="discovery-card__form">
            <form class="auth-form discovery-form" onSubmit={handleSubmit}>
              <label class="auth-form__label" for={nameId}>
                Name
                <input
                  id={nameId}
                  class="auth-form__input"
                  type="text"
                  autocomplete="name"
                  placeholder="Your name"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                />
              </label>
              <label class="auth-form__label" for={emailId}>
                Email
                <input
                  id={emailId}
                  class="auth-form__input"
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                />
              </label>
              <div class="auth-form__label">
                What type of project are you working on?
                <div classList={{ 'discovery-select--empty': !projectType() }}>
                  <Select
                    options={PROJECT_TYPE_OPTIONS}
                    value={projectType()}
                    onChange={setProjectType}
                    placeholder="Select an option"
                    label="What type of project are you working on?"
                  />
                </div>
              </div>
              <div class="auth-form__label">
                How big is your company?
                <div classList={{ 'discovery-select--empty': !companySize() }}>
                  <Select
                    options={COMPANY_SIZE_OPTIONS}
                    value={companySize()}
                    onChange={setCompanySize}
                    placeholder="Select an option"
                    label="How big is your company?"
                  />
                </div>
              </div>
              <div class="discovery-actions">
                <button
                  type="button"
                  class="btn btn--ghost"
                  onClick={() => finish({})}
                  disabled={busy()}
                >
                  Skip
                </button>
                <button class="btn btn--primary" type="submit" disabled={busy()}>
                  {busy() ? <span class="spinner" /> : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Discovery;
