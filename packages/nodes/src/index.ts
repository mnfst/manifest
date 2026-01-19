/**
 * @manifest/nodes
 *
 * Node type definitions and execution logic for the flow builder.
 * This package provides:
 * - Built-in node types (StatCard, Return, CallFlow, UserIntent, ApiCall)
 * - Type definitions for creating custom nodes
 * - Node registry utilities
 */

// Type definitions for node types
export * from './types.js';

// Built-in node implementations
export * from './nodes/index.js';
