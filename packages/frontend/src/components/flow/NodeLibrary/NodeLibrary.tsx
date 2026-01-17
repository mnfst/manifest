import { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import type {
  NodeType,
  NodeTypeCategory,
  RegistryItem,
  RegistryCategoryInfo,
  RegistryNodeParameters,
} from '@chatgpt-app-builder/shared';
import { api, type NodeTypeInfo, type CategoryInfo } from '../../../lib/api';
import { fetchRegistry, fetchComponentDetail, transformToNodeParameters } from '../../../services/registry';
import { NodeGroup } from './NodeGroup';
import { NodeItem } from './NodeItem';
import { NodeSearch } from './NodeSearch';
import { CategoryList } from './CategoryList';
import { RegistryItemSkeletonList } from './RegistryItemSkeleton';
import { RegistryItemList } from './RegistryItemList';

interface NodeLibraryProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectNode: (nodeType: NodeType) => void;
  onSelectRegistryComponent?: (params: RegistryNodeParameters) => void;
  disabledTypes?: NodeType[];
}

// View states for navigation
type ViewState =
  | 'groups'              // Main category list
  | 'nodes'               // Nodes within a standard category
  | 'registryCategories'  // Registry category list (under "UIs")
  | 'registryItems';      // Registry items within a registry category

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
  transform: {
    displayName: 'Transform',
    color: { bg: 'bg-teal-100', bgHover: 'bg-teal-200', text: 'text-teal-600' },
  },
};

/**
 * Node Library sidedrawer component
 * Displays node groups and allows users to browse and select nodes
 * Fetches node types from the API and registry items for UI components
 */
