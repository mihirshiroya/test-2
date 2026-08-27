import { KanbanBoard } from "@/components/kanban/kanban-board"
import { TimerPanel } from "@/components/timer/timer-panel"
import type { TaskCategory } from "@/lib/task-timer"

interface BoardViewProps {
  title: string
  description: string
  /** null = merged Kanban board (all categories). */
  category: TaskCategory | null
}

/**
 * Shared layout for every board screen: a heading, the Kanban board and a
 * sticky focus-timer panel. Notes and Projects pass their category; the merged
 * Kanban page passes null.
 */
export function BoardView({ title, description, category }: BoardViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          {title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 ">
        <div className="order-2 lg:order-1">
          <KanbanBoard category={category} />
        </div>
      </div>
    </div>
  )
}
