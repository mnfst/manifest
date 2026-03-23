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
});

describe('ProductHuntUpvoteModal', () => {
  it('renders the popup when it has not been dismissed', () => {
    const { container } = render(() => <ProductHuntUpvoteModal />);

    expect(screen.getByText('Manifest is live on Product Hunt')).toBeDefined();
    const link = container.querySelector('.product-hunt-modal__primary') as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe(PRODUCT_HUNT_FALLBACK_URL);
  });

  it('stores the one-time flag when dismissed', async () => {
    render(() => <ProductHuntUpvoteModal />);

    await fireEvent.click(screen.getByText('Dismiss'));

    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest is live on Product Hunt')).toBeNull();
  });

  it('stores the one-time flag when the CTA is clicked', async () => {
    const { container } = render(() => <ProductHuntUpvoteModal />);

    await fireEvent.click(container.querySelector('.product-hunt-modal__primary')!);

    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest is live on Product Hunt')).toBeNull();
  });

  it('does not render after it has already been acknowledged', () => {
    localStorage.setItem(PRODUCT_HUNT_UPVOTE_KEY, '1');
    const { container } = render(() => <ProductHuntUpvoteModal />);

    expect(screen.queryByText('Manifest is live on Product Hunt')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not render in local mode', () => {
    mockIsLocalMode = true;
    const { container } = render(() => <ProductHuntUpvoteModal />);

    expect(screen.queryByText('Manifest is live on Product Hunt')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('dismisses on Escape', async () => {
    render(() => <ProductHuntUpvoteModal />);

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(localStorage.getItem(PRODUCT_HUNT_UPVOTE_KEY)).toBe('1');
    expect(screen.queryByText('Manifest is live on Product Hunt')).toBeNull();
  });
});
