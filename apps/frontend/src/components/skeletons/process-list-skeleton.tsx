import { Skeleton } from '@/components/ui/skeleton'

export function ProcessListSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 sm:p-5">
            <div className="space-y-3">
              {/* Process number and status */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              
              {/* Type and client */}
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
              
              {/* Court and value */}
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" />
              </div>
              
              {/* Next deadline */}
              <Skeleton className="h-4 w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
