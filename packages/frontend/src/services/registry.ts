/**
 * Registry Service
 *
 * Fetches UI component data from the registry API.
 * No caching - always fetches fresh data per clarifications.
 */

import type {
  RegistryResponse,
  RegistryItem,
  ComponentDetail,
  RegistryNodeParameters,
} from '@chatgpt-app-builder/shared';

/**
 * Default registry URL
 */
const DEFAULT_REGISTRY_URL = 'https://ui.manifest.build/r';

/**
 * Get the registry base URL from environment or use default
 */
function getRegistryBaseUrl(): string {
  return import.meta.env.VITE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
}

/**
 * Fetch the registry list (all available components)
 * Always fetches fresh data - no caching.
 */
export async function fetchRegistry(): Promise<RegistryItem[]> {
  const baseUrl = getRegistryBaseUrl();
  const response = await fetch(`${baseUrl}/registry.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
  }

  const data: RegistryResponse = await response.json();
  return data.items;
}

/**
 * Fetch detailed component data including source code
 * Always fetches fresh data - no caching.
 */
export async function fetchComponentDetail(name: string): Promise<ComponentDetail> {
  const baseUrl = getRegistryBaseUrl();
  const response = await fetch(`${baseUrl}/${name}.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch component "${name}": ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Transform ComponentDetail to RegistryNodeParameters for storage in node data
 */
export function transformToNodeParameters(detail: ComponentDetail): RegistryNodeParameters {
  return {
    registryName: detail.name,
    version: detail.version,
    title: detail.title || detail.name,
    description: detail.description || 'No description',
    category: detail.category,
    previewUrl: detail.meta?.preview,
    dependencies: detail.dependencies || [],
    registryDependencies: detail.registryDependencies || [],
    files: detail.files || [],
  };
}
