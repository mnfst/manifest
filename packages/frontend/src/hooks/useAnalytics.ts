import { useState, useEffect, useCallback } from 'react';
import type { AnalyticsTimeRange, AppAnalyticsResponse } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';

interface UseAnalyticsOptions {
  appId: string;
  timeRange?: AnalyticsTimeRange;
  flowId?: string;
}

interface UseAnalyticsResult {
  data: AppAnalyticsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch analytics data for an app.
 * Automatically refetches when timeRange or flowId changes.
 */
export function useAnalytics({
  appId,
  timeRange = '7d',
  flowId,
}: UseAnalyticsOptions): UseAnalyticsResult {
  const [data, setData] = useState<AppAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!appId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getAppAnalytics(appId, {
        timeRange,
        flowId: flowId || undefined,
      });
      setData(response);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load analytics data');
      }
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [appId, timeRange, flowId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchAnalytics,
  };
}
