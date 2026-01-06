import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import type { NodeType, NodeTypeCategory } from '@chatgpt-app-builder/shared';
import { api, type NodeTypeInfo, type CategoryInfo } from '../../../lib/api';
import { NodeGroup } from './NodeGroup';
import { NodeItem } from './NodeItem';
import { NodeSearch } from './NodeSearch';

interface NodeLibraryProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectNode: (nodeType: NodeType) => void;
  disabledTypes?: NodeType[];
}

type ViewState = 'groups' | 'nodes';

// Category display configuration for consistent styling
const CATEGORY_CONFIG: Record<NodeTypeCategory, {
  displayName: string;
  color: { bg: string; bgHover: string; text: string };
}> = {
  trigger: {
    displayName: 'Triggers',
    color: { bg: 'bg-blue-100', bgHover: 'bg-blue-200', text: 'text-blue-600' },
  },
  interface: {
    displayName: 'UIs',
    color: { bg: 'bg-gray-100', bgHover: 'bg-gray-200', text: 'text-gray-600' },
  },
  action: {
    displayName: 'Actions',
    color: { bg: 'bg-purple-100', bgHover: 'bg-purple-200', text: 'text-purple-600' },
  },
  return: {
    displayName: 'Output',
    color: { bg: 'bg-green-100', bgHover: 'bg-green-200', text: 'text-green-600' },
  },
};

/**
 * Node Library sidedrawer component
 * Displays node groups and allows users to browse and select nodes
 * Fetches node types from the API
 */
export function NodeLibrary({
  isOpen,
  onToggle,
  onClose,
  onSelectNode,
  disabledTypes = [],
}: NodeLibraryProps) {
  const [currentView, setCurrentView] = useState<ViewState>('groups');
  const [selectedCategoryId, setSelectedCategoryId] = useState<NodeTypeCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // API data state
  const [nodeTypes, setNodeTypes] = useState<NodeTypeInfo[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch node types from API
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

  // Sort categories by order
  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  // Get nodes for the selected category
  const selectedCategory = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : null;
  const nodesInCategory = selectedCategoryId
    ? nodeTypes.filter(node => node.category === selectedCategoryId)
    : [];

  // Filter nodes based on search term
  const filteredNodes = searchTerm
    ? nodeTypes.filter((node) =>
        node.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Determine if we're showing search results
  const isSearching = searchTerm.length > 0;

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset view when closing
  useEffect(() => {
    if (!isOpen) {
      setCurrentView('groups');
      setSelectedCategoryId(null);
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleGroupClick = (categoryId: NodeTypeCategory) => {
    setSelectedCategoryId(categoryId);
    setCurrentView('nodes');
  };

  const handleBack = () => {
    setCurrentView('groups');
    setSelectedCategoryId(null);
  };

  const handleNodeSelect = (nodeType: NodeType) => {
    if (!disabledTypes.includes(nodeType)) {
      onSelectNode(nodeType);
    }
  };

  const handleSearchClear = () => {
    setSearchTerm('');
  };

  return (
    <div className="relative flex h-full">
      {/* Sidedrawer */}
      <div
        className={`
          h-full bg-card border-r overflow-hidden
          transition-all duration-300 ease-out
          ${isOpen ? 'w-72' : 'w-0'}
        `}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            {currentView === 'nodes' && selectedCategory ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold">
                  {CATEGORY_CONFIG[selectedCategory.id]?.displayName || selectedCategory.displayName}
                </h2>
              </div>
            ) : (
              <h2 className="text-lg font-semibold">Node Library</h2>
            )}
          </div>

          {/* Search - only show at root level */}
          {currentView === 'groups' && (
            <div className="p-4 border-b">
              <NodeSearch
                value={searchTerm}
                onChange={setSearchTerm}
                onClear={handleSearchClear}
              />
            </div>
          )}

          {/* Content with slide animation */}
          <div className="flex-1 overflow-hidden relative">
            {/* Loading State */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Loading...</span>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Groups View */}
            {!loading && !error && (
              <>
                <div
                  className={`
                    absolute inset-0 overflow-y-auto p-4
                    transition-transform duration-200 ease-out
                    ${currentView === 'groups' && !isSearching ? 'translate-x-0' : '-translate-x-full'}
                  `}
                >
                  <div className="space-y-2">
                    {sortedCategories.map((category) => {
                      const config = CATEGORY_CONFIG[category.id];
                      return (
                        <NodeGroup
                          key={category.id}
                          category={category}
                          displayName={config?.displayName || category.displayName}
                          color={config?.color || { bg: 'bg-gray-100', bgHover: 'bg-gray-200', text: 'text-gray-600' }}
                          onClick={() => handleGroupClick(category.id)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Nodes View (within a category) */}
                <div
                  className={`
                    absolute inset-0 overflow-y-auto p-4
                    transition-transform duration-200 ease-out
                    ${currentView === 'nodes' ? 'translate-x-0' : 'translate-x-full'}
                  `}
                >
                  {nodesInCategory.length > 0 ? (
                    <div className="space-y-2">
                      {nodesInCategory.map((node) => (
                        <NodeItem
                          key={node.name}
                          node={node}
                          onClick={handleNodeSelect}
                          disabled={disabledTypes.includes(node.name as NodeType)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No nodes in this category
                    </div>
                  )}
                </div>

                {/* Search Results View */}
                <div
                  className={`
                    absolute inset-0 overflow-y-auto p-4
                    transition-opacity duration-200 ease-out
                    ${isSearching ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
                  `}
                >
                  {filteredNodes.length > 0 ? (
                    <div className="space-y-2">
                      {filteredNodes.map((node) => (
                        <NodeItem
                          key={node.name}
                          node={node}
                          onClick={handleNodeSelect}
                          disabled={disabledTypes.includes(node.name as NodeType)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No nodes match your search
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`
          absolute top-1/2 -translate-y-1/2 z-10
          w-6 h-12 bg-card border rounded-r-lg
          flex items-center justify-center
          hover:bg-muted transition-colors
          ${isOpen ? 'left-72' : 'left-0'}
          transition-all duration-300 ease-out
        `}
        aria-label={isOpen ? 'Close node library' : 'Open node library'}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
