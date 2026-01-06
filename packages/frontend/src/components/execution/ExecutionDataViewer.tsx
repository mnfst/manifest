import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface ExecutionDataViewerProps {
  data: Record<string, unknown>;
  title?: string;
  defaultExpanded?: boolean;
}

export function ExecutionDataViewer({
  data,
  title,
  defaultExpanded = true,
}: ExecutionDataViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);
  const isEmpty = Object.keys(data).length === 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isEmpty) {
    return (
      <div className="text-sm text-gray-400 italic">
        {title ? `${title}: (empty)` : '(empty)'}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {title && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm font-medium text-gray-700">{title}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Copy JSON"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </button>
      )}
      {isExpanded && (
        <pre className="p-3 text-xs font-mono bg-gray-900 text-gray-100 overflow-x-auto">
          {jsonString}
        </pre>
      )}
    </div>
  );
}
