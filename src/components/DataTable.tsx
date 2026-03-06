import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (row: T, key: string) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  onRowClick?: (row: T) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

export const DataTable = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
}: DataTableProps<T>) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-[#eaae4c] border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-4 text-[#9e9f92]">Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-[#504840]">
        <p className="text-[#9e9f92]">No hay datos disponibles</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md border border-[#504840]">
      <table className="w-full">
        <thead className="bg-[#504840] border-b border-[#504840]">
          <tr>
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
                      className="ml-1 text-[#eaae4c] hover:text-white cursor-pointer transition-colors"
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
                'border-b border-[#f8f8f8]',
                onRowClick && 'cursor-pointer hover:bg-[#f8f8f8] transition-colors'
              )}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className={cn('px-6 py-4 text-sm text-black', column.width)}
                >
                  {column.render
                    ? column.render(row, String(column.key))
                    : (row[column.key as keyof T] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
