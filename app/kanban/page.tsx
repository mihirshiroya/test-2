import { BoardView } from "@/components/kanban/board-view"

export default function KanbanPage() {
  return (
    <BoardView
      title="Kanban"
      description="Notes and Projects tasks merged into one board. Each card is tagged with its source. The single-active-task rule still applies — starting any task pauses whatever else was running, whether a note or a project."
      category={null}
    />
  )
}
