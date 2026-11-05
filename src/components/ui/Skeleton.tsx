import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-md bg-[#e7ecee]', className)}
  />
)

export const TableSkeleton = ({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) => (
  <div className="overflow-hidden rounded-[20px] border border-[#e0e5e7] bg-white">
    <div className="h-12 bg-[#142127]" />
    <div className="divide-y divide-[#eef1f2]">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-6 px-6 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, column) => (
            <Skeleton key={column} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
)

export const DetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-10 w-28 rounded-full" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </div>
    <div className="rounded-[20px] border border-[#e0e5e7] bg-white p-6 md:p-8">
      <Skeleton className="mb-3 h-3 w-32" />
      <Skeleton className="mb-8 h-10 w-64" />
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-36" />
          </div>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-[16px] border border-[#e0e5e7] bg-white p-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  </div>
)
