import { useEffect, useRef, useCallback } from 'react';

interface UseExecutionPollingOptions {
  /** Whether polling is enabled */
  enabled: boolean;
  /** Whether there are pending executions */
  hasPendingExecutions: boolean;
  /** Polling interval in milliseconds */
  interval?: number;
  /** Callback to refresh data */
  onRefresh: () => void;
}

/**
 * Hook to manage polling for execution status updates.
 * Polls when:
 * - enabled is true
 * - there are pending executions
 * Stops polling when:
 * - enabled is false (tab inactive)
 * - no pending executions
 */
export function useExecutionPolling({
  enabled,
  hasPendingExecutions,
  interval = 3000,
  onRefresh,
}: UseExecutionPollingOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);

  // Keep callback ref updated
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      onRefreshRef.current();
    }, interval);
  }, [interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Control polling based on enabled and hasPendingExecutions
  useEffect(() => {
    const shouldPoll = enabled && hasPendingExecutions;

    if (shouldPoll) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, hasPendingExecutions, startPolling, stopPolling]);

  return { isPolling: !!intervalRef.current };
}
