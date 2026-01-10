import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import type { AppAnalyticsResponse, AnalyticsTimeRange } from '@chatgpt-app-builder/shared';

@Controller('api/apps')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/apps/:appId/analytics
   *
   * Get aggregated analytics data for an app including:
   * - Total executions, success rate, and average duration
   * - Trend indicators comparing to prior period
   * - Time-series chart data
   * - Available flows for filtering
   */
  @Get(':appId/analytics')
  async getAppAnalytics(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Query('timeRange') timeRange?: AnalyticsTimeRange,
    @Query('flowId') flowId?: string
  ): Promise<AppAnalyticsResponse> {
    return this.analyticsService.getAppAnalytics(
      appId,
      timeRange,
      flowId
    );
  }
}
