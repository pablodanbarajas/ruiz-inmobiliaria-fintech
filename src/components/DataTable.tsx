import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import { TableSkeleton } from '@/components/ui/Skeleton'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T, key: string) => React.ReactNode
  sortable?: boolean
  width?: string
  mobileHide?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
}: DataTableProps<T>) => {
  if (loading) {
    return <TableSkeleton rows={6} columns={Math.max(3, columns.length)} />
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-[#504840]">
        <p className="text-[#9e9f92]">{emptyMessage}</p>
      </div>
    )
  }

  const titleCol = columns[0]
  const middleCols = columns.slice(1, -1).filter(c => !c.mobileHide)
  const actionCol = columns.length > 1 ? columns[columns.length - 1] : null

  const getCellValue = (row: T, col: Column<T>) =>
    col.render ? col.render(row, String(col.key)) : (row[col.key as keyof T] as React.ReactNode)

  return (
    <>
      {/* Mobile: card view */}
      <div className="md:hidden space-y-2">
        {data.map((row, idx) => (
          <div
            key={idx}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'bg-white rounded-[20px] border border-[#e0e5e7] shadow-sm overflow-hidden',
              onRowClick && 'cursor-pointer active:bg-[#f8f8f8]'
            )}
          >
            {/* Card title row */}
            <div className="px-4 pt-3 pb-2 border-b border-[#f0ede8] flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-black truncate flex-1">
                {getCellValue(row, titleCol)}
              </div>
              {actionCol && (
                <div className="flex-shrink-0 text-sm">
                  {getCellValue(row, actionCol)}
                </div>
              )}
            </div>

            {/* Card body: middle columns as label-value grid */}
            {middleCols.length > 0 && (
              <div className="px-4 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {middleCols.map((col) => (
                  <div key={String(col.key)} className="min-w-0">
                    <p className="text-[10px] font-semibold text-[#9e9f92] uppercase tracking-wide leading-none mb-0.5">
                      {col.label}
                    </p>
                    <div className="text-xs text-black truncate">
                      {getCellValue(row, col)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: standard table */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-[20px] shadow-[var(--shadow-soft)] border border-[#ebebeb]">
        <table className="w-full">
          <thead className="bg-[#504840] border-b border-[#504840]">
            <tr className="bg-[#142127]">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-6 py-3 text-left text-sm font-semibold text-white',
                    column.width
                  )}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && onSort && (
                      <button
                        onClick={() => onSort(String(column.key))}
                        className="ml-1 text-[#fffa77] hover:text-white cursor-pointer transition-colors"
                      >
                        {sortBy === String(column.key) ? (
                          sortOrder === 'asc' ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )
                        ) : (
                          <ChevronDown size={16} className="opacity-40" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f8f8f8]">
            {data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-[#e0e5e7]',
                  onRowClick && 'cursor-pointer hover:bg-[#fffde1] transition-colors'
                )}
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={cn('px-6 py-4 text-sm text-[#343c40]', column.width)}
                  >
                    {getCellValue(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
