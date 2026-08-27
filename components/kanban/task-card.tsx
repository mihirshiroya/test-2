"use client"
import { useEffect, useState,memo } from "react"
import {
  Clock3,
  Play,
  Pause,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"

import { useTaskStore } from "@/lib/task-store"
import {
  isLocked,
  canCompleteTask,
  isTaskStartAllowed,
  normalizeTimestamp,
  remainingSeconds,
  taskSpentSeconds,
  PRIORITY_META,
  type Task,
} from "@/lib/task-timer"

interface TaskCardProps {
  task: Task
  isActive: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  showCategory?: boolean
}

/**
 * Show only hours + minutes.
 *
 * 3h 25m 42s -> 3h 25m
 * 45m 20s    -> 0h 45m
 * 10h 5m     -> 10h 5m
 */
function formatRemaining(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))

  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  return `${hours}h ${minutes}m`
}

export const TaskCard = memo(function TaskCard({
  task,
  isActive,
  onEdit,
  onDelete,
  showCategory = false,
}: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const closeMenu = () => setMenuOpen(false)
    document.addEventListener("pointerdown", closeMenu)
    return () => document.removeEventListener("pointerdown", closeMenu)
  }, [menuOpen])

  /**
   * IMPORTANT:
   *
   * Do NOT get `now` from the store here.
   *
   * The task store updates `now` every second, which would cause
   * every TaskCard using the context to render every second.
   */
  const {
    timer,
    startTask,
    holdTask,
    completeTask,
  } = useTaskStore()

  /**
   * Initial remaining time.
   *
   * For inactive cards this value doesn't continuously update.
   * Only the active card gets its own timer below.
   */
  const [now, setNow] = useState(() => Date.now())
  const [remaining, setRemaining] = useState(() =>
    remainingSeconds(task, timer, Date.now()),
  )

  // Keep progress current in 10% segments while a task is running.
  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  /**
   * Only the active task gets a 1-second timer.
   *
   * This means if you have:
   *
   * 100 cards
   *
   * only:
   *
   * 1 card -> updates every second
   * 99 cards -> don't have their own interval
   */
  useEffect(() => {
    if (!isActive) {
      setRemaining(
        remainingSeconds(task, timer, Date.now()),
      )

      if (!isTaskStartAllowed(task)) {
        const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(intervalId)
      }

      return
    }

    const updateRemaining = () => {
      const next = remainingSeconds(
        task,
        timer,
        Date.now(),
      )

      setRemaining(next)
    }

    // Update immediately.
    updateRemaining()

    // Update only this active card every second.
    const intervalId = window.setInterval(
      updateRemaining,
      1000,
    )

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    isActive,
    task.id,
    task.plannedDurationSeconds,
    task.actualDurationSeconds,
    timer.activeTaskId,
    timer.runningSince,
  ])

  const locked = isLocked(task.status)
  const normalizedStartDate = normalizeTimestamp(task.startDate)
  const startsAt = !isTaskStartAllowed(task, now)
  const canComplete = canCompleteTask(task, timer, now)

  /**
   * Only allow starting when there isn't another active task and the schedule is open.
   */
  const canResume =
    task.startedAt != null &&
    (task.status === "todo" || task.status === "on_hold")
  const canStart =
    !locked &&
    task.status !== "completed" &&
    !timer.activeTaskId &&
    !startsAt

  const handleStart = () => {
    if (locked || task.status === "completed" || startsAt) {
      return
    }

    startTask(task.id)
  }

  const handlePause = () => {
    if (!isActive) {
      return
    }

    holdTask(task.id)
  }

  const handleComplete = () => {
    if (locked) {
      return
    }

    completeTask(task.id)
  }

  const timeSpent = taskSpentSeconds(task, timer, now)
  const timeSpentLabel = formatRemaining(timeSpent)
  const deadlineLabel = task.deadlineDate
    ? new Date(task.deadlineDate).toLocaleDateString([], { month: "short", day: "numeric" })
    : "No deadline"
  const completionLabel = task.completedAt
    ? new Date(task.completedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : null
  const priorityMeta = PRIORITY_META[task.priority]
  const startLabel = normalizedStartDate
    ? new Date(normalizedStartDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null

  return (
    <article
      className={[
        "group",
        "border border-soft",
        "bg-card",
        "p-4",
        "transition-shadow",
        "hover:shadow-(--shadow-card)",
        isActive ? "ring-1 ring-primary/30" : "",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showCategory && (
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {task.category}
            </span>
          )}

          {locked ? (
            <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
          ) : (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="text-left text-sm font-semibold text-foreground transition-colors hover:text-primary"
            >
              {task.title}
            </button>
          )}

          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>

      {task.status !== "completed" && (
  <div
    className="relative shrink-0"
    onPointerDown={(e) => e.stopPropagation()}
  >
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        setMenuOpen((open) => !open)
      }}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      aria-label="Task actions"
      aria-expanded={menuOpen}
      aria-haspopup="menu"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>

    {menuOpen && (
      <div
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-0 top-9 z-50 w-40 overflow-hidden border border-soft bg-canvas p-1 shadow-xl"
      >
        <button
          type="button"
          role="menuitem"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(false)
            onEdit(task)
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-secondary transition-colors hover:bg-gray-tint hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil className="size-4" />
          Rename / edit
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(false)
            onDelete(task)
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-error transition-colors hover:bg-rose"
        >
          <Trash2 className="size-4" />
          Delete
        </button>
      </div>
    )}
  </div>
)}
      </div>

      {/* Important task data */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: priorityMeta.color, backgroundColor: priorityMeta.bg, borderColor: priorityMeta.color }}
        >
          {priorityMeta.label}
        </span>
        <span className="text-muted-foreground">Due {deadlineLabel}</span>
        {completionLabel && <span className="text-success">Completed {completionLabel}</span>}
      </div>
      {startsAt && <p className="mt-2 text-[11px] text-warning">Available {startLabel}</p>}

      {/* Time + Priority */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock3
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Time spent</span>

          <span
            className={[
              "font-mono",
              "text-xs",
              "tabular-nums",
              isActive
                ? "text-primary"
                : "text-muted-foreground",
            ].join(" ")}
          >
            {timeSpentLabel}
          </span>
        </div>

        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: priorityMeta.color, backgroundColor: priorityMeta.bg }}
        >
          {priorityMeta.label}
        </span>
      </div>

          {/* Progress */}
      {task.status !== "completed" && task.plannedDurationSeconds > 0 && (() => {
        const spent = taskSpentSeconds(task, timer, now)
        const progress = Math.min(100, Math.max(0, Math.floor((spent / task.plannedDurationSeconds) * 10) * 10))
        const completedSegments = progress / 10

        return (
         <div className="mt-4" aria-label={`${progress}% complete`}>
  

  <div className="flex w-full gap-1 overflow-hidden">
    {Array.from({ length: 10 }).map((_, index) => (
      <div
        key={index}
        className={`h-2 flex-1 origin-left skew-x-20 transition-colors duration-300 ${
          index < completedSegments ? "bg-primary" : "bg-muted"
        }`}
      />
    ))}
  </div>
</div>
        )
      })()}

      {/* Actions */}
      {task.status !== "completed" && (
        <div className="mt-4 flex items-center gap-2">
          {isActive ? (
            <button
              type="button"
              onClick={handlePause}
              aria-label="Pause task"
              title="Pause task"
              className="inline-flex size-8 items-center justify-center rounded-md border border-soft text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              aria-label={canResume ? "Resume task" : "Start task"}
              title={canResume ? "Resume task" : "Start task"}
              className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}

          {canComplete && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={locked}
              className="inline-flex items-center gap-1.5 rounded-md border border-soft px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              Complete
            </button>
          )}
        </div>
      )}
    </article>
  )
})
