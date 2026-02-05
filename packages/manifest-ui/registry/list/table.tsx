'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { demoTableColumns, demoTableRows } from './demo/list'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Maximize2,
  Minus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Type
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

// Filter types
interface FilterCondition {
  id: string
  field: string
  operator:
    | 'contains'
    | 'equals'
    | 'startsWith'
    | 'endsWith'
    | 'isEmpty'
    | 'isNotEmpty'
  value: string
}

/**
 * Configuration for a table column.
 * @interface TableColumn
 * @template T - The row data type
 * @property {string} header - Column header text
 * @property {keyof T | string} accessor - Key to access row data or dot-notation path
 * @property {boolean} [sortable] - Whether the column is sortable
 * @property {string} [width] - CSS width value for the column
 * @property {"left" | "center" | "right"} [align] - Text alignment
 * @property {function} [render] - Custom render function for cell content
 */
export interface TableColumn<T = Record<string, unknown>> {
  header?: string
  accessor?: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TableProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for configuring a data table component with sorting, selection,
 * pagination, and filtering capabilities.
 *
 * @template T - The row data type
 */
export interface TableProps<T = Record<string, unknown>> {
  data?: {
    /** Column definitions specifying headers, accessors, and rendering. */
    columns?: TableColumn<T>[]
    /** Array of row data objects to display. */
    rows?: T[]
    /** Table title displayed in the header. */
    title?: string
    /** Icon or image URL displayed next to the title. */
    titleImage?: string
    /** Timestamp showing when the data was last updated. */
    lastUpdated?: Date | string
    /** Total row count for displaying "+N more" indicator. */
    totalRows?: number
  }
  actions?: {
    /** Called when the copy action is triggered with selected rows. */
    onCopy?: (selectedRows: T[]) => void
    /** Called when the download action is triggered with selected rows. */
    onDownload?: (selectedRows: T[]) => void
    /** Called when the share action is triggered with selected rows. */
    onShare?: (selectedRows: T[]) => void
    /** Called when the refresh button is clicked. */
    onRefresh?: () => void
  }
  appearance?: {
    /**
     * Row selection mode.
     * @default "none"
     */
    selectable?: 'none' | 'single' | 'multi'
    /**
     * Message displayed when the table has no data.
     * @default "No data available"
     */
    emptyMessage?: string
    /**
     * Whether to keep the header fixed when scrolling.
     * @default false
     */
    stickyHeader?: boolean
    /**
     * Whether to use compact row height.
     * @default false
     */
    compact?: boolean
    /** Whether to show action buttons in the header. */
    showActions?: boolean
    /**
     * Whether to show the table header.
     * @default true
     */
    showHeader?: boolean
    /**
     * Whether to show the table footer.
     * @default true
     */
    showFooter?: boolean
    /**
     * Maximum number of rows to display in inline mode.
     * @default 5
     */
    maxRows?: number
    /**
     * Display mode: 'inline' (compact card) or 'fullscreen' (paginated with filters).
     * @default "inline"
     */
    displayMode?: 'inline' | 'pip' | 'fullscreen'
  }
  control?: {
    /** Whether to show loading skeleton state. */
    loading?: boolean
    /** Controlled array of selected rows. */
    selectedRows?: T[]
  }
}


function SkeletonRow({
  columns,
  compact
}: {
  columns: number
  compact?: boolean
}) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className={cn('px-3', compact ? 'py-2' : 'py-3')}>
          <div className="h-4 bg-muted animate-pulse rounded" />
        </td>
      ))}
    </tr>
  )
}

