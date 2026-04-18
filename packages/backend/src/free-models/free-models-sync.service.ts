import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface GitHubModel {
  id: string | null;
  name: string;
  context: string;
  maxOutput: string;
  modality: string;
  rateLimit: string;
}

export interface GitHubProvider {
  name: string;
  category: string;
  country: string;
  flag: string;
  url: string;
  baseUrl: string | null;
  description: string;
  footnoteRef: number | null;
  models: GitHubModel[];
}

interface GitHubDataJson {
  lastUpdated: string;
  providers: GitHubProvider[];
}

const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/mnfst/awesome-free-llm-apis/main/data.json';

@Injectable()
export class FreeModelsSyncService implements OnModuleInit {
  private readonly logger = new Logger(FreeModelsSyncService.name);
  private cache: GitHubProvider[] = [];
  private lastFetchedAt: Date | null = null;

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshCache();
    } catch (err) {
      this.logger.error(`Startup free models sync failed: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshCache(): Promise<number> {
    this.logger.log('Refreshing free models cache from GitHub...');
    const data = await this.fetchData();
    if (!data) return 0;

    this.cache = data.providers;
    this.lastFetchedAt = new Date();
    this.logger.log(`Free models cache loaded: ${data.providers.length} providers`);
    return data.providers.length;
  }

  getAll(): readonly GitHubProvider[] {
    return this.cache;
  }

  getLastFetchedAt(): Date | null {
    return this.lastFetchedAt;
  }

  private async fetchData(): Promise<GitHubDataJson | null> {
    try {
      const res = await fetch(GITHUB_RAW_URL);
      if (!res.ok) {
        this.logger.error(`GitHub raw returned ${res.status}`);
        return null;
      }
      const body = (await res.json()) as GitHubDataJson;
      if (!Array.isArray(body.providers)) {
        this.logger.error('GitHub data.json missing providers array');
        return null;
      }
      return body;
    } catch (err) {
      this.logger.error(`Failed to fetch free models data: ${err}`);
      return null;
    }
  }
}
