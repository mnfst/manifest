'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
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
  Share2,
  X
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export interface TableColumn<T = Record<string, unknown>> {
  header: string
  accessor: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

export interface TableProps<T = Record<string, unknown>> {
  data?: {
    columns?: TableColumn<T>[]
    rows?: T[]
    title?: string
    titleImage?: string
    lastUpdated?: Date | string
    totalRows?: number
  }
  actions?: {
    onSelectionChange?: (selectedRows: T[]) => void
    onCopy?: (selectedRows: T[]) => void
    onDownload?: (selectedRows: T[]) => void
    onShare?: (selectedRows: T[]) => void
    onRefresh?: () => void
    onExpand?: () => void
  }
  appearance?: {
    selectable?: 'none' | 'single' | 'multi'
    emptyMessage?: string
    stickyHeader?: boolean
    compact?: boolean
    showActions?: boolean
    showHeader?: boolean
    showFooter?: boolean
    maxRows?: number
  }
  control?: {
    loading?: boolean
    selectedRows?: T[]
  }
}

// Default demo data for the table
const defaultColumns: TableColumn[] = [
  { header: 'Model', accessor: 'model', sortable: true },
  {
    header: 'Input (w/ Cache)',
    accessor: 'inputCache',
    sortable: true,
    align: 'right'
  },
  { header: 'Output', accessor: 'output', sortable: true, align: 'right' },
  {
    header: 'Total Tokens',
    accessor: 'totalTokens',
    sortable: true,
    align: 'right'
  },
  {
    header: 'API Cost',
    accessor: 'apiCost',
    sortable: true,
    align: 'right',
    render: (value) => `$${(value as number).toFixed(2)}`
  }
]

const defaultData = [
  {
    model: 'gpt-5',
    inputCache: 0,
    output: 103271,
    totalTokens: 2267482,
    apiCost: 0.0
  },
  {
    model: 'claude-3.5-sonnet',
    inputCache: 176177,
    output: 8326,
    totalTokens: 647528,
    apiCost: 1.0
  },
  {
    model: 'gemini-2.0-flash-exp',
    inputCache: 176100,
    output: 8326,
    totalTokens: 647528,
    apiCost: 0.0
  },
  {
    model: 'gemini-2.5-pro',
    inputCache: 176177,
    output: 7000,
    totalTokens: 647528,
    apiCost: 0.0
  },
  {
    model: 'claude-4-sonnet',
    inputCache: 68415,
    output: 12769,
    totalTokens: 946536,
    apiCost: 0.71
  },
  {
    model: 'gpt-4-turbo',
    inputCache: 52000,
    output: 15000,
    totalTokens: 520000,
    apiCost: 0.45
  },
  {
    model: 'llama-3.1-70b',
    inputCache: 45000,
    output: 9500,
    totalTokens: 380000,
    apiCost: 0.12
  },
  {
    model: 'mistral-large',
    inputCache: 38000,
    output: 7800,
    totalTokens: 290000,
    apiCost: 0.08
  },
  {
    model: 'claude-3-opus',
    inputCache: 200000,
    output: 25000,
    totalTokens: 1200000,
    apiCost: 2.5
  }
]

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

// TableHeader component
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
            alt=""
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
        {moreCount && moreCount > 0 && (
          <span>+{moreCount} more</span>
        )}
        {moreCount && moreCount > 0 && lastUpdated && (
          <span className="text-muted-foreground/50">·</span>
        )}
        {lastUpdated && (
          <span>Data as of {formatTimestamp(lastUpdated)}</span>
        )}
        {!hasLeftContent && <span>&nbsp;</span>}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// Fullscreen Table Modal
function FullscreenTableModal<T extends Record<string, unknown>>({
  title,
  titleImage,
  columns,
  rows,
  onClose,
  selectable,
  compact,
  onSelectionChange,
  onCopy,
  onDownload,
  onShare,
  lastUpdated,
  onRefresh
}: {
  title?: string
  titleImage?: string
  columns: TableColumn<T>[]
  rows: T[]
  onClose: () => void
  selectable: 'none' | 'single' | 'multi'
  compact: boolean
  onSelectionChange?: (selectedRows: T[]) => void
  onCopy?: (selectedRows: T[]) => void
  onDownload?: (selectedRows: T[]) => void
  onShare?: (selectedRows: T[]) => void
  lastUpdated?: Date | string
  onRefresh?: () => void
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [selectedRowsSet, setSelectedRowsSet] = useState<Set<number>>(new Set())

  const rowsPerPage = 15

  const sortedData = useMemo(() => {
    if (!sortConfig) return rows

    return [...rows].sort((a, b) => {
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
  }, [rows, sortConfig])

  const totalPages = Math.ceil(sortedData.length / rowsPerPage)
  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const handleSort = (accessor: string) => {
    setSortConfig((current) => {
      if (current?.key === accessor) {
        if (current.direction === 'asc') {
          return { key: accessor, direction: 'desc' }
        }
        return null
      }
      return { key: accessor, direction: 'asc' }
    })
  }

  const handleRowSelect = (index: number) => {
    if (selectable === 'none') return

    const globalIndex = (currentPage - 1) * rowsPerPage + index
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

    setSelectedRowsSet(newSelected)
    onSelectionChange?.(sortedData.filter((_, i) => newSelected.has(i)))
  }

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
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  const hasSelection = selectedRowsSet.size > 0
  const getSelectedRows = () => sortedData.filter((_, i) => selectedRowsSet.has(i))

  return (
    <div className="fixed top-14 bottom-0 left-0 right-0 md:left-[226px] z-40 flex flex-col bg-background">
      {/* Modal Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <span className="text-sm font-medium">{title || 'Table'}</span>

        <div className="w-8" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4">
        {/* Table Header - inside content, above table */}
        <div className="flex items-center justify-between py-3 h-14">
          <div className="flex items-center gap-2">
            {titleImage && (
              <img
                src={titleImage}
                alt=""
                className="h-5 w-5 rounded object-cover"
              />
            )}
            <span className="font-medium">{title || 'Table'}</span>
          </div>

          {/* Action buttons - always visible, disabled when no selection */}
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
          </div>
        </div>
        <div className="w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  {selectable !== 'none' && (
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
                        column.sortable && handleSort(column.accessor as string)
                      }
                    >
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          column.align === 'right' && 'justify-end'
                        )}
                      >
                        {column.header}
                        {column.sortable &&
                          getSortIcon(column.accessor as string)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, rowIndex) => {
                  const globalIndex = (currentPage - 1) * rowsPerPage + rowIndex
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
                        const value = getValue(row, column.accessor as string)
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
        </div>
      </div>

      {/* Footer - no borders */}
      <div className="flex items-center justify-between px-4 py-2">
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
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function Table<T extends Record<string, unknown>>({
  data: dataProps,
  actions,
  appearance,
  control
}: TableProps<T>) {
  const {
    columns = defaultColumns as unknown as TableColumn<T>[],
    rows: tableData = defaultData as unknown as T[],
    title,
    titleImage,
    lastUpdated = new Date(),
    totalRows
  } = dataProps ?? {}
  const { onSelectionChange, onCopy, onDownload, onShare, onRefresh, onExpand } =
    actions ?? {}
  const {
    selectable = 'none',
    emptyMessage = 'No data available',
    stickyHeader = false,
    compact = false,
    showActions = false,
    showHeader = true,
    showFooter = true,
    maxRows = 5
  } = appearance ?? {}
  const { loading = false, selectedRows: controlledSelectedRows } = control ?? {}

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<number>>(
    new Set()
  )

  const selectedRowsSet = controlledSelectedRows
    ? new Set(controlledSelectedRows.map((row) => tableData.indexOf(row)))
    : internalSelectedRows

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
  }, [])

  const sortedData = useMemo(() => {
    if (!sortConfig) return tableData

    return [...tableData].sort((a, b) => {
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
  }, [tableData, sortConfig])

  // Limit visible rows in inline mode
  const visibleData = sortedData.slice(0, maxRows)
  const moreCount = totalRows
    ? totalRows - maxRows
    : sortedData.length > maxRows
      ? sortedData.length - maxRows
      : 0

  const handleRowSelect = useCallback(
    (index: number) => {
      if (selectable === 'none') return

      const newSelected = new Set(selectedRowsSet)

      if (selectable === 'single') {
        if (newSelected.has(index)) {
          newSelected.clear()
        } else {
          newSelected.clear()
          newSelected.add(index)
        }
      } else {
        if (newSelected.has(index)) {
          newSelected.delete(index)
        } else {
          newSelected.add(index)
        }
      }

      setInternalSelectedRows(newSelected)
      onSelectionChange?.(sortedData.filter((_, i) => newSelected.has(i)))
    },
    [selectable, selectedRowsSet, sortedData, onSelectionChange]
  )

  const handleSelectAll = useCallback(() => {
    if (selectable !== 'multi') return

    const allSelected = selectedRowsSet.size === visibleData.length
    const newSelected = allSelected
      ? new Set<number>()
      : new Set(visibleData.map((_, i) => i))

    setInternalSelectedRows(newSelected)
    onSelectionChange?.(allSelected ? [] : visibleData)
  }, [selectable, selectedRowsSet.size, visibleData, onSelectionChange])

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
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    )
  }

  const handleExpand = () => {
    if (onExpand) {
      onExpand()
    } else {
      setIsFullscreen(true)
    }
  }

  return (
    <>
      <div className="w-full rounded-lg border bg-card" style={{ maxHeight: '458px' }}>
        {/* Table Header */}
        {showHeader && (
          <TableHeader
            title={title}
            titleImage={titleImage}
            onExpand={handleExpand}
            selectable={selectable}
            hasSelection={selectedRowsSet.size > 0}
            onCopy={onCopy ? () => onCopy(visibleData.filter((_, i) => selectedRowsSet.has(i))) : undefined}
            onDownload={onDownload ? () => onDownload(visibleData.filter((_, i) => selectedRowsSet.has(i))) : undefined}
            onShare={onShare ? () => onShare(visibleData.filter((_, i) => selectedRowsSet.has(i))) : undefined}
          />
        )}

        {/* Mobile: Card view */}
        <div
          className="sm:hidden overflow-y-auto"
          style={{
            maxHeight: `calc(458px - ${showHeader ? '57px' : '0px'} - ${showFooter ? '41px' : '0px'})`
          }}
        >
          <div className="p-2 space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-md border bg-card p-3 space-y-2"
                >
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
                      const value = getValue(row, column.accessor as string)
                      const displayValue = column.render
                        ? column.render(value, row, rowIndex)
                        : formatNumber(value)

                      return (
                        <div
                          key={colIndex}
                          className="flex justify-between items-center"
                        >
                          <span className="text-xs text-muted-foreground">
                            {column.header}
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
            maxHeight: `calc(458px - ${showHeader ? '57px' : '0px'} - ${showFooter ? '41px' : '0px'})`
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
                      column.sortable && handleSort(column.accessor as string)
                    }
                    role={
                      column.sortable ? 'columnheader button' : 'columnheader'
                    }
                    aria-sort={
                      sortConfig?.key === column.accessor
                        ? sortConfig.direction === 'asc'
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
                      {column.header}
                      {column.sortable && getSortIcon(column.accessor as string)}
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
                      const value = getValue(row, column.accessor as string)
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

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <FullscreenTableModal
          title={title}
          titleImage={titleImage}
          columns={columns}
          rows={sortedData}
          onClose={() => setIsFullscreen(false)}
          selectable={selectable}
          compact={compact}
          onSelectionChange={onSelectionChange}
          onCopy={onCopy}
          onDownload={onDownload}
          onShare={onShare}
          lastUpdated={lastUpdated}
          onRefresh={onRefresh}
        />
      )}
    </>
  )
}
