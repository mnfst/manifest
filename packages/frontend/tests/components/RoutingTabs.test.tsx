import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import RoutingTabs from '../../src/components/RoutingTabs';

function renderTabs(
  overrides: Partial<{
    specificityEnabled: boolean;
    customEnabled: boolean;
  }> = {},
) {
  return render(() => (
    <RoutingTabs
      specificityEnabled={() => overrides.specificityEnabled ?? false}
      customEnabled={() => overrides.customEnabled ?? false}
    >
      {{
        default: <div data-testid="default-content">Default content</div>,
        complexity: <div data-testid="complexity-content">Complexity content</div>,
        specificity: <div data-testid="specificity-content">Specificity content</div>,
        custom: <div data-testid="custom-content">Custom content</div>,
      }}
    </RoutingTabs>
  ));
}

describe('RoutingTabs', () => {
  it('renders all four tab labels', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: /Default/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Complexity/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Task-specific/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Custom/ })).toBeDefined();
  });

  it('renders tablist with aria-label', () => {
    renderTabs();
    expect(screen.getByRole('tablist', { name: 'Routing layers' })).toBeDefined();
  });

  it('shows default content by default', () => {
    renderTabs();
    expect(screen.getByTestId('default-content')).toBeDefined();
    expect(screen.queryByTestId('complexity-content')).toBeNull();
    expect(screen.queryByTestId('specificity-content')).toBeNull();
    expect(screen.queryByTestId('custom-content')).toBeNull();
  });

  it('switches to complexity tab on click', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Complexity/ }));
    expect(screen.queryByTestId('default-content')).toBeNull();
    expect(screen.getByTestId('complexity-content')).toBeDefined();
  });

  it('switches to specificity tab on click', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Task-specific/ }));
    expect(screen.queryByTestId('default-content')).toBeNull();
    expect(screen.getByTestId('specificity-content')).toBeDefined();
  });

  it('switches to custom tab on click', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Custom/ }));
    expect(screen.queryByTestId('default-content')).toBeNull();
    expect(screen.getByTestId('custom-content')).toBeDefined();
  });

  it('marks the active tab with aria-selected=true', () => {
    renderTabs();
    const defaultTab = screen.getByRole('tab', { name: /Default/ });
    expect(defaultTab.getAttribute('aria-selected')).toBe('true');

    const complexityTab = screen.getByRole('tab', { name: /Complexity/ });
    expect(complexityTab.getAttribute('aria-selected')).toBe('false');
  });

  it('updates aria-selected on tab switch', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Complexity/ }));

    expect(screen.getByRole('tab', { name: /Default/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /Complexity/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders tabpanel with correct role', () => {
    renderTabs();
    expect(screen.getByRole('tabpanel')).toBeDefined();
  });

  it('shows green dot for enabled layers and gray for disabled', () => {
    const { container } = renderTabs({ specificityEnabled: false, customEnabled: true });
    const dots = container.querySelectorAll('.routing-tabs__dot');
    // Default (always on), complexity (always on), specificity (off), custom (on)
    expect(dots[0].classList.contains('routing-tabs__dot--on')).toBe(true);
    expect(dots[1].classList.contains('routing-tabs__dot--on')).toBe(true);
    expect(dots[2].classList.contains('routing-tabs__dot--off')).toBe(true);
    expect(dots[3].classList.contains('routing-tabs__dot--on')).toBe(true);
  });

  it('Default and Complexity tabs always have a green dot', () => {
    const { container } = renderTabs();
    const dots = container.querySelectorAll('.routing-tabs__dot');
    expect(dots.length).toBe(4);
    // Default and Complexity dots are always on
    expect(dots[0].classList.contains('routing-tabs__dot--on')).toBe(true);
    expect(dots[1].classList.contains('routing-tabs__dot--on')).toBe(true);
    // Specificity and Custom are off by default
    expect(dots[2].classList.contains('routing-tabs__dot--off')).toBe(true);
    expect(dots[3].classList.contains('routing-tabs__dot--off')).toBe(true);
  });

  it('applies active class to selected tab', () => {
    const { container } = renderTabs();
    const tabs = container.querySelectorAll('.panel__tab');
    expect(tabs[0].classList.contains('panel__tab--active')).toBe(true);
    expect(tabs[1].classList.contains('panel__tab--active')).toBe(false);
  });

  /* ---- Pipeline help modal ---- */

  it('shows help button when pipelineHelp returns content', () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => <div data-testid="help-content">Help text</div>}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    expect(screen.getByLabelText('How routing works')).toBeDefined();
  });

  it('does not show help button when pipelineHelp returns null', () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => null}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    expect(screen.queryByLabelText('How routing works')).toBeNull();
  });

  it('opens help modal on button click and shows content', async () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => <div data-testid="help-content">Pipeline info</div>}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    fireEvent.click(screen.getByLabelText('How routing works'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('How routing works', { selector: 'h2' })).toBeDefined();
      expect(screen.getByTestId('help-content')).toBeDefined();
    });
  });

  it('closes help modal on "Got it" click', async () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => <div>Help</div>}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    fireEvent.click(screen.getByLabelText('How routing works'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    fireEvent.click(screen.getByText('Got it'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes help modal on overlay click', async () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => <div>Help</div>}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    fireEvent.click(screen.getByLabelText('How routing works'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes help modal on Escape key', async () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => <div>Help</div>}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    fireEvent.click(screen.getByLabelText('How routing works'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not close help modal when clicking inside the dialog card', async () => {
    render(() => (
      <RoutingTabs
        specificityEnabled={() => false}
        customEnabled={() => false}
        pipelineHelp={() => <div>Help</div>}
      >
        {{
          default: <div>Default</div>,
          complexity: <div>Complexity</div>,
          specificity: <div>Specificity</div>,
          custom: <div>Custom</div>,
        }}
      </RoutingTabs>
    ));
    fireEvent.click(screen.getByLabelText('How routing works'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
