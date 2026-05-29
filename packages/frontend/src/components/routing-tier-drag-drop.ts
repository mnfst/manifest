import { createSignal } from 'solid-js';
import type { AuthType, ModelRoute } from '../services/api.js';
import { toast } from '../services/toast-store.js';

export interface RoutingTierDragDropConfig {
  agentName: () => string;
  tierId: () => string;
  getPrimaryModel: () => string | null;
  getPrimaryRoute: () => ModelRoute | null;
  getFallbacks: () => string[];
  getFallbackRoutes: () => ModelRoute[] | null;
  onFallbackUpdate: (fallbacks: string[], routes: ModelRoute[] | null) => void;
  onPrimaryOverride: (
    model: string,
    provider: string,
    authType?: AuthType,
    keyLabel?: string,
  ) => Promise<void>;
  persistFallbacks: (
    agentName: string,
    tier: string,
    models: string[],
    routes?: ModelRoute[],
  ) => Promise<unknown>;
  resolveProviderForModel: (model: string) => string | undefined;
}

export function createRoutingTierDragDrop(config: RoutingTierDragDropConfig) {
  const [primaryDragging, setPrimaryDragging] = createSignal(false);
  const [fallbackDragging, setFallbackDragging] = createSignal<number | null>(null);
  const [primaryDropTarget, setPrimaryDropTarget] = createSignal(false);
  const [swappingFbIndex, setSwappingFbIndex] = createSignal<number | null>(null);

  const handlePrimaryDragStart = (e: DragEvent) => {
    setPrimaryDragging(true);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'primary');
      e.dataTransfer.setData('application/x-primary', 'true');
    }
  };

  const handlePrimaryDragEnd = () => {
    setPrimaryDragging(false);
    setPrimaryDropTarget(false);
  };

  const handlePrimaryDragOver = (e: DragEvent) => {
    if (fallbackDragging() === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setPrimaryDropTarget(true);
  };

  const handlePrimaryDragLeave = () => {
    setPrimaryDropTarget(false);
  };

  const swapPrimaryWithFallback = async (fbIndex: number) => {
    const currentModel = config.getPrimaryModel();
    if (!currentModel) return;
    setSwappingFbIndex(fbIndex);
    const currentRoute = config.getPrimaryRoute();
    const fallbacks = config.getFallbacks();
    const fbModel = fallbacks[fbIndex];
    if (!fbModel) {
      setSwappingFbIndex(null);
      return;
    }
    const fallbackRoutes = config.getFallbackRoutes();
    const fbRoute = fallbackRoutes?.[fbIndex] ?? null;
    const newFallbacks = [...fallbacks];
    newFallbacks[fbIndex] = currentModel;
    const newRoutes =
      fallbackRoutes && currentRoute && fallbackRoutes.length === fallbacks.length
        ? fallbackRoutes.map((r, i) => (i === fbIndex ? currentRoute : r))
        : null;
    config.onFallbackUpdate(newFallbacks, newRoutes);
    try {
      await config.persistFallbacks(
        config.agentName(),
        config.tierId(),
        newFallbacks,
        newRoutes ?? undefined,
      );
    } catch {
      config.onFallbackUpdate(fallbacks, fallbackRoutes);
      toast.error('Failed to update fallbacks');
      setSwappingFbIndex(null);
      return;
    }
    const provId = fbRoute?.provider ?? config.resolveProviderForModel(fbModel);
    try {
      await config.onPrimaryOverride(
        fbModel,
        provId ?? '',
        fbRoute?.authType,
        fbRoute?.keyLabel ?? undefined,
      );
    } finally {
      setSwappingFbIndex(null);
    }
  };

  const handlePrimaryDrop = (e: DragEvent) => {
    e.preventDefault();
    setPrimaryDropTarget(false);
    const fbIndex = fallbackDragging();
    if (fbIndex === null) return;
    setFallbackDragging(null);
    void swapPrimaryWithFallback(fbIndex);
  };

  const handlePrimaryDropAtSlot = async (slot: number) => {
    const currentModel = config.getPrimaryModel();
    if (!currentModel) return;
    setSwappingFbIndex(slot > 0 ? slot - 1 : 0);
    const currentRoute = config.getPrimaryRoute();
    const fallbacks = config.getFallbacks();
    const fallbackRoutes = config.getFallbackRoutes();
    const newFallbacks = [...fallbacks];
    newFallbacks.splice(slot, 0, currentModel);
    const newPrimary = newFallbacks.shift()!;
    if (newPrimary === currentModel && slot === 0) {
      setSwappingFbIndex(null);
      return;
    }
    const buildRoutes = (): ModelRoute[] | null => {
      if (!currentRoute || !fallbackRoutes || fallbackRoutes.length !== fallbacks.length) {
        return null;
      }
      const next = [...fallbackRoutes];
      next.splice(slot, 0, currentRoute);
      next.shift();
      return next;
    };
    const newRoutes = buildRoutes();
    const newPrimaryRoute =
      newRoutes && newRoutes.length === newFallbacks.length ? fallbackRoutes![0] : null;
    config.onFallbackUpdate(newFallbacks, newRoutes);
    try {
      await config.persistFallbacks(
        config.agentName(),
        config.tierId(),
        newFallbacks,
        newRoutes ?? undefined,
      );
    } catch {
      config.onFallbackUpdate(fallbacks, fallbackRoutes);
      toast.error('Failed to update fallbacks');
      setSwappingFbIndex(null);
      return;
    }
    const provId = newPrimaryRoute?.provider ?? config.resolveProviderForModel(newPrimary);
    try {
      await config.onPrimaryOverride(
        newPrimary,
        provId ?? '',
        newPrimaryRoute?.authType,
        newPrimaryRoute?.keyLabel ?? undefined,
      );
    } finally {
      setSwappingFbIndex(null);
    }
  };

  return {
    primaryDragging,
    fallbackDragging,
    primaryDropTarget,
    swappingFbIndex,
    handlePrimaryDragStart,
    handlePrimaryDragEnd,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handlePrimaryDrop,
    handlePrimaryDropAtSlot,
    setFallbackDragging,
  };
}
