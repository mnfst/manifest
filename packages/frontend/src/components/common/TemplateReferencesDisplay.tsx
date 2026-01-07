import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Link2 } from 'lucide-react';
import { parseTemplateReferences, groupReferencesByNode, type TemplateReference } from '@chatgpt-app-builder/shared';
import type { UpstreamNodeInfo } from '../../types/schema';

interface TemplateReferencesDisplayProps {
  /** String values to parse for template references */
  values: string[];
  /** Available upstream nodes for validation */
  upstreamNodes?: UpstreamNodeInfo[];
  /** Whether the node is connected (has upstream nodes) */
  isConnected?: boolean;
}

/**
 * Displays the template variable references found in configuration values.
 * Shows which upstream node fields are required based on {{ nodeSlug.field }} usage.
 * Validates that referenced nodes and fields exist.
 */
export function TemplateReferencesDisplay({
  values,
  upstreamNodes = [],
  isConnected = false,
}: TemplateReferencesDisplayProps) {
  // Parse all template references from the values
  const { references, groupedByNode, issues } = useMemo(() => {
    const allRefs: TemplateReference[] = [];
    const seenPaths = new Set<string>();

    for (const value of values) {
      const refs = parseTemplateReferences(value);
      for (const ref of refs) {
        if (!seenPaths.has(ref.fullPath)) {
          seenPaths.add(ref.fullPath);
          allRefs.push(ref);
        }
      }
    }

    const grouped = groupReferencesByNode(allRefs);

    // Validate references against available upstream nodes
    const validationIssues: Array<{ type: 'missing_node' | 'missing_field'; ref: TemplateReference }> = [];
    const upstreamSlugMap = new Map(upstreamNodes.map(n => [n.slug, n]));

    for (const ref of allRefs) {
      const upstreamNode = upstreamSlugMap.get(ref.nodeSlug);
      if (!upstreamNode) {
        validationIssues.push({ type: 'missing_node', ref });
      } else {
        // Check if the field exists in the node's output
        const fieldExists = upstreamNode.fields.some(f =>
          f.path === ref.fieldPath || f.path.startsWith(ref.fieldPath + '.')
        );
        if (!fieldExists && upstreamNode.fields.length > 0) {
          validationIssues.push({ type: 'missing_field', ref });
        }
      }
    }

    return { references: allRefs, groupedByNode: grouped, issues: validationIssues };
  }, [values, upstreamNodes]);

  // Don't show anything if there are no references
  if (references.length === 0) {
    return null;
  }

  const hasIssues = issues.length > 0;

  return (
    <div className={`rounded-lg border p-3 ${hasIssues ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        {hasIssues ? (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        ) : (
          <CheckCircle className="w-4 h-4 text-green-600" />
        )}
        <span className={`text-sm font-medium ${hasIssues ? 'text-amber-800' : 'text-green-800'}`}>
          Input Requirements
        </span>
        <span className="text-xs text-gray-500">
          ({references.length} field{references.length !== 1 ? 's' : ''} referenced)
        </span>
      </div>

      <div className="space-y-2">
        {Array.from(groupedByNode.entries()).map(([nodeSlug, fields]) => {
          const nodeIssues = issues.filter(i => i.ref.nodeSlug === nodeSlug);
          const hasMissingNode = nodeIssues.some(i => i.type === 'missing_node');

          return (
            <div key={nodeSlug} className="flex flex-wrap items-center gap-1.5">
              <Link2 className="w-3 h-3 text-gray-400" />
              <code className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                hasMissingNode ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {nodeSlug}
              </code>
              <span className="text-xs text-gray-500">→</span>
              {fields.map((field, idx) => {
                const fieldIssue = nodeIssues.find(i => i.ref.fieldPath === field);
                return (
                  <code
                    key={field}
                    className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      fieldIssue ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}
                    title={fieldIssue ? `${fieldIssue.type === 'missing_node' ? 'Node not found' : 'Field not found'} - this may cause errors at runtime` : `Required from ${nodeSlug}`}
                  >
                    {field}
                    {idx < fields.length - 1 ? '' : ''}
                  </code>
                );
              })}
            </div>
          );
        })}
      </div>

      {hasIssues && (
        <p className="text-xs text-amber-600 mt-2">
          {!isConnected
            ? 'Connect this node to make upstream outputs available.'
            : 'Some referenced nodes or fields may not be available. Check the "Use Previous Outputs" section above.'}
        </p>
      )}

      {!hasIssues && (
        <p className="text-xs text-green-600 mt-2">
          All referenced fields are available from upstream nodes.
        </p>
      )}
    </div>
  );
}
