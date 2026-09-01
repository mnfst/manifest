import { describe, it, expect, beforeEach } from 'vitest';
import {
  breadcrumbCurrent,
  breadcrumbTrail,
  clearBreadcrumb,
  setBreadcrumb,
  viaFromState,
} from '../../src/services/breadcrumb-store';

describe('breadcrumb store', () => {
  beforeEach(() => clearBreadcrumb());

  it('starts empty and stores a trail plus the current page', () => {
    expect(breadcrumbTrail()).toEqual([]);
    expect(breadcrumbCurrent()).toBeNull();
    setBreadcrumb([{ label: 'Users', href: '/users' }], { label: 'Maya' });
    expect(breadcrumbTrail()).toEqual([{ label: 'Users', href: '/users' }]);
    expect(breadcrumbCurrent()).toEqual({ label: 'Maya' });
    clearBreadcrumb();
    expect(breadcrumbTrail()).toEqual([]);
    expect(breadcrumbCurrent()).toBeNull();
  });

  it('reads a via trail off router state and tolerates junk', () => {
    const via = [{ label: 'Projects', href: '/projects' }];
    expect(viaFromState({ via })).toBe(via);
    expect(viaFromState({ via: 'x' })).toEqual([]);
    expect(viaFromState(null)).toEqual([]);
    expect(viaFromState(undefined)).toEqual([]);
    expect(viaFromState('str')).toEqual([]);
  });
});
