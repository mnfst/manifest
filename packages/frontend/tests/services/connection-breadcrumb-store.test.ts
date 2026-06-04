import { describe, expect, it } from 'vitest';
import {
  connectionBreadcrumbBackLink,
  connectionBreadcrumbName,
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
});
