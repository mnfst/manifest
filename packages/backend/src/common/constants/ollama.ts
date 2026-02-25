/** Ollama server base URL. Respects OLLAMA_HOST env var (Ollama's own convention). */
export const OLLAMA_HOST =
  process.env['OLLAMA_HOST'] || 'http://localhost:11434';
