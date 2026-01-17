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
  LayoutAction,
  JSONSchema,
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
 * Cache for component details to avoid re-fetching dependencies
 */
const componentDetailCache = new Map<string, { detail: ComponentDetail; timestamp: number }>();

/**
 * UI components that are already available via glob import (no need to fetch)
 */
const BUILTIN_UI_COMPONENTS = new Set([
  'button', 'checkbox', 'input', 'label', 'select', 'textarea',
  'card', 'dialog', 'dropdown-menu', 'popover', 'tooltip',
  'tabs', 'accordion', 'avatar', 'badge', 'separator',
  'scroll-area', 'skeleton', 'slider', 'switch', 'toggle',
]);

/**
 * Get the registry base URL from environment or use default
 */
function getRegistryBaseUrl(): string {
  return import.meta.env.VITE_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
}

/**
 * Extract component name from a registry dependency.
 * Handles both simple names ("event-card") and full URLs.
 */
function extractComponentName(dep: string): string | null {
  // Skip built-in UI components
  if (BUILTIN_UI_COMPONENTS.has(dep)) {
    return null;
  }

  // Handle full URLs like "https://ui.manifest.build/r/event-card.json"
  if (dep.startsWith('http')) {
    const match = dep.match(/\/([^/]+)\.json$/);
    return match ? match[1] : null;
  }

  // Simple component name like "event-card"
  return dep;
}

/**
 * Fetch a component's raw detail without processing dependencies (to avoid recursion).
 * Uses caching to avoid repeated fetches.
 */
