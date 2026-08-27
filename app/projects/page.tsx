import { BoardView } from "@/components/kanban/board-view"

export default function ProjectsPage() {
  return (
    <BoardView
      title="Projects"
      description="Plan and execute project tasks with the same Kanban board and focus timer. Move a task into “In Progress” to start its countdown — pause it to On Hold, and completed tasks lock in place."
      category="projects"
    />
  )
}
