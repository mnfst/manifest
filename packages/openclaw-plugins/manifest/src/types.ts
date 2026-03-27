export interface PluginLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

export interface LocalConfig {
  port: number;
  host: string;
}
