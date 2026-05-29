import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import SidebarPreferencesSection from '../../src/components/SidebarPreferencesSection.jsx';
import { isSidebarItemVisible, resetSidebarVisibility } from '../../src/services/sidebar-preferences.js';

describe('SidebarPreferencesSection', () => {
  beforeEach(() => {
    resetSidebarVisibility();
  });

  it('renders block and item labels', () => {
    render(() => <SidebarPreferencesSection />);
    expect(screen.getByText('Sidebar navigation')).toBeDefined();
    expect(screen.getByText('Monitoring')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Playground')).toBeDefined();
  });

  it('hides child items when a group is disabled', () => {
    render(() => <SidebarPreferencesSection />);
    expect(screen.getByText('Overview')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Monitoring' }));
    expect(screen.queryByText('Overview')).toBeNull();
  });

  it('hides a sidebar item when its eye toggle is clicked', async () => {
    render(() => <SidebarPreferencesSection />);
    await fireEvent.click(screen.getByRole('button', { name: 'Hide Overview' }));
    expect(isSidebarItemVisible('overview')).toBe(false);
  });

  it('collapses child items when the group chevron is clicked', async () => {
    const { container } = render(() => <SidebarPreferencesSection />);
    const chevronBtn = container.querySelector(
      '[aria-controls="sidebar-prefs-monitoring"]',
    ) as HTMLButtonElement;

    expect(screen.getByText('Overview')).toBeDefined();
    await fireEvent.click(chevronBtn);
    expect(screen.queryByText('Overview')).toBeNull();
    await fireEvent.click(chevronBtn);
    expect(screen.getByText('Overview')).toBeDefined();
  });
});
