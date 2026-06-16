import { describe, expect, it } from 'vitest';
import {
  connectionBreadcrumbBackLabel,
  connectionBreadcrumbBackLink,
  connectionBreadcrumbLabel,
  connectionBreadcrumbName,
  connectionBreadcrumbProviderId,
  setConnectionBreadcrumb,
} from '../../src/services/connection-breadcrumb-store';

describe('connection breadcrumb store', () => {
  it('stores the connection label and optional return link', () => {
    expect(connectionBreadcrumbName()).toBeNull();
    expect(connectionBreadcrumbBackLink()).toBe('/providers/subscriptions');

    setConnectionBreadcrumb('OpenAI Default', '/providers/byok');
    expect(connectionBreadcrumbName()).toBe('OpenAI Default');
    expect(connectionBreadcrumbBackLink()).toBe('/providers/byok');

    setConnectionBreadcrumb(null);
    expect(connectionBreadcrumbName()).toBeNull();
    expect(connectionBreadcrumbBackLink()).toBe('/providers/byok');
  });

  it('stores the provider id, label and back label when provided', () => {
    expect(connectionBreadcrumbProviderId()).toBeNull();
    expect(connectionBreadcrumbLabel()).toBeNull();

    setConnectionBreadcrumb(
      'OpenAI Default',
      '/providers/usage-based',
      'Usage-based',
      'openai',
      'Default',
    );
    expect(connectionBreadcrumbProviderId()).toBe('openai');
    expect(connectionBreadcrumbLabel()).toBe('Default');
    expect(connectionBreadcrumbBackLabel()).toBe('Usage-based');

    // Omitting the optional fields resets id/label to null but keeps the
    // previously set back label.
    setConnectionBreadcrumb('Anthropic');
    expect(connectionBreadcrumbProviderId()).toBeNull();
    expect(connectionBreadcrumbLabel()).toBeNull();
    expect(connectionBreadcrumbBackLabel()).toBe('Usage-based');
  });
});
