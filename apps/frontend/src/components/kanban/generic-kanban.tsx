import { useState, useMemo, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GenericKanbanColumn } from './generic-kanban-column'

interface GenericKanbanProps<T extends { id: string; status: string }> {
  items: T[]
  columns: Record<string, string>
  columnOrder: string[]
  onStatusChange: (item: T, newStatus: string) => Promise<void>
  renderCard: (item: T, isDragging: boolean) => React.ReactNode
}

// Wrapper to handle useSortable for each item
function SortableItemWrapper<T extends { id: string }>({
  item,
  renderCard,
}: {
  item: T
  renderCard: (item: T, isDragging: boolean) => React.ReactNode
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: 'Item',
      item,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {renderCard(item, isDragging)}
    </div>
  )
}

export function GenericKanban<T extends { id: string; status: string }>({
  items: initialItems,
  columns,
  columnOrder,
  onStatusChange,
  renderCard,
}: GenericKanbanProps<T>) {
  const [items, setItems] = useState<T[]>(initialItems)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const groupedItems = useMemo(() => {
    const groups: Record<string, T[]> = {}
    columnOrder.forEach((status) => {
      groups[status] = items.filter((item) => item.status === status)
    })
    return groups
  }, [items, columnOrder])

  const findContainer = (id: string) => {
    if (id in columns) return id

    const item = items.find((i) => i.id === id)
    return item?.status
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    setActiveId(id)
    const status = findContainer(id)
    if (status) setActiveStatus(status)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    const overId = over?.id

    if (!overId || active.id === overId) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(overId as string)

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return
    }

    setItems((prev) => {
      return prev.map((item) => {
        if (item.id === active.id) {
          return { ...item, status: overContainer }
        }
        return item
      })
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    const activeId = active.id as string
    const overId = over?.id

    if (!overId) {
      setActiveId(null)
      setActiveStatus(null)
      return
    }

    const overContainer = findContainer(overId as string)

    if (activeStatus && overContainer && activeStatus !== overContainer) {
      const item = items.find((i) => i.id === activeId)
      if (item) {
        try {
          await onStatusChange(item, overContainer)
        } catch (error) {
          console.error('Failed to update status', error)
          // Revert changes implies reloading from props or manual revert
          // For now, we rely on parent to handle error/reload
          // But since we updated local state in DragOver, we might be out of sync if parent doesn't force update
          // The useEffect([initialItems]) should handle it if parent triggers re-fetch
        }
      }
    }

    setActiveId(null)
    setActiveStatus(null)
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {columnOrder.map((status) => (
          <GenericKanbanColumn
            key={status}
            id={status}
            title={columns[status]}
            items={groupedItems[status] || []}
            renderCard={(item) => (
              <SortableItemWrapper
                key={item.id}
                item={item}
                renderCard={renderCard}
              />
            )}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeItem ? renderCard(activeItem, false) : null}
      </DragOverlay>
    </DndContext>
  )
}
