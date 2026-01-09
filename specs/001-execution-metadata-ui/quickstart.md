# Quickstart: Execution Metadata and Usage UI

**Feature**: 001-execution-metadata-ui
**Date**: 2026-01-08

## Overview

This feature standardizes how nodes report execution results and enhances the Usage tab UI to display execution status prominently.

## Key Concepts

### 1. Standardized Node Output

All nodes now output data in a consistent format:

```typescript
{
  // Actual data at root level
  field1: "value",
  field2: 123,

  // Execution metadata
  _execution: {
    success: true,
    durationMs: 234
  }
}
```

### 2. Accessing Data in Downstream Nodes

Data is now directly accessible at root:

```typescript
// In a transformer accessing ApiCall output:
function transform(input) {
  // Direct access to data fields
  const responseBody = input.apiCallNode.body;
  const statusCode = input.apiCallNode.status;

  // Access execution metadata if needed
  const wasSuccessful = input.apiCallNode._execution.success;
  const duration = input.apiCallNode._execution.durationMs;

  return { processed: responseBody };
}
```

### 3. Error Handling

When a node fails, the error is in `_execution`:

```typescript
{
  _execution: {
    success: false,
    error: "Connection timeout after 30000ms",
    durationMs: 30000
  }
}
```

## Implementation Guide

### For Node Developers

#### Updating a Node's Execute Function

```typescript
// Before (example)
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  try {
    const result = await doSomething();
    return {
      success: true,
      output: { type: 'myNode', data: result }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: { type: 'myNode', error: error.message }
    };
  }
}

// After
async execute(context: ExecutionContext): Promise<ExecutionResult> {
  const startTime = performance.now();
  try {
    const result = await doSomething();
    const durationMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      output: {
        // Data at root
        type: 'myNode',
        ...result,

        // Execution metadata
        _execution: {
          success: true,
          durationMs
        }
      }
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);

    return {
      success: false,
      error: error.message,
      output: {
        type: 'myNode',
        _execution: {
          success: false,
          error: error.message,
          durationMs
        }
      }
    };
  }
}
```

### For UI Components

#### Displaying Execution Status

```tsx
// NodeExecutionCard component pattern
function NodeExecutionCard({ nodeExecution }) {
  const output = nodeExecution.outputData;

  // Check for new format
  const hasMetadata = output && '_execution' in output;

  // Extract status (with backward compatibility)
  const isSuccess = hasMetadata
    ? output._execution.success
    : nodeExecution.status === 'completed';

  const errorMessage = hasMetadata
    ? output._execution.error
    : nodeExecution.error;

  const duration = hasMetadata
    ? output._execution.durationMs
    : nodeExecution.executionTimeMs;

  return (
    <div className="node-card">
      {/* Status indicator */}
      <StatusIcon success={isSuccess} />

      {/* Error banner (if failed) */}
      {!isSuccess && errorMessage && (
        <ErrorBanner message={errorMessage} />
      )}

      {/* Duration */}
      {duration && <Duration ms={duration} />}

      {/* Data viewer (excluding _execution) */}
      <DataViewer data={extractOutputData(output)} />
    </div>
  );
}
```

## Visual Reference

### Successful Node Execution

```
┌─────────────────────────────────────┐
│ API Call                  ✓ 234ms  │
├─────────────────────────────────────┤
│ ▼ Output Data                       │
│   {                                 │
│     "status": 200,                  │
│     "body": { ... }                 │
│   }                                 │
└─────────────────────────────────────┘
```

### Failed Node Execution

```
┌─────────────────────────────────────┐
│ API Call                  ✗ 30.0s  │
├─────────────────────────────────────┤
│ ⚠️ Connection timeout after 30s    │
├─────────────────────────────────────┤
│ ▶ Output Data (collapsed)          │
└─────────────────────────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/types/execution.ts` | Add ExecutionMetadata interfaces |
| `packages/nodes/src/nodes/*/` | Update execute() for each node type |
| `packages/backend/src/mcp/mcp.tool.ts` | Update execution handling |
| `packages/frontend/src/components/execution/NodeExecutionCard.tsx` | Add status indicators |
| `packages/frontend/src/components/execution/ExecutionList.tsx` | Add failed node indicator |
| `packages/frontend/src/components/execution/ExecutionDataViewer.tsx` | Separate _execution display |

## Testing Checklist

- [ ] Create a flow with multiple node types
- [ ] Execute the flow successfully - verify green indicators
- [ ] Trigger an API failure - verify red indicator and error banner
- [ ] Check execution durations are displayed
- [ ] Verify backward compatibility with existing executions
- [ ] Confirm error messages visible without expanding data