// TableHeader component (inline mode)
function TableHeader({
  title,
  titleImage,
  onExpand,
  selectable,
  hasSelection,
  onCopy,
  onDownload,
  onShare
}: {
  title?: string
  titleImage?: string
  onExpand?: () => void
  selectable?: 'none' | 'single' | 'multi'
  hasSelection?: boolean
  onCopy?: () => void
  onDownload?: () => void
  onShare?: () => void
}) {
  if (!title && !onExpand) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-card rounded-t-lg h-14">
      <div className="flex items-center gap-2">
        {titleImage && (
          <img
            src={titleImage}
            alt={title ? `${title} icon` : "Table icon"}
            className="h-5 w-5 rounded object-cover"
          />
        )}
        {title && <span className="font-medium">{title}</span>}
      </div>
      <div className="flex items-center gap-2">
        {/* Action buttons - icons only, disabled when no selection */}
        {selectable === 'single' && onCopy && (
          <button
            onClick={hasSelection ? onCopy : undefined}
            disabled={!hasSelection}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              hasSelection
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
                : 'text-muted-foreground/40 cursor-not-allowed'
            )}
            aria-label="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
        {selectable === 'multi' && (
          <>
            {onDownload && (
              <button
                onClick={hasSelection ? onDownload : undefined}
                disabled={!hasSelection}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  hasSelection
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
                    : 'text-muted-foreground/40 cursor-not-allowed'
                )}
                aria-label="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            {onShare && (
              <button
                onClick={hasSelection ? onShare : undefined}
                disabled={!hasSelection}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  hasSelection
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
                    : 'text-muted-foreground/40 cursor-not-allowed'
                )}
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        {onExpand && (
          <button
            onClick={onExpand}
            className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label="Expand table"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// TableFooter component
function TableFooter({
  moreCount,
  lastUpdated,
  onRefresh
}: {
  moreCount?: number
  lastUpdated?: Date | string
  onRefresh?: () => void
}) {
  const formatTimestamp = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const hasLeftContent = (moreCount && moreCount > 0) || lastUpdated

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50 rounded-b-lg">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {moreCount && moreCount > 0 && <span>+{moreCount} more</span>}
        {moreCount && moreCount > 0 && lastUpdated && (
          <span className="text-muted-foreground/50">·</span>
        )}
        {lastUpdated && <span>Data as of {formatTimestamp(lastUpdated)}</span>}
        {!hasLeftContent && <span>&nbsp;</span>}
      </div>
      <button
        onClick={onRefresh}
        className={cn(
          'transition-colors',
          onRefresh
            ? 'text-muted-foreground hover:text-foreground cursor-pointer'
            : 'text-muted-foreground/40 cursor-not-allowed'
        )}
        disabled={!onRefresh}
        aria-label="Refresh"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * A data table component with optional single or multi-select modes for chat interfaces.
 * Supports both inline (compact) and fullscreen (paginated) display modes.
 *
 * Features:
 * - Column sorting (ascending/descending)
 * - Row selection (none, single, multi)
 * - Inline and fullscreen display modes
 * - Pagination in fullscreen mode
 * - Column filtering in fullscreen mode
 * - Custom cell rendering
 * - Loading skeleton state
 * - Copy, download, share actions
 * - Sticky header option
 * - Mobile card layout
 * - MCP Apps display mode support
 *
 * @component
 * @template T - The row data type
 * @example
 * ```tsx
 * <Table
 *   data={{
 *     columns: [
 *       { header: "Name", accessor: "name", sortable: true },
 *       { header: "Price", accessor: "price", align: "right" }
 *     ],
 *     rows: [
 *       { name: "Product A", price: 99 },
 *       { name: "Product B", price: 149 }
 *     ],
 *     title: "Products",
 *     lastUpdated: new Date()
 *   }}
 *   actions={{
 *     onSelectionChange: (rows) => console.log("Selected:", rows),
 *     onRefresh: () => console.log("Refresh")
 *   }}
 *   appearance={{
 *     selectable: "multi",
 *     maxRows: 10,
 *     showHeader: true,
 *     showFooter: true
 *   }}
 * />
 * ```
 */
export function Table<T extends Record<string, unknown>>({
  data: dataProps,
  actions,
  appearance,
  control
}: TableProps<T>) {
  const resolvedData: NonNullable<TableProps<T>['data']> = dataProps ?? { columns: demoTableColumns as unknown as TableColumn<T>[], rows: demoTableRows as unknown as T[] }
  const {
    columns = [] as unknown as TableColumn<T>[],
    rows: tableData = [] as unknown as T[],
    title,
    titleImage,
    lastUpdated,
    totalRows
  } = resolvedData
  const {
    onCopy,
    onDownload,
    onShare,
    onRefresh
  } = actions ?? {}
  const {
    selectable = 'none',
    emptyMessage = 'No data available',
    stickyHeader = false,
    compact = false,
    showHeader = true,
    showFooter = true,
    maxRows = 5,
    displayMode: propDisplayMode
  } = appearance ?? {}
  const { loading = false, selectedRows: controlledSelectedRows } =
    control ?? {}

  const displayMode = propDisplayMode ?? 'inline'

  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<number>>(
    new Set()
  )

  // Filter state (fullscreen only)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sortSearch, setSortSearch] = useState('')

  const rowsPerPage = 15
  const isFullscreen = displayMode === 'fullscreen'

  // Memoize controlled selection to avoid recreating Set on every render
  const controlledSelectedSet = useMemo(() => {
    if (!controlledSelectedRows) return null
    return new Set(controlledSelectedRows.map((row) => tableData.indexOf(row)))
  }, [controlledSelectedRows, tableData])

  const selectedRowsSet = controlledSelectedSet ?? internalSelectedRows

  // Apply filters to data (fullscreen only)
  const filteredData = useMemo(() => {
    if (!isFullscreen || filters.length === 0) return tableData

    return tableData.filter((row) => {
      return filters.every((filter) => {
        const value = String(row[filter.field as keyof T] ?? '').toLowerCase()
        const filterValue = filter.value.toLowerCase()

        switch (filter.operator) {
          case 'contains':
            return value.includes(filterValue)
          case 'equals':
            return value === filterValue
          case 'startsWith':
            return value.startsWith(filterValue)
          case 'endsWith':
            return value.endsWith(filterValue)
          case 'isEmpty':
            return value === ''
          case 'isNotEmpty':
            return value !== ''
          default:
            return true
        }
      })
    })
  }, [tableData, filters, isFullscreen])

  const handleSort = useCallback((accessor: string) => {
    setSortConfig((current) => {
      if (current?.key === accessor) {
        if (current.direction === 'asc') {
          return { key: accessor, direction: 'desc' }
        }
        return null
      }
      return { key: accessor, direction: 'asc' }
    })
    setSortOpen(false)
  }, [])

  const sortedData = useMemo(() => {
    const dataToSort = isFullscreen ? filteredData : tableData
    if (!sortConfig) return dataToSort

    return [...dataToSort].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof T]
      const bValue = b[sortConfig.key as keyof T]

      if (aValue === bValue) return 0

      let comparison = 0
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else {
        comparison = String(aValue).localeCompare(String(bValue))
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [tableData, filteredData, sortConfig, isFullscreen])

  // Pagination (fullscreen) or limit rows (inline)
  const visibleData = isFullscreen
    ? sortedData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
      )
    : sortedData.slice(0, maxRows)

  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const moreCount = totalRows
    ? totalRows - maxRows
    : sortedData.length > maxRows
    ? sortedData.length - maxRows
    : 0

  // Filter helpers
  const addFilter = () => {
    const firstColumn = columns[0]?.accessor as string
    setFilters([
      ...filters,
      {
        id: crypto.randomUUID(),
        field: firstColumn || '',
        operator: 'contains',
        value: ''
      }
    ])
  }

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(filters.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id))
  }

  const filteredColumns = columns.filter((col) =>
    (col.header ?? '').toLowerCase().includes(sortSearch.toLowerCase())
  )

  const handleRowSelect = useCallback(
    (index: number) => {
      if (selectable === 'none') return

      // In fullscreen mode, calculate global index
      const globalIndex = isFullscreen
        ? (currentPage - 1) * rowsPerPage + index
        : index

      const newSelected = new Set(selectedRowsSet)

      if (selectable === 'single') {
        if (newSelected.has(globalIndex)) {
          newSelected.clear()
        } else {
          newSelected.clear()
          newSelected.add(globalIndex)
        }
      } else {
        if (newSelected.has(globalIndex)) {
          newSelected.delete(globalIndex)
        } else {
          newSelected.add(globalIndex)
        }
      }

      setInternalSelectedRows(newSelected)
    },
    [
      selectable,
      selectedRowsSet,
      isFullscreen,
      currentPage,
      rowsPerPage
    ]
  )

  const handleSelectAll = useCallback(() => {
    if (selectable !== 'multi') return

    const allSelected = selectedRowsSet.size === visibleData.length
    const newSelected = allSelected
      ? new Set<number>()
      : new Set(visibleData.map((_, i) => i))

    setInternalSelectedRows(newSelected)
  }, [selectable, selectedRowsSet.size, visibleData])

  const getValue = (row: T, accessor: string): unknown => {
    const keys = accessor.split('.')
    let value: unknown = row
    for (const key of keys) {
      value = (value as Record<string, unknown>)?.[key]
    }
    return value
  }

  const formatNumber = (value: unknown): string => {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-US').format(value)
    }
    return String(value ?? '')
  }

  const getSortIcon = (accessor: string) => {
    if (sortConfig?.key !== accessor) {
      return <Minus className="h-3 w-3 opacity-0 group-hover:opacity-30" />
    }
    return sortConfig?.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  const handleExpand = () => {
    // Display mode changes are handled by the host wrapper (HostAPIProvider)
  }

  const hasSelection = selectedRowsSet.size > 0
  const getSelectedRows = () =>
    sortedData.filter((_, i) => selectedRowsSet.has(i))

  // FULLSCREEN MODE - fills 100% of available space (host controls the container)
  if (isFullscreen) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between px-4 py-3 h-14">
          <div className="flex items-center gap-2">
            {titleImage && (
              <img
                src={titleImage}
                alt={title ? `${title} icon` : "Table icon"}
                className="h-5 w-5 rounded object-cover"
              />
            )}
            {title && <span className="font-medium">{title}</span>}
          </div>

          {/* Action buttons and Filter/Sort */}
          <div className="flex items-center gap-2">
            {selectable === 'single' && onCopy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCopy(getSelectedRows())}
                disabled={!hasSelection}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
            )}
            {selectable === 'multi' && (
              <>
                {onDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(getSelectedRows())}
                    disabled={!hasSelection}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download
                  </Button>
                )}
                {onShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShare(getSelectedRows())}
                    disabled={!hasSelection}
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share
                  </Button>
                )}
              </>
            )}

            {/* Filter Button */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'text-sm transition-colors cursor-pointer px-2 py-1 rounded hover:bg-muted',
                    filters.length > 0
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  Filter
                  {filters.length > 0 && (
                    <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                      {filters.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto min-w-[400px] p-0">
                <div className="p-3 space-y-3">
                  {filters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No filter conditions are applied
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filters.map((filter, index) => (
                        <div
                          key={filter.id}
                          className="flex items-center gap-2"
                        >
                          <span className="text-sm text-muted-foreground w-12">
                            {index === 0 ? 'Where' : 'And'}
                          </span>
                          <Select
                            value={filter.field}
                            onValueChange={(value) =>
                              updateFilter(filter.id, { field: value })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {columns.map((col) => (
                                <SelectItem
                                  key={col.accessor as string}
                                  value={col.accessor as string}
                                >
                                  {col.header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) =>
                              updateFilter(filter.id, {
                                operator: value as FilterCondition['operator']
                              })
                            }
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">contains</SelectItem>
                              <SelectItem value="equals">equals</SelectItem>
                              <SelectItem value="startsWith">
                                starts with
                              </SelectItem>
                              <SelectItem value="endsWith">
                                ends with
                              </SelectItem>
                              <SelectItem value="isEmpty">is empty</SelectItem>
                              <SelectItem value="isNotEmpty">
                                is not empty
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {filter.operator !== 'isEmpty' &&
                            filter.operator !== 'isNotEmpty' && (
                              <Input
                                placeholder="Enter a value"
                                value={filter.value}
                                onChange={(e) =>
                                  updateFilter(filter.id, {
                                    value: e.target.value
                                  })
                                }
                                className="w-32"
                              />
                            )}
                          <button
                            onClick={() => removeFilter(filter.id)}
                            aria-label="Remove filter"
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addFilter}
                      className="text-primary border-primary hover:bg-primary/10"
                    >
                      + Add condition
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Sort Button */}
            <Popover open={sortOpen} onOpenChange={setSortOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'text-sm transition-colors cursor-pointer px-2 py-1 rounded hover:bg-muted',
                    sortConfig ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Sort
                  {sortConfig && (
                    <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                      1
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-0">
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium">Sort by</p>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Find a field"
                      value={sortSearch}
                      onChange={(e) => setSortSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredColumns.map((col) => (
                      <button
                        key={col.accessor as string}
                        onClick={() => handleSort(col.accessor as string)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors cursor-pointer text-left',
                          sortConfig?.key === col.accessor && 'bg-muted'
                        )}
                      >
                        <Type className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">{col.header}</span>
                        {sortConfig?.key === col.accessor &&
                          (sortConfig?.direction === 'asc' ? (
                            <ArrowUpAZ className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ArrowDownAZ className="h-4 w-4 text-muted-foreground" />
                          ))}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto px-4">
          <div className="w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    {selectable !== 'none' && (
                      <th
                        className={cn('w-10 px-3', compact ? 'py-2' : 'py-3')}
                      />
                    )}
                    {columns.map((column, index) => (
                      <th
                        key={index}
                        className={cn(
                          'px-3 font-medium text-muted-foreground group text-left',
                          compact ? 'py-2' : 'py-3',
                          column.align === 'right' && 'text-right',
                          column.sortable &&
                            'cursor-pointer select-none hover:text-foreground'
                        )}
                        style={{ width: column.width }}
                        onClick={() =>
                          column.sortable &&
                          handleSort((column.accessor ?? '') as string)
                        }
                      >
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            column.align === 'right' && 'justify-end'
                          )}
                        >
                          {column.header ?? ''}
                          {column.sortable &&
                            getSortIcon((column.accessor ?? '') as string)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleData.map((row, rowIndex) => {
                    const globalIndex =
                      (currentPage - 1) * rowsPerPage + rowIndex
                    return (
                      <tr
                        key={rowIndex}
                        onClick={() => handleRowSelect(rowIndex)}
                        className={cn(
                          'border-b border-border last:border-0 transition-colors',
                          selectable !== 'none' &&
                            'cursor-pointer hover:bg-muted/30'
                        )}
                      >
                        {selectable !== 'none' && (
                          <td className={cn('px-3', compact ? 'py-2' : 'py-3')}>
                            <div
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                                selectedRowsSet.has(globalIndex)
                                  ? 'bg-foreground border-foreground text-background'
                                  : 'border-border'
                              )}
                            >
                              {selectedRowsSet.has(globalIndex) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                          </td>
                        )}
                        {columns.map((column, colIndex) => {
                          const value = getValue(row, (column.accessor ?? '') as string)
                          const displayValue = column.render
                            ? column.render(value, row, rowIndex)
                            : formatNumber(value)

                          return (
                            <td
                              key={colIndex}
                              className={cn(
                                'px-3',
                                compact ? 'py-2' : 'py-3',
                                column.align === 'center' && 'text-center',
                                column.align === 'right' && 'text-right',
                                colIndex === 0 && 'font-medium'
                              )}
                            >
                              {displayValue}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * rowsPerPage + 1}-
                  {Math.min(currentPage * rowsPerPage, sortedData.length)} of{' '}
                  {sortedData.length} rows
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between py-3 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{sortedData.length} records found</span>
                {lastUpdated && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span>
                      Data as of{' '}
                      {(typeof lastUpdated === 'string'
                        ? new Date(lastUpdated)
                        : lastUpdated
                      ).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={onRefresh}
                className={cn(
                  'transition-colors',
                  onRefresh
                    ? 'text-muted-foreground hover:text-foreground cursor-pointer'
                    : 'text-muted-foreground/40 cursor-not-allowed'
                )}
                disabled={!onRefresh}
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // INLINE MODE - compact card with limited rows
  return (
    <div
      className="w-full rounded-lg border bg-card"
      style={{ maxHeight: '458px' }}
    >
      {/* Table Header */}
      {showHeader && (
        <TableHeader
          title={title}
          titleImage={titleImage}
          onExpand={handleExpand}
          selectable={selectable}
          hasSelection={selectedRowsSet.size > 0}
          onCopy={
            onCopy
              ? () =>
                  onCopy(visibleData.filter((_, i) => selectedRowsSet.has(i)))
              : undefined
          }
          onDownload={
            onDownload
              ? () =>
                  onDownload(
                    visibleData.filter((_, i) => selectedRowsSet.has(i))
                  )
              : undefined
          }
          onShare={
            onShare
              ? () =>
                  onShare(visibleData.filter((_, i) => selectedRowsSet.has(i)))
              : undefined
          }
        />
      )}

      {/* Mobile: Card view */}
      <div
        className="sm:hidden overflow-y-auto"
        style={{
          maxHeight: `calc(458px - ${showHeader ? '57px' : '0px'} - ${
            showFooter ? '41px' : '0px'
          })`
        }}
      >
        <div className="p-2 space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-md border bg-card p-3 space-y-2">
                {columns.slice(0, 4).map((_, j) => (
                  <div
                    key={j}
                    className="h-4 bg-muted animate-pulse rounded w-3/4"
                  />
                ))}
              </div>
            ))
          ) : visibleData.length === 0 ? (
            <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            visibleData.map((row, rowIndex) => (
              <button
                key={rowIndex}
                type="button"
                onClick={() => handleRowSelect(rowIndex)}
                disabled={selectable === 'none'}
                className={cn(
                  'w-full rounded-md border bg-card p-3 text-left transition-all',
                  selectable !== 'none' &&
                    'cursor-pointer hover:border-foreground/30',
                  selectedRowsSet.has(rowIndex) &&
                    'border-foreground ring-1 ring-foreground'
                )}
              >
                <div className="space-y-1.5">
                  {columns.map((column, colIndex) => {
                    const value = getValue(row, (column.accessor ?? '') as string)
                    const displayValue = column.render
                      ? column.render(value, row, rowIndex)
                      : formatNumber(value)

                    return (
                      <div
                        key={colIndex}
                        className="flex justify-between items-center"
                      >
                        <span className="text-xs text-muted-foreground">
                          {column.header ?? ''}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            colIndex === 0 && 'font-semibold'
                          )}
                        >
                          {displayValue}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Desktop: Table view */}
      <div
        className="hidden sm:block overflow-y-auto"
        style={{
          maxHeight: `calc(458px - ${showHeader ? '57px' : '0px'} - ${
            showFooter ? '41px' : '0px'
          })`
        }}
      >
        <table className="w-full text-sm" role="grid">
          <thead
            className={cn(
              'border-b bg-muted/50',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            <tr>
              {selectable === 'multi' && (
                <th className={cn('w-10 px-3', compact ? 'py-2' : 'py-3')}>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors cursor-pointer',
                      selectedRowsSet.size === visibleData.length &&
                        visibleData.length > 0
                        ? 'bg-foreground border-foreground text-background'
                        : 'border-border hover:border-foreground/50'
                    )}
                    aria-label="Select all rows"
                  >
                    {selectedRowsSet.size === visibleData.length &&
                      visibleData.length > 0 && <Check className="h-3 w-3" />}
                  </button>
                </th>
              )}
              {selectable === 'single' && (
                <th className={cn('w-10 px-3', compact ? 'py-2' : 'py-3')} />
              )}
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={cn(
                    'px-3 font-medium text-muted-foreground group text-left',
                    compact ? 'py-2' : 'py-3',
                    column.align === 'right' && 'text-right',
                    column.sortable &&
                      'cursor-pointer select-none hover:text-foreground'
                  )}
                  style={{ width: column.width }}
                  onClick={() =>
                    column.sortable && handleSort((column.accessor ?? '') as string)
                  }
                  role={
                    column.sortable ? 'columnheader button' : 'columnheader'
                  }
                  aria-sort={
                    sortConfig?.key === column.accessor
                      ? sortConfig?.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      column.align === 'right' && 'justify-end'
                    )}
                  >
                    {column.header ?? ''}
                    {column.sortable && getSortIcon((column.accessor ?? '') as string)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: maxRows }).map((_, i) => (
                <SkeletonRow
                  key={i}
                  columns={columns.length + (selectable !== 'none' ? 1 : 0)}
                  compact={compact}
                />
              ))
            ) : visibleData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable !== 'none' ? 1 : 0)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  onClick={() => handleRowSelect(rowIndex)}
                  className={cn(
                    'border-b border-border last:border-0 transition-colors',
                    selectable !== 'none' && 'cursor-pointer hover:bg-muted/30'
                  )}
                  role="row"
                  aria-selected={selectedRowsSet.has(rowIndex)}
                >
                  {selectable !== 'none' && (
                    <td className={cn('px-3', compact ? 'py-2' : 'py-3')}>
                      <div
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                          selectedRowsSet.has(rowIndex)
                            ? 'bg-foreground border-foreground text-background'
                            : 'border-border'
                        )}
                      >
                        {selectedRowsSet.has(rowIndex) && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                    </td>
                  )}
                  {columns.map((column, colIndex) => {
                    const value = getValue(row, (column.accessor ?? '') as string)
                    const displayValue = column.render
                      ? column.render(value, row, rowIndex)
                      : formatNumber(value)

                    return (
                      <td
                        key={colIndex}
                        className={cn(
                          'px-3',
                          compact ? 'py-2' : 'py-3',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          colIndex === 0 && 'font-medium'
                        )}
                      >
                        {displayValue}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      {showFooter && (
        <TableFooter
          moreCount={moreCount}
          lastUpdated={lastUpdated}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}
