import { createSignal } from "solid-js";

export interface UpdateInfo {
  version: string;
  latestVersion?: string;
  updateAvailable?: boolean;
}

interface HealthResponse {
  mode?: string;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
}

const [isLocalMode, setIsLocalMode] = createSignal<boolean | null>(null);
const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo | null>(null);

let fetchPromise: Promise<boolean> | null = null;

export function checkLocalMode(): Promise<boolean> {
  if (isLocalMode() !== null) return Promise.resolve(isLocalMode()!);

  if (!fetchPromise) {
    fetchPromise = fetch("/api/v1/health")
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        const local = data.mode === "local";
        setIsLocalMode(local);

        if (data.version) {
          setUpdateInfo({
            version: data.version,
            latestVersion: data.latestVersion,
            updateAvailable: data.updateAvailable,
          });
        }

        return local;
      })
      .catch(() => {
        setIsLocalMode(false);
        return false;
      });
  }

  return fetchPromise;
}

export { isLocalMode, updateInfo };
