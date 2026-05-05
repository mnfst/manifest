import type { SendResult } from '../send';

export interface RunnerHooks {
  /**
   * Called by every stub before fetching, so the UI can capture the request
   * shape that the user's code produced.
   */
  onResult: (result: SendResult) => void;
}

export interface RunnerContext {
  /**
   * Default Base URL when the user's code doesn't override it (the Connection
   * panel value). Stubs append `/chat/completions` to it.
   */
  defaultBaseUrl: string;
  /**
   * Default API key when the user's code doesn't override it (the Connection
   * panel value).
   */
  defaultApiKey: string;
  hooks: RunnerHooks;
}
