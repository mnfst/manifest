import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@solidjs/testing-library';

import WhatsNewModal from '../../src/components/WhatsNewModal';

const STORAGE_KEY = 'manifest:whatsnew:global-providers-v1';
const HEADLINE = 'What we just shipped';

describe('WhatsNewModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens on first load when never dismissed', () => {
    render(() => <WhatsNewModal />);
    expect(screen.getByText(HEADLINE)).toBeDefined();
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('stays hidden when already dismissed', () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    render(() => <WhatsNewModal />);
    expect(screen.queryByText(HEADLINE)).toBeNull();
  });

  it('renders every highlight bullet', () => {
    render(() => <WhatsNewModal />);
    expect(screen.getByText(/One unified place to connect and manage/)).toBeDefined();
    expect(screen.getByText(/Connect a provider once/)).toBeDefined();
    expect(screen.getByText(/Need isolation\?/)).toBeDefined();
    expect(screen.getByText(/Track consumption/)).toBeDefined();
  });

  it('links out to GitHub issues and Discord in a new tab', () => {
    render(() => <WhatsNewModal />);
    const issue = screen.getByText('Open an issue') as HTMLAnchorElement;
    const discord = screen.getByText('join our Discord') as HTMLAnchorElement;
    expect(issue.getAttribute('href')).toBe('https://github.com/mnfst/manifest/issues');
    expect(issue.getAttribute('target')).toBe('_blank');
    expect(issue.getAttribute('rel')).toBe('noopener noreferrer');
    expect(discord.getAttribute('href')).toBe('https://discord.com/invite/FepAked3W7');
  });

  it('dismisses via the "Got it" button and persists the dismissal', () => {
    render(() => <WhatsNewModal />);
    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByText(HEADLINE)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('dismisses via the close button', () => {
    render(() => <WhatsNewModal />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText(HEADLINE)).toBeNull();
  });

  it('dismisses on Escape but ignores other keys', () => {
    render(() => <WhatsNewModal />);
    fireEvent.keyDown(document, { key: 'a' });
    expect(screen.getByText(HEADLINE)).toBeDefined();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(HEADLINE)).toBeNull();
    // Escape after close is a no-op (open() short-circuits) and must not throw.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(HEADLINE)).toBeNull();
  });

  it('closes when clicking the backdrop but not the modal body', () => {
    render(() => <WhatsNewModal />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByText(HEADLINE)).toBeDefined();
    fireEvent.click(document.querySelector('.modal-backdrop') as HTMLElement);
    expect(screen.queryByText(HEADLINE)).toBeNull();
  });

  it('fails open and still shows when localStorage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(() => <WhatsNewModal />);
    expect(screen.getByText(HEADLINE)).toBeDefined();
  });

  it('still dismisses cleanly when localStorage writes throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(() => <WhatsNewModal />);
    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByText(HEADLINE)).toBeNull();
  });

  it('moves focus into the modal on open and restores it on close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    render(() => <WhatsNewModal />);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByText('Got it'));
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('removes the keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(() => <WhatsNewModal />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
