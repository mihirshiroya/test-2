"use client"

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import confetti from "canvas-confetti"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import { Plus, ClipboardList, Search, X } from "lucide-react"

import { useTaskStore } from "@/lib/task-store"
import {
  canCompleteTask,
  normalizeTimestamp,
  STATUS_META,
  STATUS_ORDER,
  isLocked,
  isTaskStartAllowed,
  type Task,
  type TaskCategory,
  type TaskStatus,
} from "@/lib/task-timer"

import { TaskCard } from "./task-card"
import { TaskModal } from "./task-modal"

interface KanbanBoardProps {
  /**
   * Restrict the board to a single category.
   * When null, show tasks from every category.
   */
  category?: TaskCategory | null
}

export function KanbanBoard({
  category = null,
}: KanbanBoardProps) {
  const { tasks, timer, moveTask, deleteTask } = useTaskStore()

  const [draggingId, setDraggingId] =
    useState<string | null>(null)

  const [modalOpen, setModalOpen] =
    useState(false)

  const [editingTask, setEditingTask] =
    useState<Task | null>(null)

  const [deletingTask, setDeletingTask] =
    useState<Task | null>(null)

  const [createStatus, setCreateStatus] =
    useState<TaskStatus>("todo")

  const [notice, setNotice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const completedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const completedIds = new Set(
      tasks
        .filter((task) => task.status === "completed")
        .map((task) => task.id),
    )

    const completedNewTask = [...completedIds].some(
      (id) => !completedIdsRef.current.has(id),
    )

    const shouldCelebrate =
      completedIdsRef.current.size > 0 && completedNewTask

    completedIdsRef.current = completedIds

    if (!shouldCelebrate) return

    const end = Date.now() + 5000

    // School pride celebration
    const colors = ["#bb0000", "#ffffff"]

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      })

      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [tasks])

  // Week is the default view: it represents the last seven calendar days.
  const [period, setPeriod] =
    useState<"day" | "week" | "month">("week")

  /*
   * Only recalculate visible tasks when tasks/category/search changes.
   */
  const visibleTasks = useMemo(() => {
    const normalizedQuery =
      searchQuery.trim().toLocaleLowerCase()

    const now = new Date()
    const periodStart = new Date(now)
    const periodEnd = new Date(now)

    periodStart.setHours(0, 0, 0, 0)
    periodEnd.setHours(23, 59, 59, 999)

    if (period === "week") {
      // Show today plus the next seven calendar days using startDate.
      periodEnd.setDate(periodEnd.getDate() + 7)
      periodEnd.setHours(23, 59, 59, 999)
    } else if (period === "month") {
      periodStart.setDate(1)
      periodEnd.setMonth(periodStart.getMonth() + 1, 0)
    }

    return tasks.filter((task) => {
      const matchesCategory =
        category == null || task.category === category

      // Older tasks may not have a start date. Use createdAt as a safe fallback
      // so missing, null, or malformed dates never make a task disappear.
      const isUnfinished = task.status !== "completed"

      // Completed views are based on when work was completed, not when it was scheduled.
      // This keeps a task completed today visible even if its start date was earlier.
      const taskDate = isUnfinished
        ? normalizeTimestamp(task.startDate) ??
          normalizeTimestamp(task.createdAt)
        : normalizeTimestamp(task.completedAt) ??
          normalizeTimestamp(task.startDate) ??
          normalizeTimestamp(task.createdAt)

      const start = periodStart.getTime()
      const end = periodEnd.getTime()

      // Unfinished work is always retained once it is due/available, but future
      // tasks only appear in the selected window. This keeps Today free of
      // upcoming tasks while Week and Month include their scheduled work.
      const matchesPeriod =
        taskDate == null ||
        (isUnfinished
          ? taskDate <= end
          : taskDate >= start && taskDate <= end)

      if (!matchesCategory || !matchesPeriod) return false

      if (!normalizedQuery) return true

      return [
        task.title,
        task.description,
        task.priority,
        task.status,
      ].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      )
    })
  }, [tasks, category, searchQuery, period])

  /*
   * Build all four columns in one pass.
   *
   * This avoids:
   *
   * visibleTasks.filter(...)
   * visibleTasks.filter(...)
   * visibleTasks.filter(...)
   * visibleTasks.filter(...)
   */
  const columns = useMemo(() => {
    const result: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      on_hold: [],
      completed: [],
    }

    for (const task of visibleTasks) {
      result[task.status].push(task)
    }

    for (const status of STATUS_ORDER) {
      result[status].sort((a, b) => {
        if (a.category === b.category) {
          return a.position - b.position
        }

        return a.category.localeCompare(b.category)
      })
    }

    return result
  }, [visibleTasks])

  /*
   * Global single-active-task rule.
   */
  const hasInProgress = useMemo(
    () =>
      tasks.some(
        (task) => task.status === "in_progress",
      ),
    [tasks],
  )

  /*
   * Only look up the dragged task when draggingId changes.
   */
  const draggingTask = useMemo(() => {
    if (!draggingId) {
      return null
    }

    return (
      tasks.find(
        (task) => task.id === draggingId,
      ) ?? null
    )
  }, [tasks, draggingId])

  /*
   * Stable callback.
   */
  const openCreate = useCallback(
    (status: TaskStatus) => {
      setEditingTask(null)
      setCreateStatus(status)
      setModalOpen(true)
    },
    [],
  )

  /*
   * Stable callback.
   */
  const openEdit = useCallback(
    (task: Task) => {
      if (isLocked(task.status)) return

      setEditingTask(task)
      setModalOpen(true)
    },
    [],
  )

  const openDelete = useCallback((task: Task) => {
    setDeletingTask(task)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deletingTask) {
      deleteTask(deletingTask.id)
    }

    setDeletingTask(null)
  }, [deleteTask, deletingTask])

  /*
   * Stable drag-start callback.
   */
  const onDragStart = useCallback(
    (start: { draggableId: string }) => {
      setDraggingId(start.draggableId)
    },
    [],
  )

  /*
   * Stable drag-end callback.
   */
  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDraggingId(null)

      const {
        source,
        destination,
        draggableId,
      } = result

      if (!destination) {
        return
      }

      /*
       * Nothing changed.
       */
      if (
        source.droppableId ===
          destination.droppableId &&
        source.index === destination.index
      ) {
        return
      }

      const destinationStatus =
        destination.droppableId as TaskStatus

      const dragged = tasks.find(
        (task: Task) => task.id === draggableId,
      )

      if (
        dragged &&
        destinationStatus === "completed" &&
        !canCompleteTask(
          dragged,
          timer,
          Date.now(),
        )
      ) {
        setNotice(
          "Complete becomes available after 75% of the planned time is used.",
        )

        window.setTimeout(
          () => setNotice(null),
          4000,
        )

        return
      }

      if (
        dragged &&
        destinationStatus === "in_progress" &&
        !isTaskStartAllowed(dragged)
      ) {
        setNotice(
          "This task cannot start before its scheduled start date.",
        )

        window.setTimeout(
          () => setNotice(null),
          4000,
        )

        return
      }

      // `destination.index` belongs to the filtered/rendered list, while the
      // store reindexes the complete column. Translate the visible drop target
      // back to a full-column index so search/date filters cannot break reorder.
      const destinationVisibleTasks =
        columns[destinationStatus] ?? []

      const draggedCategory =
        dragged?.category

      // The merged board interleaves categories. Convert the rendered drop
      // index into an index within the dragged task's category, which is the
      // ordering used by the store.
      const categoryItemsBeforeDrop =
        destinationVisibleTasks
          .slice(0, destination.index)
          .filter(
            (task) =>
              task.category === draggedCategory &&
              task.id !== draggableId,
          ).length

      const fullDestinationLength =
        tasks.filter(
          (task) =>
            task.status === destinationStatus &&
            task.category === draggedCategory &&
            task.id !== draggableId,
        ).length

      const fullIndex = Math.min(
        categoryItemsBeforeDrop,
        fullDestinationLength,
      )

      moveTask(
        draggableId,
        destinationStatus,
        fullIndex,
      )
    },
    [moveTask, tasks, timer, columns],
  )

  /*
   * Stable modal close callback.
   */
  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingTask(null)
  }, [])

  return (
    <>
      {notice && (
        <div
          className="fixed right-4 top-4 z-50 max-w-sm rounded-lg border border-warning/40 bg-card px-4 py-3 text-sm text-foreground shadow-lg"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="h-10 w-full rounded-lg border border-soft bg-card pl-9 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear task search"
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X
                className="size-4"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Task start date period"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-soft p-1"
        >
          {(["day", "week", "month"] as const).map(
            (option) => {
              const active = period === option

              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPeriod(option)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option === "day"
                    ? "Day"
                    : option === "week"
                      ? "Week"
                      : "Month"}
                </button>
              )
            },
          )}
        </div>
      </div>

      <DragDropContext
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status]

            const columnTasks =
              columns[status]

            /*
             * Only calculate this value for the
             * current column.
             */
            const dropDisabled =
              (!!draggingTask &&
                isLocked(
                  draggingTask.status,
                )) ||
              (!!draggingTask &&
                status === "in_progress" &&
                !isTaskStartAllowed(
                  draggingTask,
                )) ||
              (status === "in_progress" &&
                hasInProgress &&
                !!draggingTask &&
                draggingTask.status !==
                  "in_progress")

            return (
              <KanbanColumn
                key={status}
                status={status}
                meta={meta}
                tasks={columnTasks}
                dropDisabled={dropDisabled}
                draggingId={draggingId}
                activeTaskId={
                  timer.activeTaskId
                }
                category={category}
                onCreate={openCreate}
                onEdit={openEdit}
                onDelete={openDelete}
              />
            )
          })}
        </div>
      </DragDropContext>

      {modalOpen && (
        <TaskModal
          task={editingTask}
          createInStatus={createStatus}
          createInCategory={category}
          onClose={closeModal}
        />
      )}

      {deletingTask && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div className="w-full max-w-sm border border-soft bg-card p-6 shadow-2xl">
            <h2
              id="delete-task-title"
              className="text-lg font-semibold text-foreground"
            >
              Delete task?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will permanently delete “
              {deletingTask.title}”. This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setDeletingTask(null)
                }
                className="rounded-lg border border-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-error px-3 py-2 text-sm font-medium text-error-foreground hover:opacity-90"
              >
                Delete task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Kanban Column                                                               */