export function NodeLibrary({
  isOpen,
  onToggle,
  onClose,
  onSelectNode,
  onSelectRegistryComponent,
  disabledTypes = [],
}: NodeLibraryProps) {
  const [currentView, setCurrentView] = useState<ViewState>('groups');
  const [selectedCategoryId, setSelectedCategoryId] = useState<NodeTypeCategory | null>(null);
  const [selectedRegistryCategoryId, setSelectedRegistryCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [folderSearchTerm, setFolderSearchTerm] = useState('');

  // API data state
  const [nodeTypes, setNodeTypes] = useState<NodeTypeInfo[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registry data state
  const [registryItems, setRegistryItems] = useState<RegistryItem[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);

  // Preview hover state
  const [hoveredItem, setHoveredItem] = useState<RegistryItem | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

  // Fetch registry items (used for search and UIs category)
  const fetchRegistryItems = useCallback(async () => {
    try {
      setRegistryLoading(true);
      setRegistryError(null);
      const items = await fetchRegistry();
      setRegistryItems(items);
    } catch (err) {
      setRegistryError(err instanceof Error ? err.message : 'Failed to load registry');
      console.error('Error fetching registry:', err);
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  // Fetch node types from API and registry items when library opens
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
    // Also fetch registry items for search
    fetchRegistryItems();
  }, [isOpen, fetchRegistryItems]);

  // Extract registry categories from items (preserves registry order)
  // Uses first category from each item's categories array
  const registryCategories = useMemo((): RegistryCategoryInfo[] => {
    const categoryMap = new Map<string, { count: number; order: number }>();

    registryItems.forEach((item, index) => {
      const category = item.categories[0];
      if (!category) return;
      const existing = categoryMap.get(category);
      if (existing) {
        existing.count++;
      } else {
        // First occurrence determines order
        categoryMap.set(category, { count: 1, order: index });
      }
    });

    return Array.from(categoryMap.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id, { count, order }]) => ({
        id,
        displayName: id.charAt(0).toUpperCase() + id.slice(1),
        itemCount: count,
        order,
      }));
  }, [registryItems]);

  // Get registry items for selected category
  const registryItemsInCategory = useMemo(() => {
    if (!selectedRegistryCategoryId) return [];
    return registryItems.filter(item => item.categories[0] === selectedRegistryCategoryId);
  }, [registryItems, selectedRegistryCategoryId]);

  // Sort categories by order
  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  // Get nodes for the selected category
  const selectedCategory = selectedCategoryId
    ? categories.find(c => c.id === selectedCategoryId)
    : null;
  const nodesInCategory = useMemo(() => {
    return selectedCategoryId
      ? nodeTypes.filter(node => node.category === selectedCategoryId)
      : [];
  }, [selectedCategoryId, nodeTypes]);

  // Get built-in interface nodes (e.g., BlankComponent) to show in UIs section
  const builtInInterfaceNodes = useMemo(() =>
    nodeTypes.filter(node => node.category === 'interface'),
    [nodeTypes]
  );

  // Filter nodes based on search term
  const filteredNodes = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return nodeTypes.filter((node) =>
      node.displayName.toLowerCase().includes(term) ||
      node.description.toLowerCase().includes(term)
    );
  }, [searchTerm, nodeTypes]);

  // Filter registry items based on search term
  const filteredRegistryItems = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return registryItems.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      (item.categories[0]?.toLowerCase().includes(term) ?? false)
    );
  }, [searchTerm, registryItems]);

  // Determine if we're showing search results
  const isSearching = searchTerm.length > 0;
  const hasSearchResults = filteredNodes.length > 0 || filteredRegistryItems.length > 0;

  // Group search results by category for display
  const groupedSearchResults = useMemo(() => {
    if (!isSearching) return [];

    // Group nodes by their category
    const nodesByCategory = new Map<NodeTypeCategory, NodeTypeInfo[]>();
    filteredNodes.forEach((node) => {
      const existing = nodesByCategory.get(node.category) || [];
      existing.push(node);
      nodesByCategory.set(node.category, existing);
    });

    // Build results in category order: trigger, interface (with registry items), action, return, transform
    const categoryOrder: NodeTypeCategory[] = ['trigger', 'interface', 'action', 'return', 'transform'];
    const results: Array<{
      categoryId: NodeTypeCategory;
      displayName: string;
      nodes: NodeTypeInfo[];
      registryItems: RegistryItem[];
    }> = [];

    categoryOrder.forEach((categoryId) => {
      const nodes = nodesByCategory.get(categoryId) || [];
      const registryItems = categoryId === 'interface' ? filteredRegistryItems : [];

      if (nodes.length > 0 || registryItems.length > 0) {
        results.push({
          categoryId,
          displayName: CATEGORY_CONFIG[categoryId]?.displayName || categoryId,
          nodes,
          registryItems,
        });
      }
    });

    return results;
  }, [isSearching, filteredNodes, filteredRegistryItems]);

  // Folder-level filtering (for nested views)
  const isFolderSearching = folderSearchTerm.length > 0;

  // Filter nodes in category by folder search term
  const filteredNodesInCategory = useMemo(() => {
    if (!folderSearchTerm) return nodesInCategory;
    const term = folderSearchTerm.toLowerCase();
    return nodesInCategory.filter((node) =>
      node.displayName.toLowerCase().includes(term) ||
      node.description.toLowerCase().includes(term)
    );
  }, [nodesInCategory, folderSearchTerm]);

  // Filter ALL registry items by folder search term (for UIs folder search)
  const filteredAllRegistryItems = useMemo(() => {
    if (!folderSearchTerm) return [];
    const term = folderSearchTerm.toLowerCase();
    return registryItems.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term)
    );
  }, [registryItems, folderSearchTerm]);

  // Filter registry items in category by folder search term
  const filteredRegistryItemsInCategory = useMemo(() => {
    if (!folderSearchTerm) return registryItemsInCategory;
    const term = folderSearchTerm.toLowerCase();
    return registryItemsInCategory.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term)
    );
  }, [registryItemsInCategory, folderSearchTerm]);

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
      setSelectedRegistryCategoryId(null);
      setSearchTerm('');
      setFolderSearchTerm('');
    }
  }, [isOpen]);

  const handleGroupClick = (categoryId: NodeTypeCategory) => {
    setFolderSearchTerm(''); // Clear folder search when navigating
    if (categoryId === 'interface') {
      // Navigate to registry categories for UIs
      setSelectedCategoryId(categoryId);
      setCurrentView('registryCategories');
      // Fetch registry items fresh (no caching per requirements)
      fetchRegistryItems();
    } else {
      setSelectedCategoryId(categoryId);
      setCurrentView('nodes');
    }
  };

  const handleRegistryCategoryClick = (registryCategoryId: string) => {
    setFolderSearchTerm(''); // Clear folder search when navigating
    setSelectedRegistryCategoryId(registryCategoryId);
    setCurrentView('registryItems');
  };

  const handleBack = () => {
    setFolderSearchTerm(''); // Clear folder search when navigating back
    if (currentView === 'registryItems') {
      // Go back to registry categories
      setSelectedRegistryCategoryId(null);
      setCurrentView('registryCategories');
    } else if (currentView === 'registryCategories') {
      // Go back to main groups
      setSelectedCategoryId(null);
      setCurrentView('groups');
    } else {
      // Standard back from nodes view
      setCurrentView('groups');
      setSelectedCategoryId(null);
    }
  };

  const handleNodeSelect = (nodeType: NodeType) => {
    if (!disabledTypes.includes(nodeType)) {
      onSelectNode(nodeType);
    }
  };

  const handleRegistryItemSelect = async (item: RegistryItem) => {
    if (!onSelectRegistryComponent) return;

    // Fetch component detail and transform to node parameters
    // Error handling is done in RegistryItem component
    const detail = await fetchComponentDetail(item.name);
    const params = transformToNodeParameters(detail);
    onSelectRegistryComponent(params);
  };

  const handleSearchClear = () => {
    setSearchTerm('');
  };

  const handleFolderSearchClear = () => {
    setFolderSearchTerm('');
  };

  // Get search placeholder based on current view
  const getSearchPlaceholder = () => {
    if (currentView === 'groups') {
      return 'Search all nodes...';
    }
    if (currentView === 'nodes' && selectedCategory) {
      const displayName = CATEGORY_CONFIG[selectedCategory.id]?.displayName || selectedCategory.displayName;
      return `Search in ${displayName}...`;
    }
    if (currentView === 'registryCategories') {
      return 'Search in UIs...';
    }
    if (currentView === 'registryItems' && selectedRegistryCategoryId) {
      const displayName = selectedRegistryCategoryId.charAt(0).toUpperCase() + selectedRegistryCategoryId.slice(1);
      return `Search in ${displayName}...`;
    }
    return 'Search...';
  };

  // Handle registry item hover for preview
  const handleRegistryItemHover = useCallback((item: RegistryItem | null, rect: DOMRect | null) => {
    setHoveredItem(item);
    setHoverRect(rect);
  }, []);

  // Get header title based on current view
  const getHeaderTitle = () => {
    if (currentView === 'registryItems' && selectedRegistryCategoryId) {
      return selectedRegistryCategoryId.charAt(0).toUpperCase() + selectedRegistryCategoryId.slice(1);
    }
    if (currentView === 'registryCategories') {
      return 'UIs';
    }
    if (currentView === 'nodes' && selectedCategory) {
      return CATEGORY_CONFIG[selectedCategory.id]?.displayName || selectedCategory.displayName;
    }
    return 'Node Library';
  };

  // Show back button in these views
  const showBackButton = currentView !== 'groups';

  return (
    <div className="relative flex h-full">
      {/* Sidedrawer - uses Tailwind transition classes for reliable animation */}
      <div
        className={`
          h-full border-r flex-shrink-0 overflow-hidden bg-card
          transition-all duration-300 ease-in-out motion-safe-override
          ${isOpen ? 'w-72' : 'w-0'}
        `}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            {showBackButton ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold">{getHeaderTitle()}</h2>
              </div>
            ) : (
              <h2 className="text-lg font-semibold">Node Library</h2>
            )}
          </div>

          {/* Search - shows in all views with context-aware placeholder */}
          <div className="p-4 border-b">
            <NodeSearch
              value={currentView === 'groups' ? searchTerm : folderSearchTerm}
              onChange={currentView === 'groups' ? setSearchTerm : setFolderSearchTerm}
              onClear={currentView === 'groups' ? handleSearchClear : handleFolderSearchClear}
              placeholder={getSearchPlaceholder()}
            />
          </div>

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

                {/* Standard Nodes View (within a category) */}
                <div
                  className={`
                    absolute inset-0 overflow-y-auto p-4
                    transition-transform duration-200 ease-out
                    ${currentView === 'nodes' ? 'translate-x-0' : 'translate-x-full'}
                  `}
                >
                  {filteredNodesInCategory.length > 0 ? (
                    <div className="space-y-2">
                      {filteredNodesInCategory.map((node) => (
                        <NodeItem
                          key={node.name}
                          node={node}
                          onClick={handleNodeSelect}
                          disabled={disabledTypes.includes(node.name as NodeType)}
                        />
                      ))}
                    </div>
                  ) : isFolderSearching ? (
                    <div className="text-center text-muted-foreground py-8">
                      No results in this folder
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No nodes in this category
                    </div>
                  )}
                </div>

                {/* Registry Categories View (UIs section) */}
                <div
                  className={`
                    absolute inset-0 overflow-y-auto p-4
                    transition-transform duration-200 ease-out
                    ${currentView === 'registryCategories' ? 'translate-x-0' : 'translate-x-full'}
                  `}
                >
                  {registryLoading ? (
                    <RegistryItemSkeletonList count={6} />
                  ) : registryError ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-red-600 mb-2">{registryError}</p>
                      <button
                        onClick={fetchRegistryItems}
                        className="text-sm text-primary hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  ) : isFolderSearching ? (
                    // When searching in UIs folder, show matching components (not categories)
                    filteredAllRegistryItems.length > 0 ? (
                      <RegistryItemList
                        items={filteredAllRegistryItems}
                        onSelectItem={handleRegistryItemSelect}
                        onHoverItem={handleRegistryItemHover}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No results in this folder
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {/* Built-in UI nodes (e.g., Blank Component) */}
                      {builtInInterfaceNodes.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Build Your Own
                          </h3>
                          {builtInInterfaceNodes.map((node) => (
                            <NodeItem
                              key={node.name}
                              node={node}
                              onClick={handleNodeSelect}
                              disabled={disabledTypes.includes(node.name as NodeType)}
                            />
                          ))}
                        </div>
                      )}
                      {/* Registry categories */}
                      {registryCategories.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Pre-built Components
                          </h3>
                          <CategoryList
                            categories={registryCategories}
                            onSelectCategory={handleRegistryCategoryClick}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Registry Items View (items within a registry category) */}
                <div
                  className={`
                    absolute inset-0 overflow-y-auto p-4
                    transition-transform duration-200 ease-out
                    ${currentView === 'registryItems' ? 'translate-x-0' : 'translate-x-full'}
                  `}
                >
                  {filteredRegistryItemsInCategory.length > 0 ? (
                    <RegistryItemList
                      items={filteredRegistryItemsInCategory}
                      onSelectItem={handleRegistryItemSelect}
                      onHoverItem={handleRegistryItemHover}
                    />
                  ) : isFolderSearching ? (
                    <div className="text-center text-muted-foreground py-8">
                      No results in this folder
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No items in this category
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
                  {hasSearchResults ? (
                    <div className="space-y-4">
                      {groupedSearchResults.map((group) => (
                        <div key={group.categoryId} className="space-y-2">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {group.displayName} ({group.nodes.length + group.registryItems.length})
                          </h3>
                          {/* Render nodes in this category */}
                          {group.nodes.map((node) => (
                            <NodeItem
                              key={node.name}
                              node={node}
                              onClick={handleNodeSelect}
                              disabled={disabledTypes.includes(node.name as NodeType)}
                            />
                          ))}
                          {/* Render registry items (only for interface category) */}
                          {group.registryItems.length > 0 && (
                            <RegistryItemList
                              items={group.registryItems}
                              onSelectItem={handleRegistryItemSelect}
                              onHoverItem={handleRegistryItemHover}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No results match your search
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Button - positioned at drawer edge */}
      <button
        onClick={onToggle}
        className={`
          absolute top-1/2 -translate-y-1/2 z-10 w-6 h-12 bg-card border rounded-r-lg
          flex items-center justify-center hover:bg-muted
          transition-all duration-300 ease-in-out motion-safe-override
          ${isOpen ? 'left-72' : 'left-0'}
        `}
        aria-label={isOpen ? 'Close node library' : 'Open node library'}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Preview Panel - shows when hovering registry items with preview images */}
      {isOpen && hoveredItem?.meta?.preview && hoverRect && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden pointer-events-none"
          style={{
            left: 288 + 16, // 72 * 4 (sidebar width) + 16px gap
            top: Math.max(16, Math.min(hoverRect.top - 50, window.innerHeight - 320)),
            width: 280,
            maxHeight: 300,
          }}
        >
          <img
            src={hoveredItem.meta.preview}
            alt={hoveredItem.title}
            className="w-full h-auto"
          />
          <div className="p-3 border-t bg-gray-50">
            <h4 className="font-medium text-sm text-gray-900">{hoveredItem.title}</h4>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{hoveredItem.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
