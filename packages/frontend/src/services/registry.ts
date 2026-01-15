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
  RegistryAppearanceOption,
} from '@chatgpt-app-builder/shared';

/**
 * Default registry URL
 */
const DEFAULT_REGISTRY_URL = 'https://ui.manifest.build/r';

/**
 * GitHub raw content base URL for fetching demo data
 */
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/mnfst/manifest/main/packages/manifest-ui';

/**
 * Cache for demo data (5 minute TTL - demo data changes rarely)
 */
const demoDataCache = new Map<string, { content: string; timestamp: number }>();
const DEMO_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch demo data for a component category from GitHub.
 * Returns null if fetch fails (graceful degradation).
 */
async function fetchDemoData(category: string): Promise<string | null> {
  // Check cache first
  const cached = demoDataCache.get(category);
  if (cached && Date.now() - cached.timestamp < DEMO_CACHE_TTL) {
    return cached.content;
  }

  const url = `${GITHUB_RAW_BASE}/registry/${category}/demo/data.ts`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const content = await response.text();
    demoDataCache.set(category, { content, timestamp: Date.now() });
    return content;
  } catch {
    return null;
  }
}

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
 * Fetch detailed component data including source code.
 * Also fetches demo data from GitHub and injects it into files array.
 */
export async function fetchComponentDetail(name: string): Promise<ComponentDetail> {
  const baseUrl = getRegistryBaseUrl();
  const response = await fetch(`${baseUrl}/${name}.json`);

  if (!response.ok) {
    throw new Error(`Failed to fetch component "${name}": ${response.status} ${response.statusText}`);
  }

  const detail: ComponentDetail = await response.json();

  // Fetch and inject demo data based on component category
  const category = detail.categories?.[0];
  if (category) {
    const demoDataContent = await fetchDemoData(category);
    if (demoDataContent) {
      detail.files = [
        ...(detail.files || []),
        {
          path: `registry/${category}/demo/data.ts`,
          type: 'registry:demo',
          content: demoDataContent,
        },
      ];
    }
  }

  return detail;
}

/**
 * Parse appearance options from component source code.
 * Looks for appearance?: { ... } in the Props interface and extracts the options.
 * Exported so it can be used to parse options from existing nodes.
 */
export function parseAppearanceOptions(sourceCode: string): RegistryAppearanceOption[] {
  const options: RegistryAppearanceOption[] = [];

  // Match appearance?: { ... } block in the source code
  // This regex captures the content inside the appearance object
  const appearanceMatch = sourceCode.match(/appearance\?\s*:\s*\{([^}]+)\}/s);
  if (!appearanceMatch) {
    return options;
  }

  const appearanceBlock = appearanceMatch[1];

  // Match each property: propertyName?: type pattern
  // Supports: boolean, string, number, and string literal unions
  const propertyRegex = /(\w+)\?\s*:\s*(boolean|string|number|'[^']+(?:'\s*\|\s*'[^']+')*)/g;
  let match;

  while ((match = propertyRegex.exec(appearanceBlock)) !== null) {
    const key = match[1];
    const typeStr = match[2];

    // Convert camelCase to Title Case for label
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    if (typeStr === 'boolean') {
      options.push({
        key,
        label,
        type: 'boolean',
        defaultValue: false,
        description: `Toggle ${label.toLowerCase()}`,
      });
    } else if (typeStr === 'string') {
      options.push({
        key,
        label,
        type: 'string',
        defaultValue: '',
        description: `Set ${label.toLowerCase()}`,
      });
    } else if (typeStr === 'number') {
      options.push({
        key,
        label,
        type: 'number',
        defaultValue: 0,
        description: `Set ${label.toLowerCase()}`,
      });
    } else if (typeStr.startsWith("'")) {
      // String literal union: 'value1' | 'value2' | 'value3'
      const enumValues = typeStr.match(/'([^']+)'/g)?.map((v) => v.replace(/'/g, '')) || [];
      if (enumValues.length > 0) {
        options.push({
          key,
          label,
          type: 'enum',
          enumValues,
          defaultValue: enumValues[0],
          description: `Select ${label.toLowerCase()}`,
        });
      }
    }
  }

  return options;
}

/**
 * Transform ComponentDetail to RegistryNodeParameters for storage in node data
 */
export function transformToNodeParameters(detail: ComponentDetail): RegistryNodeParameters {
  // Extract appearance options from the first file's source code
  const sourceCode = detail.files?.[0]?.content || '';
  const appearanceOptions = parseAppearanceOptions(sourceCode);

  return {
    registryName: detail.name,
    version: detail.version,
    title: detail.title || detail.name,
    description: detail.description || 'No description',
    category: detail.categories[0] || 'miscellaneous',
    previewUrl: detail.meta?.preview,
    dependencies: detail.dependencies || [],
    registryDependencies: detail.registryDependencies || [],
    files: detail.files || [],
    appearanceOptions: appearanceOptions.length > 0 ? appearanceOptions : undefined,
  };
}