/* -------------------------------------------------------------------------- */

interface KanbanColumnProps {
  status: TaskStatus
  meta: (typeof STATUS_META)[TaskStatus]
  tasks: Task[]
  dropDisabled: boolean
  draggingId: string | null
  activeTaskId: string | null
  category: TaskCategory | null
  onCreate: (status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

const KanbanColumn = memo(
  function KanbanColumn({
    status,
    meta,
    tasks,
    dropDisabled,
    draggingId,
    activeTaskId,
    category,
    onCreate,
    onEdit,
    onDelete,
  }: KanbanColumnProps) {
    return (
      <div className="flex flex-col gap-3">
        {/* Column header */}
        <div
          className="flex items-center justify-between rounded-lg border-l-[3px] bg-muted/40 px-3 py-2"
          style={{
            borderColor: meta.accent,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {meta.title}
            </span>

            <span className="rounded-full bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {tasks.length}
            </span>
          </div>

          {status !== "completed" && (
            <button
              type="button"
              onClick={() => onCreate(status)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-primary"
              aria-label={`Add task to ${meta.title}`}
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Droppable area */}
        <Droppable
          droppableId={status}
          isDropDisabled={dropDisabled}
        >
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex min-h-40 flex-col gap-3 rounded-xl p-2 transition-colors ${
                snapshot.isDraggingOver
                  ? "bg-primary-soft/60"
                  : dropDisabled && draggingId
                    ? "bg-warning-soft/40"
                    : "bg-transparent"
              }`}
            >
              {tasks.map((task, index) => (
                <KanbanDraggable
                  key={task.id}
                  task={task}
                  index={index}
                  activeTaskId={activeTaskId}
                  category={category}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}

              {provided.placeholder}

              {tasks.length === 0 &&
                !snapshot.isDraggingOver && (
                  <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                    <ClipboardList
                      size={28}
                      aria-hidden="true"
                    />

                    <p className="text-xs">
                      No tasks
                    </p>
                  </div>
                )}
            </div>
          )}
        </Droppable>
      </div>
    )
  },
)

KanbanColumn.displayName = "KanbanColumn"

/* -------------------------------------------------------------------------- */
/* Draggable Task                                                              */
/* -------------------------------------------------------------------------- */

interface KanbanDraggableProps {
  task: Task
  index: number
  activeTaskId: string | null
  category: TaskCategory | null
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

const KanbanDraggable = memo(
  function KanbanDraggable({
    task,
    index,
    activeTaskId,
    category,
    onEdit,
    onDelete,
  }: KanbanDraggableProps) {
    const locked = isLocked(task.status)

    const isActive =
      activeTaskId === task.id

    return (
      <Draggable
        draggableId={task.id}
        index={index}
        isDragDisabled={locked}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={
              provided.draggableProps.style
            }
            className={
              snapshot.isDragging
                ? "rotate-1"
                : ""
            }
          >
            <TaskCard
              task={task}
              isActive={isActive}
              onEdit={onEdit}
              onDelete={onDelete}
              showCategory={
                category == null
              }
            />
          </div>
        )}
      </Draggable>
    )
  },
)

KanbanDraggable.displayName =
  "KanbanDraggable"