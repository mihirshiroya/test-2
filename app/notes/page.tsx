import { BoardView } from "@/components/kanban/board-view"

export default function NotesPage() {
  return (
    <BoardView
      title="Notes"
      description="Capture and work through your notes on a Kanban board. Drag a note into “In Progress” to auto-start its countdown — only one task runs at a time across the whole workspace."
      category="notes"
    />
  )
}
