import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'

interface GenericKanbanColumnProps<T extends { id: string }> {
  id: string
  title: string
  items: T[]
  renderCard: (item: T, isDragging: boolean) => React.ReactNode
}

export function GenericKanbanColumn<T extends { id: string }>({
  id,
  title,
  items,
  renderCard,
}: GenericKanbanColumnProps<T>) {
  const { setNodeRef } = useDroppable({
    id,
  })

  return (
    <div className="flex flex-col h-full min-w-[280px] w-[280px] bg-muted/30 rounded-lg border border-border/50">
      <div className="p-3 font-semibold text-sm flex items-center justify-between border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-xs text-muted-foreground">
            {title}
          </span>
          <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
            {items.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-2 overflow-y-auto min-h-[150px] scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      >
        <SortableContext
          id={id}
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2 min-h-full">
            {items.map((item) => renderCard(item, false))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
