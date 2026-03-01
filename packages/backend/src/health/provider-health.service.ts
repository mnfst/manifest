import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ModelPricing } from '../entities/model-pricing.entity';

export interface ProviderHealthSummary {
    total: number;
    healthy: number;
    issues: number;
}

@Injectable()
export class ProviderHealthService {
    private readonly logger = new Logger(ProviderHealthService.name);
    private lastSummary: ProviderHealthSummary = { total: 0, healthy: 0, issues: 0 };

    constructor(
        @InjectRepository(ModelPricing)
        private readonly modelPricingRepo: Repository<ModelPricing>,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkAllProviders() {
        this.logger.log('Running scheduled provider health checks...');

        try {
            const providersData = await this.modelPricingRepo
                .createQueryBuilder('mp')
                .select('DISTINCT mp.provider', 'provider')
                .where('mp.provider IS NOT NULL')
                .andWhere("mp.provider != ''")
                .getRawMany();

            let healthy = 0;
            let issues = 0;
            const total = providersData.length;

            for (const { provider } of providersData) {
                const isHealthy = await this.checkProviderHealth(provider);
                if (isHealthy) {
                    healthy++;
                } else {
                    issues++;
                }
            }

            this.lastSummary = { total, healthy, issues };
            this.logger.log(`Health check completed. Providers: ${total} Total, ${healthy} Healthy, ${issues} Issues.`);
        } catch (error) {
            this.logger.error('Failed to run provider health checks', (error as Error).message);
        }
    }

    private async checkProviderHealth(provider: string): Promise<boolean> {
        try {
            switch (provider.toLowerCase()) {
                case 'openai':
                    const oaiRes = await axios.get('https://status.openai.com/api/v2/status.json', { timeout: 5000 });
                    return oaiRes.data?.status?.indicator === 'none';

                case 'anthropic':
                    const anthropicRes = await axios.get('https://status.claude.com/api/v2/status.json', { timeout: 5000 });
                    return anthropicRes.data?.status?.indicator === 'none';

                case 'google':
                case 'google-genai':
                    return true; // Assume healthy, as Gemini API lacks a dedicated public status JSON endpoint currently.

                case 'ollama':
                    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
                    const ollamaRes = await axios.get(`${ollamaUrl}/api/version`, { timeout: 2000 });
                    return ollamaRes.status === 200;

                default:
                    this.logger.debug(`Unknown provider during health check: ${provider}`);
                    return true;
            }
        } catch (error) {
            this.logger.warn(`Health check failed for provider: ${provider} - ${(error as Error).message}`);
            return false;
        }
    }

    getSummary(): ProviderHealthSummary {
        return this.lastSummary;
    }
}
