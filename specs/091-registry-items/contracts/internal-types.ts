/**
 * Internal TypeScript Types for Registry-Based UI Nodes
 * Feature: 091-registry-items
 *
 * These types should be added to packages/shared/src/types/
 */

// ============================================
// External Registry Types (from API)
// ============================================

/**
 * Top-level registry response from registry.json
 */
export interface RegistryResponse {
  $schema?: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

/**
 * Registry item from the list endpoint (no file contents)
 */
export interface RegistryItem {
  name: string;
  version: string;
  type: string;
  title: string;
  description: string;
  category: RegistryCategory;
  dependencies: string[];
  registryDependencies: string[];
  files: FileMetadata[];
}

/**
 * File metadata in list response (path only)
 */
export interface FileMetadata {
  path: string;
  type: string;
}

/**
 * Full component detail including source code
 */
export interface ComponentDetail extends Omit<RegistryItem, 'files'> {
  $schema?: string;
  changelog?: Record<string, string>;
  files: ComponentFile[];
}

/**
 * File with full source code content
 */
export interface ComponentFile {
  path: string;
  type: string;
  content: string;
}

/**
 * Known registry categories
 */
export type RegistryCategory =
  | 'form'
  | 'payment'
  | 'list'
  | 'blogging'
  | 'messaging'
  | 'events'
  | 'miscellaneous'
  | string;

// ============================================
// Internal Types (for Node Storage)
// ============================================

/**
 * Parameters stored in registry component nodes
 */
export interface RegistryNodeParameters {
  // Core identity
  registryName: string;
  version: string;

  // Display metadata
  title: string;
  description: string;
  category: RegistryCategory;

  // Dependencies
  dependencies: string[];
  registryDependencies: string[];

  // Source code
  files: ComponentFile[];

  // Optional configuration
  variant?: string;
  customProps?: Record<string, unknown>;
}

// ============================================
// Frontend State Types
// ============================================

/**
 * Registry fetch state
 */
export type RegistryFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; items: RegistryItem[] }
  | { status: 'error'; message: string };

/**
 * Component detail fetch state
 */
export type ComponentDetailFetchState =
  | { status: 'idle' }
  | { status: 'loading'; componentName: string }
  | { status: 'loaded'; detail: ComponentDetail }
  | { status: 'error'; message: string };

/**
 * Registry category info for UI display
 */
export interface RegistryCategoryInfo {
  id: string;
  displayName: string;
  itemCount: number;
  order: number;
}

/**
 * Registry item transformed for NodeLibrary display
 */
export interface RegistryNodeTypeInfo {
  name: string;           // registryName for unique identification
  displayName: string;    // title
  description: string;
  version: string;
  category: RegistryCategory;
  icon: string;           // Default icon for registry components
}

// ============================================
// Node Type Extension
// ============================================

/**
 * Extended NodeType to include registry components
 * Add 'RegistryComponent' to existing NodeType union
 */
export type ExtendedNodeType =
  | 'UserIntent'
  | 'Return'
  | 'CallFlow'
  | 'ApiCall'
  | 'JavaScriptCodeTransform'
  | 'Link'
  | 'RegistryComponent';  // New type for all registry items

// ============================================
// API Response Types
// ============================================

/**
 * Extended NodeTypesResponse to include registry loading state
 */
export interface ExtendedNodeTypesResponse {
  nodeTypes: Array<import('@chatgpt-app-builder/shared').NodeTypeInfo>;
  categories: Array<import('@chatgpt-app-builder/shared').CategoryInfo>;
  registryState?: RegistryFetchState;
}
