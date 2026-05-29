import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoutingTierDragDrop } from '../../src/components/routing-tier-drag-drop.js';
import type { ModelRoute } from '../../src/services/api.js';

const mockToastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

describe('createRoutingTierDragDrop', () => {
  const primaryRoute: ModelRoute = {
    provider: 'openai',
    authType: 'api_key',
    model: 'gpt-4o',
  };
  const fallbackRoutes: ModelRoute[] = [
    { provider: 'anthropic', authType: 'api_key', model: 'claude-3' },
    { provider: 'openai', authType: 'api_key', model: 'gpt-4o-mini' },
  ];

  let fallbacks: string[];
  let onFallbackUpdate: ReturnType<typeof vi.fn>;
  let onPrimaryOverride: ReturnType<typeof vi.fn>;
  let persistFallbacks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fallbacks = ['claude-3', 'gpt-4o-mini'];
    onFallbackUpdate = vi.fn();
    onPrimaryOverride = vi.fn().mockResolvedValue(undefined);
    persistFallbacks = vi.fn().mockResolvedValue(undefined);
  });

  function makeDragDrop() {
    return createRoutingTierDragDrop({
      agentName: () => 'agent-1',
      tierId: () => 'tier-1',
      getPrimaryModel: () => 'gpt-4o',
      getPrimaryRoute: () => primaryRoute,
      getFallbacks: () => fallbacks,
      getFallbackRoutes: () => fallbackRoutes,
      onFallbackUpdate,
      onPrimaryOverride,
      persistFallbacks,
      resolveProviderForModel: (model) =>
        model === 'claude-3' ? 'anthropic' : model === 'gpt-4o-mini' ? 'openai' : 'openai',
    });
  }

  it('swaps primary with fallback on primary drop', async () => {
    const dnd = makeDragDrop();
    dnd.setFallbackDragging(0);
    const event = { preventDefault: vi.fn() } as unknown as DragEvent;
    dnd.handlePrimaryDrop(event);
    await vi.waitFor(() => {
      expect(onFallbackUpdate).toHaveBeenCalledWith(
        ['gpt-4o', 'gpt-4o-mini'],
        [
          { provider: 'openai', authType: 'api_key', model: 'gpt-4o' },
          { provider: 'openai', authType: 'api_key', model: 'gpt-4o-mini' },
        ],
      );
      expect(onPrimaryOverride).toHaveBeenCalledWith('claude-3', 'anthropic', 'api_key', undefined);
    });
  });

  it('promotes a fallback to primary when dropped at slot 1', async () => {
    const dnd = makeDragDrop();
    await dnd.handlePrimaryDropAtSlot(1);
    expect(onFallbackUpdate).toHaveBeenCalled();
    expect(onPrimaryOverride).toHaveBeenCalledWith(
      'claude-3',
      'anthropic',
      'api_key',
      undefined,
    );
  });

  it('rolls back optimistic fallback update when persist fails', async () => {
    persistFallbacks.mockRejectedValueOnce(new Error('network'));
    const dnd = makeDragDrop();
    dnd.setFallbackDragging(1);
    dnd.handlePrimaryDrop({ preventDefault: vi.fn() } as unknown as DragEvent);
    await vi.waitFor(() => {
      expect(onFallbackUpdate).toHaveBeenCalledTimes(2);
      expect(onFallbackUpdate).toHaveBeenLastCalledWith(fallbacks, fallbackRoutes);
      expect(mockToastError).toHaveBeenCalledWith('Failed to update fallbacks');
    });
  });
});
