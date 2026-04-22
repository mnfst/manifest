import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const getAgentKeyMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  getAgentKey: (...args: unknown[]) => getAgentKeyMock(...args),
}));

// Stub clipboard so CopyButton inside FrameworkSnippets doesn't blow up.
vi.stubGlobal('navigator', {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import HeaderTierSnippetModal from '../../src/components/HeaderTierSnippetModal';

const baseTier: HeaderTier = {
  id: 'ht-1',
  agent_id: 'a1',
  name: 'Premium',
  header_key: 'x-manifest-tier',
  header_value: 'premium',
  badge_color: 'violet',
  sort_order: 0,
  override_model: 'gpt-4o',
  override_provider: 'openai',
  override_auth_type: 'api_key',
  fallback_models: null,
  created_at: '',
  updated_at: '',
};

function mount(overrides: { tier?: HeaderTier; onClose?: () => void } = {}) {
  const onClose = overrides.onClose ?? vi.fn();
  const result = render(() => (
    <HeaderTierSnippetModal
      agentName="my-agent"
      tier={overrides.tier ?? baseTier}
      onClose={onClose}
    />
  ));
  return { ...result, onClose };
}

describe('HeaderTierSnippetModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAgentKeyMock.mockResolvedValue({ apiKey: 'mnfst_FULL', keyPrefix: 'mnfst_FU' });
  });

  it('renders the title with the tier name', () => {
    const { container } = mount();
    expect(container.textContent).toContain('Send the “Premium” header');
  });

  it("includes the tier's matching header key/value in the connection details", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain('x-manifest-tier'));
    expect(container.textContent).toContain('premium');
  });

  it('shows the override model in the explainer', () => {
    const { container } = mount();
    expect(container.textContent).toContain('gpt-4o');
  });

  it('shows a fallback explainer when no override_model is set', () => {
    const empty: HeaderTier = { ...baseTier, override_model: null };
    const { container } = mount({ tier: empty });
    expect(container.textContent).toContain('no model assigned');
  });

  it('calls onClose when the backdrop is clicked', () => {
    const { container, onClose } = mount();
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside the modal card', () => {
    const { container, onClose } = mount();
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the × button is clicked', () => {
    const { container, onClose } = mount();
    fireEvent.click(container.querySelector('.modal__close')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the footer Done button is clicked', () => {
    const { getByText, onClose } = mount();
    fireEvent.click(getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const { container, onClose } = mount();
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('weaves the tier header into the code snippet (default openai-sdk python tab)', async () => {
    const { container } = mount();
    await waitFor(() =>
      expect(container.textContent).toContain('default_headers={"x-manifest-tier": "premium"}'),
    );
  });

  it('uses the canonical cloud baseUrl when running on app.manifest.build', async () => {
    // jsdom's default location is http://localhost/, so we override the
    // hostname to exercise the cloud-host branch in baseUrl().
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, hostname: 'app.manifest.build', origin: 'https://app.manifest.build' },
    });
    try {
      const { container } = mount();
      await waitFor(() =>
        expect(container.textContent).toContain('https://app.manifest.build/v1'),
      );
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('uses window.origin/v1 baseUrl on any other host', async () => {
    // jsdom defaults to a localhost origin — the cloud branch must NOT fire
    // and the rendered baseUrl must end with `/v1` derived from window.origin.
    const expected = `${window.location.origin}/v1`;
    const { container } = mount();
    await waitFor(() => expect(container.textContent).toContain(expected));
    expect(container.textContent).not.toContain('app.manifest.build');
  });
});
