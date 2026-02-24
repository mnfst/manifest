import { createSignal } from "solid-js";

const STORAGE_KEY = "manifest-display-name";

const [name, setNameRaw] = createSignal(
  localStorage.getItem(STORAGE_KEY) || "",
);

export function displayName(): string {
  return name();
}

export function setDisplayName(value: string): void {
  const trimmed = value.trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  setNameRaw(trimmed);
}
