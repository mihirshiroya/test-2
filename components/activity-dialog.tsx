"use client"

import { useEffect, useRef, useState } from "react"
import { AlarmClock } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { formatDuration } from "@/lib/task-timer"

export function ActivityDialog() {
  const {
    timer,
    tasks,
    confirmActive,
    holdTask,
  } = useTaskStore()

  const primaryRef =
    useRef<HTMLButtonElement>(null)

  const [now, setNow] = useState(() => Date.now())

  const open =
    timer.phase === "checking" &&
    !!timer.activeTaskId

  const task = tasks.find(
    (t) => t.id === timer.activeTaskId,
  )

  /*
   * Local countdown clock.
   */
  useEffect(() => {
    if (!open) {
      return
    }

    setNow(Date.now())

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [open])

  /*
   * Focus primary action.
   */
  useEffect(() => {
    if (open) {
      primaryRef.current?.focus()
    }
  }, [open])

  if (!open || !task) {
    return null
  }

  const remainingMs =
    timer.checkDeadline != null
      ? Math.max(
          0,
          timer.checkDeadline - now,
        )
      : 0

  const remainingSec = Math.ceil(
    remainingMs / 1000,
  )

  /*
   * Circular countdown.
   *
   * Assumes the check-in duration is 60 seconds.
   * If your store uses another duration, replace 60
   * with the actual check-in duration.
   */
  const totalSeconds = 60

  const progress = Math.min(
    100,
    Math.max(
      0,
      (remainingSec / totalSeconds) * 100,
    ),
  )

  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset =
    circumference -
    (progress / 100) * circumference

  const isUrgent = remainingSec <= 10

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-foreground/35 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
      aria-describedby="checkin-desc"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        {/* ============================================================ */}
        {/* HEADER                                                        */}
        {/* ============================================================ */}

        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-soft">
              <AlarmClock
                size={15}
                className="text-primary"
                aria-hidden="true"
              />
            </div>

            <span className="text-sm font-semibold text-foreground">
              Focus Check-in
            </span>
          </div>

          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-warning">
            Check-in
          </span>
        </div>

        {/* ============================================================ */}
        {/* CONTENT                                                       */}
        {/* ============================================================ */}

        <div className="flex flex-col items-center px-5 py-5">
          {/* Task */}
          <span className="mb-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {task.category === "notes"
              ? "Notes"
              : "Projects"}
          </span>

          <h2
            id="checkin-title"
            className="max-w-[90%] truncate text-center text-sm font-semibold text-foreground"
            title={task.title}
          >
            {task.title}
          </h2>

          {/* Description */}
          <p
            id="checkin-desc"
            className="mt-1.5 max-w-[280px] text-center text-[11px] leading-4 text-muted-foreground"
          >
            Are you still working on this task?
            Confirm to keep the timer running.
          </p>

          {/* ======================================================== */}
          {/* COUNTDOWN                                                 */}
          {/* ======================================================== */}

          <div className="relative my-4 size-[108px]">
            <svg
              viewBox="0 0 100 100"
              className="size-full -rotate-90"
              aria-hidden="true"
            >
              {/* Background */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-muted"
              />

              {/* Progress */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className={
                  isUrgent
                    ? "text-destructive"
                    : "text-primary"
                }
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{
                  transition:
                    "stroke-dashoffset 500ms linear",
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                Confirm
              </span>

              <span
                className={`mt-1 font-mono text-xl font-semibold leading-none tabular-nums ${
                  isUrgent
                    ? "text-destructive"
                    : "text-foreground"
                }`}
                role="timer"
                aria-live="polite"
                aria-label={`${remainingSec} seconds to confirm`}
              >
                {formatDuration(
                  remainingMs / 1000,
                )}
              </span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* ACTIONS                                                    */}
          {/* ======================================================== */}

          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                holdTask(task.id)
              }
              className="flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Pause it
            </button>

            <button
              ref={primaryRef}
              type="button"
              onClick={confirmActive}
              className="flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Yes, continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}