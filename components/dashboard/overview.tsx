"use client"

import Link from "next/link"
import {
  StickyNote,
  FolderKanban,
  CheckCircle2,
  PauseCircle,
  ListTodo,
  Timer,
  ArrowRight,
  Play,
} from "lucide-react"
import { useActiveTask, useTaskStore } from "@/lib/task-store"
import {
  CATEGORY_META,
  STATUS_META,
  formatDuration,
  remainingSeconds,
  spentSeconds,
  type Task,
  type TaskCategory,
} from "@/lib/task-timer"

function countBy(tasks: Task[], status: Task["status"]) {
  return tasks.filter((t) => t.status === status).length
}

export function Overview() {
  const { tasks, timer, now, startTask, hasActiveTask } = useTaskStore()
  const { task: active, remaining, spent } = useActiveTask()

  const notes = tasks.filter((t) => t.category === "notes")
  const projects = tasks.filter((t) => t.category === "projects")

  const totalPlanned = tasks.reduce((a, t) => a + t.plannedDurationSeconds, 0)
  const totalSpent = tasks.reduce((a, t) => a + spentSeconds(t, timer, now), 0)

  const stats = [
    {
      label: "To Do",
      value: countBy(tasks, "todo"),
      icon: ListTodo,
      color: "var(--color-muted-foreground)",
      bg: "var(--color-muted)",
    },
    {
      label: "In Progress",
      value: countBy(tasks, "in_progress"),
      icon: Timer,
      color: "var(--color-primary)",
      bg: "var(--color-primary-soft)",
    },
    {
      label: "On Hold",
      value: countBy(tasks, "on_hold"),
      icon: PauseCircle,
      color: "var(--color-warning)",
      bg: "var(--color-warning-soft)",
    },
    {
      label: "Completed",
      value: countBy(tasks, "completed"),
      icon: CheckCircle2,
      color: "var(--color-success)",
      bg: "var(--color-success-soft)",
    },
  ]

  const activePct =
    active && active.plannedDurationSeconds > 0
      ? Math.min(100, Math.round((spent / active.plannedDurationSeconds) * 100))
      : 0

  const upNext = tasks
    .filter((t) => t.status === "on_hold" || t.status === "todo")
    .sort((a, b) => {
      const rank = { on_hold: 0, todo: 1 } as Record<string, number>
      return (rank[a.status] ?? 2) - (rank[b.status] ?? 2)
    })
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          Overview
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Your Notes and Projects at a glance. One focus timer runs across the
          whole workspace.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5"
          >
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: bg, color }}
            >
              <Icon size={20} aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {value}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active focus */}
        <div className="lg:col-span-2">
          <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Current focus</h3>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                {hasActiveTask ? "Running" : "Idle"}
              </span>
            </div>

            {active ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_META[active.category].label}
                    </span>
                    <p className="truncate text-lg font-medium text-foreground">
                      {active.title}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-3xl font-semibold tabular-nums ${
                      remaining <= 0 ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {formatDuration(remaining)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${activePct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(spent)} spent of{" "}
                  {formatDuration(active.plannedDurationSeconds)} planned
                </p>
                <Link
                  href={`/${active.category}`}
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Go to {CATEGORY_META[active.category].label} board
                  <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-muted/50 p-8 text-center">
                <Timer className="text-muted-foreground" size={28} aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted-foreground text-pretty">
                  Nothing is running. Start a task below or from any board to
                  begin a focus countdown.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Time summary */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold text-foreground">Time tracked</h3>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {formatDuration(totalSpent)}
            </span>
            <span className="text-xs text-muted-foreground">
              of {formatDuration(totalPlanned)} planned
            </span>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <CategoryRow category="notes" tasks={notes} icon={StickyNote} />
            <CategoryRow category="projects" tasks={projects} icon={FolderKanban} />
          </div>
        </div>
      </div>

      {/* Up next */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Up next</h3>
          <Link
            href="/kanban"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Open Kanban <ArrowRight size={15} />
          </Link>
        </div>
        {upNext.length === 0 ? (
          <p className="text-sm text-muted-foreground">You&rsquo;re all caught up.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {upNext.map((t) => {
              const rem = remainingSeconds(t, timer, now)
              const meta = STATUS_META[t.status]
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.accent }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_META[t.category].label} · {meta.title} ·{" "}
                        <span className="tabular-nums">{formatDuration(rem)} left</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTask(t.id)}
                    disabled={hasActiveTask}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      hasActiveTask
                        ? "Finish or pause the current task first"
                        : "Start this task"
                    }
                  >
                    <Play size={13} /> Start
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  tasks,
  icon: Icon,
}: {
  category: TaskCategory
  tasks: Task[]
  icon: typeof StickyNote
}) {
  const done = tasks.filter((t) => t.status === "completed").length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
  return (
    <Link
      href={`/${category}`}
      className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {CATEGORY_META[category].label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{tasks.length}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
