import { Skeleton } from '@/components/ui/skeleton'

export function ClientListSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 sm:p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              
              <div className="flex-1 space-y-3">
                {/* Name */}
                <Skeleton className="h-5 w-48" />
                
                {/* Contact info */}
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
                
                {/* Stats */}
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
