import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface UpdateInfo {
  latestVersion?: string;
  updateAvailable?: boolean;
}

@Injectable()
export class VersionCheckService implements OnModuleInit {
  private readonly logger = new Logger(VersionCheckService.name);
  private cachedLatest: string | null = null;
  private cacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly FETCH_TIMEOUT_MS = 5000;
  private static readonly VERSION_RE = /^\d+\.\d+\.\d+$/;

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) return;
    this.fetchLatestVersion().catch(() => {});
  }

  getCurrentVersion(): string {
    return process.env['MANIFEST_PACKAGE_VERSION'] ?? '0.0.0';
  }

  getUpdateInfo(): UpdateInfo {
    if (!this.cachedLatest) return {};
    const current = this.getCurrentVersion();
    if (!this.isNewer(this.cachedLatest, current)) return {};
    return { latestVersion: this.cachedLatest, updateAvailable: true };
  }

  isNewer(latest: string, current: string): boolean {
    const [lMaj, lMin, lPat] = latest.split('.').map(Number);
    const [cMaj, cMin, cPat] = current.split('.').map(Number);
    if (lMaj !== cMaj) return lMaj > cMaj;
    if (lMin !== cMin) return lMin > cMin;
    return lPat > cPat;
  }

  async fetchLatestVersion(): Promise<string | null> {
    if (this.cachedLatest && Date.now() < this.cacheExpiry) {
      return this.cachedLatest;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        VersionCheckService.FETCH_TIMEOUT_MS,
      );

      const res = await fetch(
        'https://registry.npmjs.org/manifest/latest',
        { signal: controller.signal },
      );
      clearTimeout(timer);

      if (!res.ok) return null;

      const data = (await res.json()) as { version?: string };
      const version = data?.version;
      if (!version || !VersionCheckService.VERSION_RE.test(version)) {
        return null;
      }

      this.cachedLatest = version;
      this.cacheExpiry = Date.now() + VersionCheckService.CACHE_TTL_MS;
      this.logger.log(`Latest manifest version: ${version}`);
      return version;
    } catch {
      this.logger.debug('Failed to check for updates');
      return null;
    }
  }

  private isEnabled(): boolean {
    if (process.env['MANIFEST_MODE'] !== 'local') return false;
    const opt = process.env['MANIFEST_TELEMETRY_OPTOUT'];
    if (opt === '1' || opt === 'true') return false;
    return true;
  }
}
