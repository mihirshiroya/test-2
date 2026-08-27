// ---------------------------------------------------------------------------
// Shared types, constants and helpers for the Kanban + countdown timer system.
// Frontend-only model mirroring the `tasks` / `task_time_entries` schema.
//
// A task belongs to a `category` ("notes" | "projects"). The Notes and Projects
// boards each show a single category, while the merged Kanban board shows both.
// The timer is global: only ONE task may be active at a time across every
// category, so a running Notes task blocks a Project task and vice versa.
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "on_hold"
  | "completed"

export type TaskPriority = "low" | "medium" | "high" | "urgent"

/** Which board a task lives on. */
export type TaskCategory = string

/** Mirrors the `tasks` table (frontend representation). */
export function normalizeTimestamp(value: unknown): number | null {
  if (value == null || value === "") return null

  if (typeof value === "string") {
    // Date-only values must be local dates; Date.parse("YYYY-MM-DD") is UTC
    // and can move the task to the previous day in western time zones.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
    if (dateOnly) {
      const localDate = new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
      if (!Number.isNaN(localDate.getTime())) return localDate.getTime()
    }
    const parsedDate = Date.parse(value)
    if (Number.isFinite(parsedDate) && parsedDate > 0) return parsedDate
  }

  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
}

export function isTaskStartAllowed(task: Pick<Task, "startDate">, now = Date.now()) {
  const startDate = normalizeTimestamp(task.startDate)
  return startDate == null || now >= startDate
}

export function taskSpentSeconds(task: Task, timer: TimerState, now = Date.now()) {
  return spentSeconds(task, timer, now)
}

export function canCompleteTask(task: Task, timer: TimerState, now = Date.now()) {
  if (task.plannedDurationSeconds <= 0) return true
  return taskSpentSeconds(task, timer, now) >= task.plannedDurationSeconds * 0.75
}

export interface Task {
  id: string
  /** The board this task belongs to. */
  category: TaskCategory
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  position: number
    /** Date/time when the task is scheduled to start. */
  startDate: number | null

  /** Date/time by which the task should be completed. */
  deadlineDate: number | null
  /** Time the user is expected to spend (drives the countdown). */
  plannedDurationSeconds: number
  /** Cached total of committed time entries. */
  actualDurationSeconds: number
  startedAt: number | null
  completedAt: number | null
  createdAt: number
}

/** Mirrors the `task_time_entries` table. */
export interface TimeEntry {
  id: string
  taskId: string
  startedAt: number
  endedAt: number | null
  durationSeconds: number | null
}

/** Transient phase of the single active (in-progress) task. */
export type TimerPhase = "running" | "checking"

export interface TimerState {
  /** The one task allowed to be in progress at a time. */
  activeTaskId: string | null
  /** Timestamp when the current running segment began. */
  runningSince: number | null
  /** When we should prompt the "still working?" check-in. */
  checkAt: number | null
  /** Deadline to answer the check-in before we time out. */
  checkDeadline: number | null
  phase: TimerPhase
}

// How often we prompt "still working?", and how long the user has to answer.
export const CHECK_INTERVAL_MS = 2 * 60 * 1000
export const RESPONSE_WINDOW_MS = 30 * 1000

export const CATEGORY_META: Record<
  TaskCategory,
  { label: string; singular: string }
> = {
  notes: { label: "Notes", singular: "Note" },
  projects: { label: "Projects", singular: "Project" },
  "projects 1": { label: "Projects 1", singular: "Project 1" },
}

export const STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "on_hold",
  "completed",
]

export const STATUS_META: Record<
  TaskStatus,
  { title: string; accent: string; tint: string }
> = {
  todo: { title: "To Do", accent: "var(--color-muted-foreground)", tint: "var(--color-muted)" },
  in_progress: { title: "In Progress", accent: "var(--color-primary)", tint: "var(--color-primary-soft)" },
  on_hold: { title: "On Hold", accent: "var(--color-warning)", tint: "var(--color-warning-soft)" },
  completed: { title: "Completed", accent: "var(--color-success)", tint: "var(--color-success-soft)" },
}

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Low", color: "var(--color-success)", bg: "var(--color-success-soft)" },
  medium: { label: "Medium", color: "var(--color-primary)", bg: "var(--color-primary-soft)" },
  high: { label: "High", color: "var(--color-warning)", bg: "var(--color-warning-soft)" },
  urgent: { label: "Urgent", color: "var(--color-destructive)", bg: "var(--color-warning-soft)" },
}

/** A completed / cancelled task is locked and cannot be dragged. */
export function isLocked(status: TaskStatus): boolean {
  return status === "completed"
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

/** Format seconds as HH:MM:SS (or MM:SS when under an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Seconds already spent on a task, including the live running segment. */
export function spentSeconds(
  task: Task,
  timer: TimerState,
  now: number,
): number {
  const base = task.actualDurationSeconds
  if (timer.activeTaskId === task.id && timer.runningSince != null) {
    return base + Math.max(0, Math.floor((now - timer.runningSince) / 1000))
  }
  return base
}

/** Remaining countdown seconds for a task (clamped at 0). */
export function remainingSeconds(
  task: Task,
  timer: TimerState,
  now: number,
): number {
  return Math.max(0, task.plannedDurationSeconds - spentSeconds(task, timer, now))
}
