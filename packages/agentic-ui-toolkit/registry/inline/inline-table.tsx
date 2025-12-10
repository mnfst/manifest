'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, ChevronUp, Download, Minus, Send } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

export interface TableColumn<T = Record<string, unknown>> {
  header: string
  accessor: keyof T | string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

export interface InlineTableProps<T = Record<string, unknown>> {
  columns?: TableColumn<T>[]
  data?: T[]
  selectable?: 'none' | 'single' | 'multi'
  onSelectionChange?: (selectedRows: T[]) => void
  loading?: boolean
  emptyMessage?: string
  stickyHeader?: boolean
  compact?: boolean
  selectedRows?: T[]
  showActions?: boolean
  onDownload?: (selectedRows: T[]) => void
  onSend?: (selectedRows: T[]) => void
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

export function InlineTable<T extends Record<string, unknown>>({
  columns = defaultColumns as unknown as TableColumn<T>[],
  data = defaultData as unknown as T[],
  selectable = 'none',
  onSelectionChange,
  loading = false,
  emptyMessage = 'No data available',
  stickyHeader = false,
  compact = false,
  selectedRows: controlledSelectedRows,
  showActions = false,
  onDownload,
  onSend
}: InlineTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<number>>(
    new Set()
  )

  const selectedRowsSet = controlledSelectedRows
    ? new Set(controlledSelectedRows.map((row) => data.indexOf(row)))
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
    if (!sortConfig) return data

    return [...data].sort((a, b) => {
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
  }, [data, sortConfig])

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

    const allSelected = selectedRowsSet.size === sortedData.length
    const newSelected = allSelected
      ? new Set<number>()
      : new Set(sortedData.map((_, i) => i))

    setInternalSelectedRows(newSelected)
    onSelectionChange?.(allSelected ? [] : sortedData)
  }, [selectable, selectedRowsSet.size, sortedData, onSelectionChange])

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

  return (
    <div className="w-full">
      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-md sm:rounded-lg border bg-card p-3 space-y-2">
              {columns.slice(0, 4).map((_, j) => (
                <div
                  key={j}
                  className="h-4 bg-muted animate-pulse rounded w-3/4"
                />
              ))}
            </div>
          ))
        ) : sortedData.length === 0 ? (
          <div className="rounded-md sm:rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          sortedData.map((row, rowIndex) => (
            <button
              key={rowIndex}
              type="button"
              onClick={() => handleRowSelect(rowIndex)}
              disabled={selectable === 'none'}
              className={cn(
                'w-full rounded-md sm:rounded-lg border bg-card p-3 text-left transition-all',
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

      {/* Desktop: Table view */}
      <div className="hidden sm:block overflow-x-auto rounded-md sm:rounded-lg">
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
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      selectedRowsSet.size === sortedData.length &&
                        sortedData.length > 0
                        ? 'bg-foreground border-foreground text-background'
                        : 'border-border hover:border-foreground/50'
                    )}
                    aria-label="Select all rows"
                  >
                    {selectedRowsSet.size === sortedData.length &&
                      sortedData.length > 0 && <Check className="h-3 w-3" />}
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
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow
                  key={i}
                  columns={columns.length + (selectable !== 'none' ? 1 : 0)}
                  compact={compact}
                />
              ))
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable !== 'none' ? 1 : 0)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, rowIndex) => (
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

      {/* Action buttons for multi-select */}
      {showActions && selectable === 'multi' && (
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {selectedRowsSet.size > 0
              ? `${selectedRowsSet.size} item${selectedRowsSet.size > 1 ? 's' : ''} selected`
              : 'Select items'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedRowsSet.size === 0}
              onClick={() => onDownload?.(sortedData.filter((_, i) => selectedRowsSet.has(i)))}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              size="sm"
              disabled={selectedRowsSet.size === 0}
              onClick={() => onSend?.(sortedData.filter((_, i) => selectedRowsSet.has(i)))}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
