import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';

let mockIsLocalMode = false;
vi.mock('../../src/services/local-mode.js', () => ({
  isLocalMode: () => mockIsLocalMode,
}));

import ProductHuntUpvoteModal, {
  PRODUCT_HUNT_FALLBACK_URL,
  PRODUCT_HUNT_UPVOTE_KEY,
} from '../../src/components/ProductHuntUpvoteModal';

beforeEach(() => {
  localStorage.clear();
  mockIsLocalMode = false;
  window.history.replaceState({}, '', '/');
});

describe('ProductHuntUpvoteModal', () => {
  it('renders the popup when it has not been dismissed', () => {
    const { container } = render(() => <ProductHuntUpvoteModal />);

    expect(screen.getByText('Manifest on Product Hunt')).toBeDefined();
    const badgeImage = screen.getByAltText(
      'Manifest - Open Source LLM Router for OpenClaw | Product Hunt',
    ) as HTMLImageElement;
    const link = container.querySelector(
      '.product-hunt-modal__featured-badge',
    ) as HTMLAnchorElement;
    expect(badgeImage.getAttribute('src')).not.toContain('api.producthunt.com');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe(PRODUCT_HUNT_FALLBACK_URL);
  });

  it('stores the one-time flag when dismissed', async () => {
    render(() => <ProductHuntUpvoteModal />);

    await fireEvent.click(screen.getByLabelText('Dismiss Product Hunt popup'));

    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
  });

  it('stores the one-time flag when the CTA is clicked', async () => {
    const { container } = render(() => <ProductHuntUpvoteModal />);

    await fireEvent.click(container.querySelector('.product-hunt-modal__featured-badge')!);

    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
  });

  it('does not render after it has already been acknowledged', () => {
    localStorage.setItem(PRODUCT_HUNT_UPVOTE_KEY, '1');
    const { container } = render(() => <ProductHuntUpvoteModal />);

    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not render in local mode', () => {
    mockIsLocalMode = true;
    const { container } = render(() => <ProductHuntUpvoteModal />);

    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('dismisses on Escape', async () => {
    render(() => <ProductHuntUpvoteModal />);

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
  });

  it('dismisses when the overlay is clicked, but not when the card is clicked', async () => {
    const { container } = render(() => <ProductHuntUpvoteModal />);

    await fireEvent.click(container.querySelector('.product-hunt-modal__card')!);
    expect(screen.getByText('Manifest on Product Hunt')).toBeDefined();

    await fireEvent.click(container.querySelector('.product-hunt-modal__overlay')!);
    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
  });

  it('renders when localStorage.getItem throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    render(() => <ProductHuntUpvoteModal />);

    expect(screen.getByText('Manifest on Product Hunt')).toBeDefined();
    getItemSpy.mockRestore();
  });

  it('still closes when localStorage.setItem throws', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    render(() => <ProductHuntUpvoteModal />);

    await fireEvent.click(screen.getByLabelText('Dismiss Product Hunt popup'));

    expect(screen.queryByText('Manifest on Product Hunt')).toBeNull();
    setItemSpy.mockRestore();
  });
});