async function fetchComponentDetailRaw(name: string): Promise<ComponentDetail | null> {
  // Check cache first
  const cached = componentDetailCache.get(name);
  if (cached && Date.now() - cached.timestamp < DEMO_CACHE_TTL) {
    return cached.detail;
  }

  const baseUrl = getRegistryBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/${name}.json`);
    if (!response.ok) return null;
    const detail: ComponentDetail = await response.json();
    componentDetailCache.set(name, { detail, timestamp: Date.now() });
    return detail;
  } catch {
    return null;
  }
}

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
 * Also fetches demo data and registry dependencies, injecting them into files array.
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

  // Fetch and inject registry dependencies (other registry components this component imports)
  const registryDeps = detail.registryDependencies || [];
  if (registryDeps.length > 0) {
    // Extract component names from dependencies (skip built-in UI components)
    const componentNames = registryDeps
      .map(extractComponentName)
      .filter((n): n is string => n !== null);

    // Fetch all dependency details in parallel
    const depDetails = await Promise.all(
      componentNames.map(depName => fetchComponentDetailRaw(depName))
    );

    // Collect all files from dependencies, avoiding duplicates
    const existingPaths = new Set((detail.files || []).map(f => f.path));
    const depFiles: ComponentDetail['files'] = [];

    for (const depDetail of depDetails) {
      if (depDetail?.files) {
        for (const file of depDetail.files) {
          if (!existingPaths.has(file.path)) {
            depFiles.push(file);
            existingPaths.add(file.path);
          }
        }
      }
    }

    if (depFiles.length > 0) {
      detail.files = [...(detail.files || []), ...depFiles];
    }
  }

  return detail;
}

// ===========================================
// Props Interface Parsing (Unified)
// ===========================================

/**
 * Result of parsing a component's Props interface.
 * Contains all extracted prop information in one place.
 */
interface ParsedProps {
  inputSchema?: JSONSchema;
  appearanceOptions: RegistryAppearanceOption[];
  actions: LayoutAction[];
}

/**
 * Parse the component's Props interface to extract data, appearance, and actions.
 * This is the single source of truth for all prop-related information.
 */
function parsePropsInterface(sourceCode: string): ParsedProps {
  const result: ParsedProps = {
    appearanceOptions: [],
    actions: [],
  };

  // Find the Props interface (e.g., "interface EventListProps {")
  const propsMatch = sourceCode.match(/interface\s+\w+Props\s*\{/);
  if (!propsMatch) return result;

  // Extract the full Props interface body
  const startIndex = propsMatch.index! + propsMatch[0].length;
  const propsBody = extractBracketContent(sourceCode, startIndex - 1, '{', '}');
  if (!propsBody) return result;

  // Extract data prop -> inputSchema
  result.inputSchema = extractDataSchema(propsBody);

  // Extract appearance prop -> appearanceOptions
  result.appearanceOptions = extractAppearanceOptions(propsBody);

  // Extract actions prop -> actions
  result.actions = extractActions(propsBody, sourceCode);

  return result;
}

/**
 * Extract the data prop type and convert to JSON Schema.
 */
function extractDataSchema(propsBody: string): JSONSchema | undefined {
  // Find the data property: data?: { ... }
  const dataMatch = propsBody.match(/data\??\s*:\s*\{/);
  if (!dataMatch) return undefined;

  const dataStartIndex = dataMatch.index! + dataMatch[0].length;
  const dataBody = extractBracketContent(propsBody, dataStartIndex - 1, '{', '}');
  if (!dataBody) return undefined;

  return parseTypeScriptObjectToSchema(dataBody);
}

/**
 * Extract JSDoc description from a comment block.
 * Returns the first paragraph of the JSDoc, excluding @tags.
 */
function extractJSDocDescription(comment: string): string | undefined {
  // Remove /** and */ markers (handle various formats)
  const cleaned = comment
    .replace(/^\/\*\*\s*/, '')  // Remove opening /**
    .replace(/\*\/\s*$/, '')     // Remove closing */
    .replace(/\*\//g, '')        // Remove any remaining */
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim())
    .filter(line => !line.startsWith('@') && line !== '/')
    .join(' ')
    .trim()
    .replace(/\s*\/\s*$/, '');   // Remove trailing slash if any

  return cleaned || undefined;
}

/**
 * Extract default value from JSDoc @default tag.
 */
function extractJSDocDefault(comment: string): string | undefined {
  const defaultMatch = comment.match(/@default\s+(\S+)/);
  return defaultMatch?.[1];
}

/**
 * Extract appearance options from the Props interface.
 * Parses JSDoc comments for descriptions.
 */
function extractAppearanceOptions(propsBody: string): RegistryAppearanceOption[] {
  const options: RegistryAppearanceOption[] = [];

  // Find the appearance property: appearance?: { ... }
  const appearanceMatch = propsBody.match(/appearance\??\s*:\s*\{/);
  if (!appearanceMatch) return options;

  const startIndex = appearanceMatch.index! + appearanceMatch[0].length;
  const appearanceBody = extractBracketContent(propsBody, startIndex - 1, '{', '}');
  if (!appearanceBody) return options;

  // Match each property with optional JSDoc: /** ... */ propertyName?: type
  const propertyRegex = /(\/\*\*[\s\S]*?\*\/\s*)?(\w+)\??\s*:\s*(boolean|string|number|'[^']+(?:'\s*\|\s*'[^']+')*|\d+(?:\s*\|\s*\d+)*)/g;
  let match;

  while ((match = propertyRegex.exec(appearanceBody)) !== null) {
    const jsdocComment = match[1] || '';
    const key = match[2];
    const typeStr = match[3];

    // Convert camelCase to Title Case for label
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    // Extract JSDoc description if present
    const jsdocDescription = extractJSDocDescription(jsdocComment);
    const jsdocDefault = extractJSDocDefault(jsdocComment);

    if (typeStr === 'boolean') {
      const defaultValue = jsdocDefault === 'true' ? true : jsdocDefault === 'false' ? false : false;
      options.push({
        key,
        label,
        type: 'boolean',
        defaultValue,
        description: jsdocDescription,
      });
    } else if (typeStr === 'string') {
      options.push({
        key,
        label,
        type: 'string',
        defaultValue: jsdocDefault?.replace(/['"]/g, '') || '',
        description: jsdocDescription,
      });
    } else if (typeStr === 'number') {
      options.push({
        key,
        label,
        type: 'number',
        defaultValue: jsdocDefault ? parseFloat(jsdocDefault) : 0,
        description: jsdocDescription,
      });
    } else if (typeStr.startsWith("'")) {
      // String literal union: 'value1' | 'value2' | 'value3'
      const enumValues = typeStr.match(/'([^']+)'/g)?.map((v) => v.replace(/'/g, '')) || [];
      if (enumValues.length > 0) {
        const defaultEnumValue = jsdocDefault?.replace(/['"]/g, '');
        options.push({
          key,
          label,
          type: 'enum',
          enumValues,
          defaultValue: defaultEnumValue && enumValues.includes(defaultEnumValue) ? defaultEnumValue : enumValues[0],
          description: jsdocDescription,
        });
      }
    } else if (/^\d+(?:\s*\|\s*\d+)*$/.test(typeStr)) {
      // Number literal union: 2 | 3 | 4
      const enumValues = typeStr.split('|').map(v => parseInt(v.trim(), 10));
      const defaultEnumValue = jsdocDefault ? parseInt(jsdocDefault, 10) : enumValues[0];
      options.push({
        key,
        label,
        type: 'enum',
        enumValues,
        defaultValue: enumValues.includes(defaultEnumValue) ? defaultEnumValue : enumValues[0],
        description: jsdocDescription,
      });
    }
  }

  return options;
}

/**
 * Extract actions from the Props interface.
 */
function extractActions(propsBody: string, fullSourceCode: string): LayoutAction[] {
  const actions: LayoutAction[] = [];

  // Find the actions property: actions?: { ... }
  const actionsMatch = propsBody.match(/actions\??\s*:\s*\{/);
  if (actionsMatch) {
    const startIndex = actionsMatch.index! + actionsMatch[0].length;
    const actionsBody = extractBracketContent(propsBody, startIndex - 1, '{', '}');

    if (actionsBody) {
      // Match: onActionName?: (params) => void
      const actionRegex = /(on[A-Z]\w+)\??\s*:\s*\([^)]*\)\s*=>\s*void/g;
      let match;
      while ((match = actionRegex.exec(actionsBody)) !== null) {
        const name = match[1];
        const label = name.replace(/^on/, '').replace(/([A-Z])/g, ' $1').trim();
        actions.push({ name, label, description: `Triggered by ${label}` });
      }
    }
  }

  // Also check JSDoc @property tags for better descriptions
  const jsdocRegex = /@property\s*\{function\}\s*\[actions\.(on[A-Z]\w+)\]\s*-\s*([^\n]+)/g;
  let jsdocMatch;
  while ((jsdocMatch = jsdocRegex.exec(fullSourceCode)) !== null) {
    const name = jsdocMatch[1];
    const description = jsdocMatch[2].trim();
    const label = name.replace(/^on/, '').replace(/([A-Z])/g, ' $1').trim();
    const existingIndex = actions.findIndex((a) => a.name === name);
    if (existingIndex >= 0) {
      actions[existingIndex] = { name, label, description };
    } else {
      actions.push({ name, label, description });
    }
  }

  return actions;
}

// Legacy exports for backward compatibility (used by existing nodes)
export function parseAppearanceOptions(sourceCode: string): RegistryAppearanceOption[] {
  return parsePropsInterface(sourceCode).appearanceOptions;
}

export function parseComponentActions(sourceCode: string): LayoutAction[] {
  return parsePropsInterface(sourceCode).actions;
}

/**
 * Extract content within balanced brackets starting from a given position.
 */
function extractBracketContent(
  content: string,
  startIndex: number,
  openBracket: string,
  closeBracket: string
): string | null {
  let i = startIndex;
  while (i < content.length && content[i] !== openBracket) i++;
  if (i >= content.length) return null;

  let depth = 1;
  let j = i + 1;
  let inString = false;
  let stringChar = '';

  while (j < content.length && depth > 0) {
    const char = content[j];
    const prevChar = content[j - 1];

    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === openBracket) depth++;
      else if (char === closeBracket) depth--;
    }

    j++;
  }

  if (depth !== 0) return null;
  return content.slice(i + 1, j - 1);
}

/**
 * Parse a TypeScript object type definition into JSON Schema.
 * Handles: string, number, boolean, arrays, nested objects, optional properties.
 */
function parseTypeScriptObjectToSchema(typeBody: string): JSONSchema {
  const schema: JSONSchema = {
    type: 'object',
    properties: {},
  };
  const required: string[] = [];

  // Match property definitions: propName?: Type or propName: Type
  // Handle multi-line and nested types
  const lines = typeBody.split('\n');
  let currentProp = '';
  let depth = 0;

  for (const line of lines) {
    currentProp += line + '\n';

    // Count brackets to handle nested types
    for (const char of line) {
      if (char === '{' || char === '[' || char === '<') depth++;
      if (char === '}' || char === ']' || char === '>') depth--;
    }

    // If we're at depth 0 and have accumulated content, try to parse it
    if (depth === 0 && currentProp.trim()) {
      const propMatch = currentProp.match(/^\s*(\w+)(\?)?:\s*(.+)/s);
      if (propMatch) {
        const [, propName, optional, typeStr] = propMatch;
        const cleanType = typeStr.trim().replace(/;?\s*$/, '');

        if (propName && cleanType) {
          schema.properties![propName] = parseTypeToSchema(cleanType);
          if (!optional) {
            required.push(propName);
          }
        }
      }
      currentProp = '';
    }
  }

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * Convert a TypeScript type string to JSON Schema.
 */
function parseTypeToSchema(typeStr: string): JSONSchema {
  const cleanType = typeStr.trim();

  // Array type: Type[] or Array<Type>
  if (cleanType.endsWith('[]')) {
    const itemType = cleanType.slice(0, -2).trim();
    return {
      type: 'array',
      items: parseTypeToSchema(itemType),
    };
  }

  if (cleanType.startsWith('Array<') && cleanType.endsWith('>')) {
    const itemType = cleanType.slice(6, -1).trim();
    return {
      type: 'array',
      items: parseTypeToSchema(itemType),
    };
  }

  // Primitive types
  if (cleanType === 'string') return { type: 'string' };
  if (cleanType === 'number') return { type: 'number' };
  if (cleanType === 'boolean') return { type: 'boolean' };

  // Inline object type: { ... }
  if (cleanType.startsWith('{') && cleanType.endsWith('}')) {
    const innerBody = cleanType.slice(1, -1).trim();
    return parseTypeScriptObjectToSchema(innerBody);
  }

  // Type reference (e.g., Event, User) - treat as object since we don't have type definitions
  return { type: 'object' };
}

/**
 * Transform ComponentDetail to RegistryNodeParameters for storage in node data
 */
export function transformToNodeParameters(detail: ComponentDetail): RegistryNodeParameters {
  // Find the main component file (first .tsx file, excluding demo files)
  const componentFile = detail.files?.find(f => f.path.endsWith('.tsx') && !f.path.includes('/demo/'));
  const sourceCode = componentFile?.content || '';

  // Parse all props from the Props interface in one place
  const { inputSchema, appearanceOptions, actions } = parsePropsInterface(sourceCode);

  const files = detail.files || [];

  return {
    registryName: detail.name,
    version: detail.version,
    title: detail.title || detail.name,
    description: detail.description || 'No description',
    category: detail.categories[0] || 'miscellaneous',
    previewUrl: detail.meta?.preview,
    dependencies: detail.dependencies || [],
    registryDependencies: detail.registryDependencies || [],
    files,
    // Store original files for detecting customizations
    originalFiles: files.map(f => ({ ...f })),
    appearanceOptions: appearanceOptions.length > 0 ? appearanceOptions : undefined,
    actions: actions.length > 0 ? actions : undefined,
    inputSchema,
  };
}
