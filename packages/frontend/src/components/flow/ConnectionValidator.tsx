import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, HelpCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { CompatibilityIssue, CompatibilityStatus, JSONSchema } from '@chatgpt-app-builder/shared';
import { Button } from '@/components/ui/shadcn/button';
import type { ConnectionValidationState } from '../../types/schema';
import { getStatusLabel } from '../../types/schema';
import { SchemaViewer } from '../node/SchemaViewer';
import { SchemaErrorBoundary } from '../common/SchemaErrorBoundary';

interface ConnectionValidatorProps {
  validation: ConnectionValidationState;
  sourceName?: string;
  targetName?: string;
  onClose?: () => void;
}

/**
 * Get the icon for a severity level.
 */
function getSeverityIcon(severity: 'error' | 'warning') {
  if (severity === 'error') {
    return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  }
  return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
}

/**
 * Get the status icon component.
 */
function getStatusIcon(status: CompatibilityStatus) {
  switch (status) {
    case 'compatible':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'unknown':
    default:
      return <HelpCircle className="w-5 h-5 text-gray-500" />;
  }
}

/**
 * Get the border color class for a status.
 */
function getStatusBorderClass(status: CompatibilityStatus): string {
  switch (status) {
    case 'compatible':
      return 'border-green-200 bg-green-50';
    case 'warning':
      return 'border-yellow-200 bg-yellow-50';
    case 'error':
      return 'border-red-200 bg-red-50';
    case 'unknown':
    default:
      return 'border-gray-200 bg-gray-50';
  }
}

/**
 * Format an issue type to human-readable text.
 */
function formatIssueType(type: CompatibilityIssue['type']): string {
  switch (type) {
    case 'missing_field':
      return 'Missing Field';
    case 'type_mismatch':
      return 'Type Mismatch';
    case 'format_mismatch':
      return 'Format Mismatch';
    case 'constraint_violation':
      return 'Constraint Violation';
    default:
      return type;
  }
}

/**
 * Render a single issue item.
 */
function IssueItem({ issue }: { issue: CompatibilityIssue }) {
  return (
    <div className="flex items-start gap-2 py-2 px-3 rounded-md bg-white border border-gray-100">
      {getSeverityIcon(issue.severity)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">
            {formatIssueType(issue.type)}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            {issue.path}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-0.5">{issue.message}</p>
        {(issue.sourceValue || issue.targetValue) && (
          <div className="flex items-center gap-3 mt-1 text-xs">
            {issue.sourceValue && (
              <span className="text-gray-500">
                Source: <code className="bg-gray-100 px-1 rounded">{issue.sourceValue}</code>
              </span>
            )}
            {issue.targetValue && (
              <span className="text-gray-500">
                Target: <code className="bg-gray-100 px-1 rounded">{issue.targetValue}</code>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Component that displays schema validation results for a connection.
 * Shows errors and warnings with field-level details.
 */
export function ConnectionValidator({
  validation,
  sourceName,
  targetName,
  onClose,
}: ConnectionValidatorProps) {
  const { status, errorCount, warningCount, summary, details } = validation;
  const issues = details?.issues ?? [];

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  return (
    <div className={`rounded-lg border p-4 ${getStatusBorderClass(status)}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(status)}
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              {getStatusLabel(status)}
            </h3>
            {(sourceName || targetName) && (
              <p className="text-xs text-gray-500">
                {sourceName || 'Source'} → {targetName || 'Target'}
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6"
          >
            <X className="w-4 h-4 text-gray-400" />
          </Button>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-gray-600 mb-3">{summary}</p>
      )}

      {/* Issue counts */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-4 mb-3 text-sm">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-4 h-4" />
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Issues list */}
      {issues.length > 0 && (
        <div className="space-y-2">
          {/* Errors first */}
          {errors.length > 0 && (
            <div className="space-y-2">
              {errors.map((issue, index) => (
                <IssueItem key={`error-${index}`} issue={issue} />
              ))}
            </div>
          )}

          {/* Then warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((issue, index) => (
                <IssueItem key={`warning-${index}`} issue={issue} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No issues message */}
      {status === 'compatible' && issues.length === 0 && (
        <p className="text-sm text-green-700">
          All required fields are present and types are compatible.
        </p>
      )}

      {/* Unknown schema message */}
      {status === 'unknown' && (
        <p className="text-sm text-gray-600">
          Schema validation could not be performed. One or both nodes do not have defined schemas.
        </p>
      )}

      {/* Schema Comparison Section */}
      {details && (details.sourceSchema || details.targetSchema) && (
        <SchemaComparison
          sourceSchema={details.sourceSchema}
          targetSchema={details.targetSchema}
          sourceName={sourceName}
          targetName={targetName}
        />
      )}
    </div>
  );
}

/**
 * Props for schema comparison section.
 */
interface SchemaComparisonProps {
  sourceSchema: JSONSchema | null;
  targetSchema: JSONSchema | null;
  sourceName?: string;
  targetName?: string;
}

/**
 * Displays source and target schemas side-by-side for comparison.
 */
function SchemaComparison({
  sourceSchema,
  targetSchema,
  sourceName,
  targetName,
}: SchemaComparisonProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 h-auto p-0"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        Compare Schemas
      </Button>

      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          {/* Source Schema */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Source: {sourceName || 'Output'}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              {sourceSchema ? (
                <SchemaErrorBoundary fallbackMessage="Failed to display source schema">
                  <SchemaViewer schema={sourceSchema} emptyMessage="No output schema" />
                </SchemaErrorBoundary>
              ) : (
                <p className="text-sm text-gray-400 italic">No schema defined</p>
              )}
            </div>
          </div>

          {/* Target Schema */}
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Target: {targetName || 'Input'}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              {targetSchema ? (
                <SchemaErrorBoundary fallbackMessage="Failed to display target schema">
                  <SchemaViewer schema={targetSchema} emptyMessage="No input schema" />
                </SchemaErrorBoundary>
              ) : (
                <p className="text-sm text-gray-400 italic">No schema defined</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
