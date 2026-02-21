import { createSignal } from "solid-js";

const [isLocalMode, setIsLocalMode] = createSignal<boolean | null>(null);

let fetchPromise: Promise<boolean> | null = null;

export function checkLocalMode(): Promise<boolean> {
  if (isLocalMode() !== null) return Promise.resolve(isLocalMode()!);

  if (!fetchPromise) {
    fetchPromise = fetch("/api/v1/health")
      .then((res) => res.json())
      .then((data: { mode?: string }) => {
        const local = data.mode === "local";
        setIsLocalMode(local);
        return local;
      })
      .catch(() => {
        setIsLocalMode(false);
        return false;
      });
  }

  return fetchPromise;
}

export { isLocalMode };
