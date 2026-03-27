import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { ModelDiscoveryService } from '../model-discovery/model-discovery.service';
import { OLLAMA_HOST } from '../common/constants/ollama';

@Injectable()
export class OllamaSyncService {
  private readonly logger = new Logger(OllamaSyncService.name);

  constructor(
    @InjectRepository(UserProvider)
    private readonly providerRepo: Repository<UserProvider>,
    private readonly discoveryService: ModelDiscoveryService,
  ) {}

  async sync(): Promise<{ count: number }> {
    // Find the Ollama provider for any active agent and trigger discovery
    const ollamaProviders = await this.providerRepo.find({
      where: { provider: 'ollama', is_active: true },
    });

    if (ollamaProviders.length === 0) {
      // No active Ollama providers — just check if Ollama is reachable
      const url = `${OLLAMA_HOST}/api/tags`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
          this.logger.warn(`Ollama responded ${res.status} from ${url}`);
          return { count: 0 };
        }
        const data = (await res.json()) as { models?: unknown[] };
        return { count: data.models?.length ?? 0 };
      } catch (err) {
        this.logger.warn(`Could not reach Ollama at ${url}: ${(err as Error).message}`);
        return { count: 0 };
      }
    }

    let totalCount = 0;
    for (const provider of ollamaProviders) {
      const models = await this.discoveryService.discoverModels(provider);
      totalCount += models.length;
    }

    this.logger.log(`Synced ${totalCount} models from Ollama`);
    return { count: totalCount };
  }
}
