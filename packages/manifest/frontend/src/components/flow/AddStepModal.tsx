import { useState, useEffect } from 'react';
import { Zap, LayoutTemplate, GitBranch, CornerDownLeft, HelpCircle, Globe, Shuffle } from 'lucide-react';
import type { NodeType, NodeTypeCategory } from '@manifest/shared';
import { api, type NodeTypeInfo, type CategoryInfo } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stepType: NodeType) => void;
}

// Map icon names from API to Lucide React components
const iconMap: Record<string, React.ElementType> = {
  'zap': Zap,
  'layout-template': LayoutTemplate,
  'git-branch': GitBranch,
  'corner-down-left': CornerDownLeft,
  'globe': Globe,
  'shuffle': Shuffle,
};

// Category-based styling
const categoryStyles: Record<NodeTypeCategory, { color: string; bgColor: string; borderColor: string }> = {
  'trigger': { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200 hover:border-blue-400' },
  'ui': { color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200 hover:border-gray-400' },
  'action': { color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200 hover:border-orange-400' },
  'return': { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200 hover:border-green-400' },
  'transform': { color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200 hover:border-teal-400' },
};

/**
 * Modal for selecting a node type to add to the flow
 * Nodes are grouped by category: Triggers, UI Components, Actions, Return Values
 * Fetches available node types from the /api/node-types endpoint.
 */
export function AddStepModal({ isOpen, onClose, onSelect }: AddStepModalProps) {
  const [nodeTypes, setNodeTypes] = useState<NodeTypeInfo[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchNodeTypes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getNodeTypes();
        setNodeTypes(response.nodeTypes);
        setCategories(response.categories);
      } catch (err) {
        setError('Failed to load node types');
        console.error('Error fetching node types:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNodeTypes();
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Sort categories by order
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Node</DialogTitle>
          <DialogDescription>
            Select the type of node to add to your flow
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spinner className="w-6 h-6 text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading node types...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-6">
              {sortedCategories.map((category) => {
                const categoryOptions = nodeTypes.filter(node => node.category === category.id);
                if (categoryOptions.length === 0) return null;

                return (
                  <div key={category.id}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {category.displayName}
                    </h3>
                    <div className="space-y-2">
                      {categoryOptions.map((option) => {
                        const Icon = iconMap[option.icon] || HelpCircle;
                        const styles = categoryStyles[option.category];
                        return (
                          <button
                            key={option.name}
                            onClick={() => onSelect(option.name as NodeType)}
                            className={`w-full flex items-start gap-4 p-3 rounded-lg border-2 ${styles.borderColor} transition-colors transition-shadow hover:shadow-md text-left`}
                          >
                            <div className={`w-10 h-10 rounded-lg ${styles.bgColor} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-5 h-5 ${styles.color}`} />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-sm">{option.displayName}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
