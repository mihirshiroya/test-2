"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  CHECK_INTERVAL_MS,
  RESPONSE_WINDOW_MS,
  generateId,
  canCompleteTask,
  isLocked,
  isTaskStartAllowed,
  remainingSeconds,
    spentSeconds,
  type Task,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
  type TimerState,
} from "./task-timer"

const STORAGE_KEY = "kanban-timer:v2"

interface PersistShape {
  tasks: Task[]
  timer: TimerState
}

const IDLE_TIMER: TimerState = {
  activeTaskId: null,
  runningSince: null,
  checkAt: null,
  checkDeadline: null,
  phase: "running",
}

/* -------------------------------------------------------------------------- */
/* Seed Tasks                                                                 */
/* -------------------------------------------------------------------------- */

function seedTasks(): Task[] {
  const now = Date.now()

  // Helpers for seed dates
  const minutesFromNow = (minutes: number) =>
    now + minutes * 60 * 1000

  const hoursFromNow = (hours: number) =>
    now + hours * 60 * 60 * 1000

  const daysFromNow = (days: number) =>
    now + days * 24 * 60 * 60 * 1000

  const base = (
    over: Partial<Task> &
      Pick<
        Task,
        "id" | "title" | "status" | "position" | "category"
      >,
  ): Task => ({
    description: "",
    priority: "medium",

    // Required date fields
    startDate: null,
    deadlineDate: null,

    plannedDurationSeconds: 25 * 60,
    actualDurationSeconds: 0,

    startedAt: null,
    completedAt: null,
    createdAt: now,

    ...over,
  })

  return [
    // -----------------------------------------------------------------------
    // Notes
    // -----------------------------------------------------------------------

    base({
      id: generateId(),
      category: "notes",
      title: "Draft weekly retro notes",
      description:
        "Summarize wins, blockers and next steps.",
      status: "todo",
      position: 0,
      priority: "high",
      plannedDurationSeconds: 3 * 60,
      startDate: now,
      deadlineDate: hoursFromNow(2),
    }),

    base({
      id: generateId(),
      category: "notes",
      title: "Clean up meeting notes",
      description:
        "Tag action items and archive the rest.",
      status: "on_hold",
      position: 1,
      priority: "medium",
      plannedDurationSeconds: 15 * 60,
      startDate: minutesFromNow(30),
      deadlineDate: hoursFromNow(3),
    }),

    base({
      id: generateId(),
      category: "notes",
      title: "Outline blog post",
      status: "completed",
      position: 2,
      priority: "low",
      plannedDurationSeconds: 20 * 60,
      actualDurationSeconds: 18 * 60,
      startDate: now - 2 * 60 * 60 * 1000,
      deadlineDate: now - 60 * 60 * 1000,
      completedAt: now - 60 * 60 * 1000,
    }),

    // -----------------------------------------------------------------------
    // Projects
    // -----------------------------------------------------------------------

    base({
      id: generateId(),
      category: "projects",
      title: "Design the landing hero",
      description:
        "Explore two directions and pick one to refine.",
      status: "todo",
      position: 0,
      priority: "high",
      plannedDurationSeconds: 45 * 60,
      startDate: now,
      deadlineDate: hoursFromNow(4),
    }),

    base({
      id: generateId(),
      category: "projects",
      title: "Fix auth redirect bug",
      description:
        "Session drops on hard refresh.",
      status: "on_hold",
      position: 1,
      priority: "urgent",
      plannedDurationSeconds: 10 * 60,
      startDate: minutesFromNow(15),
      deadlineDate: hoursFromNow(2),
    }),

    base({
      id: generateId(),
      category: "projects",
      title: "Set up CI pipeline",
      status: "completed",
      position: 2,
      priority: "low",
      plannedDurationSeconds: 40 * 60,
      actualDurationSeconds: 37 * 60,
      startDate: now - 4 * 60 * 60 * 1000,
      deadlineDate: now - 2 * 60 * 60 * 1000,
      completedAt: now - 2 * 60 * 60 * 1000,
    }),

    // -----------------------------------------------------------------------
    // Projects 1
    // -----------------------------------------------------------------------

    base({
      id: generateId(),
      category: "projects 1",
      title: "Design the landing hero",
      description:
        "Explore two directions and pick one to refine.",
      status: "todo",
      position: 0,
      priority: "high",
      plannedDurationSeconds: 45 * 60,
      startDate: now,
      deadlineDate: hoursFromNow(5),
    }),

    base({
      id: generateId(),
      category: "projects 1",
      title: "Fix auth redirect bug",
      description:
        "Session drops on hard refresh.",
      status: "on_hold",
      position: 1,
      priority: "urgent",
      plannedDurationSeconds: 10 * 60,
      startDate: minutesFromNow(45),
      deadlineDate: hoursFromNow(3),
    }),

    base({
      id: generateId(),
      category: "notes",
      title: "Plan quarterly research",
      description: "Collect topics and assign owners for next quarter.",
      status: "todo",
      position: 3,
      priority: "medium",
      startDate: daysFromNow(-14),
      deadlineDate: daysFromNow(3),
    }),

    base({
      id: generateId(),
      category: "projects",
      title: "Review release checklist",
      description: "Validate deployment, QA, and documentation steps.",
      status: "on_hold",
      position: 3,
      priority: "high",
      startDate: daysFromNow(-35),
      deadlineDate: daysFromNow(-2),
    }),

    base({
      id: generateId(),
      category: "notes",
      title: "Archive old research notes",
      description: "Close out a completed research thread.",
      status: "completed",
      position: 4,
      priority: "low",
      plannedDurationSeconds: 30 * 60,
      actualDurationSeconds: 28 * 60,
      startDate: daysFromNow(-9),
      deadlineDate: daysFromNow(-8),
      completedAt: daysFromNow(-8),
    }),

    base({
      id: generateId(),
      category: "projects",
      title: "Document API changes",
      description: "Publish the latest endpoint notes.",
      status: "completed",
      position: 4,
      priority: "medium",
      plannedDurationSeconds: 35 * 60,
      actualDurationSeconds: 32 * 60,
      startDate: daysFromNow(-22),
      deadlineDate: daysFromNow(-20),
      completedAt: daysFromNow(-20),
    }),

    base({
      id: generateId(),
      category: "projects 1",
      title: "Set up CI pipeline",
      status: "completed",
      position: 2,
      priority: "low",
      plannedDurationSeconds: 40 * 60,
      actualDurationSeconds: 37 * 60,
      startDate: now - 5 * 60 * 60 * 1000,
      deadlineDate: now - 3 * 60 * 60 * 1000,
      completedAt: now - 3 * 60 * 60 * 1000,
    }),
  ]
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

interface TaskStore {
  tasks: Task[]
  timer: TimerState

  addTask: (input: {
    title: string
    description: string
    priority: TaskPriority
    plannedDurationSeconds: number
    status: TaskStatus
    category: TaskCategory
    startDate: number | null
    deadlineDate: number | null
  }) => void

  updateTask: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "description"
        | "category"
        | "status"
        | "priority"
        | "plannedDurationSeconds"
        | "startDate"
        | "deadlineDate"
      >
    >,
  ) => void

  deleteTask: (id: string) => void

  moveTask: (
    id: string,
    to: TaskStatus,
    index: number,
  ) => boolean

  startTask: (id: string) => boolean
  holdTask: (id: string) => void
  completeTask: (id: string) => void
  confirmActive: () => void

  hasActiveTask: boolean
}

const Ctx = createContext<TaskStore | null>(null)

export function useTaskStore(): TaskStore {
  const ctx = useContext(Ctx)

  if (!ctx) {
    throw new Error(
      "useTaskStore must be used within TaskStoreProvider",
    )
  }

  return ctx
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function TaskStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [timer, setTimer] =
    useState<TimerState>(IDLE_TIMER)

  /*
   * IMPORTANT:
   *
   * `now` is intentionally NOT exposed through the context.
   *
   * It is only used internally by the timer engine.
   */
  const [now, setNow] = useState(() => Date.now())

  const [hydrated, setHydrated] =
    useState(false)

  const tasksRef = useRef(tasks)
  const timerRef = useRef(timer)

  tasksRef.current = tasks
  timerRef.current = timer

  /* ------------------------------------------------------------------------ */
  /* Hydrate                                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY)

      if (raw) {
        const parsed =
          JSON.parse(raw) as PersistShape

        if (Array.isArray(parsed.tasks)) {
          setTasks(parsed.tasks)
          setTimer(
            parsed.timer ?? IDLE_TIMER,
          )
          setHydrated(true)
          return
        }
      }
    } catch {
      // Ignore invalid localStorage.
    }

    setTasks(seedTasks())
    setHydrated(true)
  }, [])

  /* ------------------------------------------------------------------------ */
  /* Persist                                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!hydrated) return

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tasks,
          timer,
        }),
      )
    } catch {
      // Ignore storage errors.
    }
  }, [tasks, timer, hydrated])

  /* ------------------------------------------------------------------------ */
  /* Internal clock                                                           */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!timer.activeTaskId) {
      return
    }

    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(id)
    }
  }, [timer.activeTaskId])

  /* ------------------------------------------------------------------------ */
  /* Commit active timer                                                      */
  /* ------------------------------------------------------------------------ */

  const commitActive = useCallback(
    (at: number) => {
      const currentTimer =
        timerRef.current

      if (
        !currentTimer.activeTaskId ||
        currentTimer.runningSince == null
      ) {
        return
      }

      const activeId =
        currentTimer.activeTaskId

      const elapsed = Math.max(
        0,
        Math.floor(
          (at -
            currentTimer.runningSince) /
            1000,
        ),
      )

      if (elapsed <= 0) {
        return
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === activeId
            ? {
                ...task,
                actualDurationSeconds:
                  task.actualDurationSeconds +
                  elapsed,
              }
            : task,
        ),
      )
    },
    [],
  )

  /* ------------------------------------------------------------------------ */
  /* Check-in / timeout                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!timer.activeTaskId) {
      return
    }

    const evaluate = () => {
      const currentTimer =
        timerRef.current

      const at = Date.now()

      if (!currentTimer.activeTaskId) {
        return
      }

      /*
       * Check-in reached.
       */
      if (
        currentTimer.phase === "running" &&
        currentTimer.checkAt != null &&
        at >= currentTimer.checkAt
      ) {
        setTimer((previous) => ({
          ...previous,
          phase: "checking",
          checkDeadline:
            at + RESPONSE_WINDOW_MS,
        }))

        return
      }

      /*
       * Check-in timed out.
       */
      if (
        currentTimer.phase === "checking" &&
        currentTimer.checkDeadline != null &&
        at >=
          currentTimer.checkDeadline
      ) {
        commitActive(at)

        const activeId =
          currentTimer.activeTaskId

        setTasks((prev) =>
          prev.map((task) =>
            task.id === activeId
              ? {
                  ...task,
                  status: "on_hold",
                }
              : task,
          ),
        )

        setTimer(IDLE_TIMER)
      }
    }

    const id = window.setInterval(
      evaluate,
      500,
    )

    return () => {
      window.clearInterval(id)
    }
  }, [
    timer.activeTaskId,
    commitActive,
  ])

  /* ------------------------------------------------------------------------ */
  /* Auto complete                                                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!timer.activeTaskId) {
      return
    }

    const checkCompletion = () => {
      const currentTimer =
        timerRef.current

      if (!currentTimer.activeTaskId) {
        return
      }

      const activeId =
        currentTimer.activeTaskId

      const task =
        tasksRef.current.find(
          (item) => item.id === activeId,
        )

      if (!task) {
        return
      }

      const currentTime = Date.now()

      const remaining =
        remainingSeconds(
          task,
          currentTimer,
          currentTime,
        )

      if (remaining > 0) {
        return
      }

      commitActive(currentTime)

      setTasks((prev) =>
        prev.map((item) =>
          item.id === activeId
            ? {
                ...item,
                status: "completed",
                completedAt: currentTime,
                actualDurationSeconds:
                  Math.max(
                    item.actualDurationSeconds,
                    item.plannedDurationSeconds,
                  ),
              }
            : item,
        ),
      )

      setTimer(IDLE_TIMER)
    }

    const id = window.setInterval(
      checkCompletion,
      500,
    )

    return () => {
      window.clearInterval(id)
    }
  }, [
    timer.activeTaskId,
    commitActive,
  ])

  /* ------------------------------------------------------------------------ */
  /* Add task                                                                 */
  /* ------------------------------------------------------------------------ */

  const addTask: TaskStore["addTask"] =
    useCallback((input) => {
      setTasks((prev) => {
        const inColumn =
          prev.filter(
            (task) =>
              task.status ===
                input.status &&
              task.category ===
                input.category,
          ).length

        const task: Task = {
         id: generateId(),
  category: input.category,
  title: input.title,
  description: input.description,
  status: input.status,
  priority: input.priority,
  position: inColumn,

  startDate: input.startDate ?? null,
  deadlineDate: input.deadlineDate ?? null,

  plannedDurationSeconds: input.plannedDurationSeconds,
  actualDurationSeconds: 0,

  startedAt: null,
  completedAt: null,
  createdAt: Date.now(),
        }

        return [...prev, task]
      })
    }, [])

  /* ------------------------------------------------------------------------ */
  /* Update task                                                               */
  /* ------------------------------------------------------------------------ */

  const updateTask: TaskStore["updateTask"] =
    useCallback((id, patch) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === id
            ? {
                ...task,
                ...patch,
              }
            : task,
        ),
      )
    }, [])

  /* ------------------------------------------------------------------------ */
  /* Delete task                                                               */
  /* ------------------------------------------------------------------------ */

  const deleteTask: TaskStore["deleteTask"] =
    useCallback((id) => {
      if (
        timerRef.current.activeTaskId ===
        id
      ) {
        setTimer(IDLE_TIMER)
      }

      setTasks((prev) =>
        prev.filter(
          (task) => task.id !== id,
        ),
      )
    }, [])

  /* ------------------------------------------------------------------------ */
  /* Start timer                                                               */
  /* ------------------------------------------------------------------------ */

  const startTimerFor = useCallback(
    (id: string, at: number) => {
      setTimer({
        activeTaskId: id,
        runningSince: at,
        checkAt:
          at + CHECK_INTERVAL_MS,
        checkDeadline: null,
        phase: "running",
      })
    },
    [],
  )

  /* ------------------------------------------------------------------------ */
  /* Move task                                                                 */
  /* ------------------------------------------------------------------------ */

  const moveTask: TaskStore["moveTask"] =
    useCallback(
      (id, to, index) => {
        const all =
          tasksRef.current

        const task = all.find(
          (item) => item.id === id,
        )

        if (!task) {
          return false
        }

        if (to === "in_progress" && !isTaskStartAllowed(task)) {
          return false
        }

        if (to === "completed" && !canCompleteTask(task, timerRef.current)) {
          return false
        }

        /*
         * Locked tasks cannot move.
         */
        if (isLocked(task.status)) {
          return false
        }

        /*
         * Only one task can be in progress.
         */
        if (
          to === "in_progress" &&
          task.status !== "in_progress" &&
          all.some(
            (item) =>
              item.status ===
              "in_progress",
          )
        ) {
          return false
        }

        const at = Date.now()

        const wasActive =
          timerRef.current
            .activeTaskId === id

        /*
         * Leaving in-progress.
         */
        if (
          task.status ===
            "in_progress" &&
          to !== "in_progress" &&
          wasActive
        ) {
          commitActive(at)
          setTimer(IDLE_TIMER)
        }

        setTasks((prev) => {
          const moving = prev.find(
            (item) => item.id === id,
          )

          if (!moving) {
            return prev
          }

          const patch: Partial<Task> = {
            status: to,
          }

          if (
            to === "in_progress" &&
            moving.status !==
              "in_progress"
          ) {
            patch.startedAt =
              moving.startedAt ??
              at
          }

          if (to === "completed") {
            patch.completedAt = at
          }

          const updated = prev.map(
            (item) =>
              item.id === id
                ? {
                    ...item,
                    ...patch,
                  }
                : item,
          )

          const destination =
            updated
              .filter(
                (item) =>
                  item.status === to &&
                  item.category ===
                    moving.category &&
                  item.id !== id,
              )
              .sort(
                (a, b) =>
                  a.position -
                  b.position,
              )

          const movedTask =
            updated.find(
              (item) => item.id === id,
            )!

          destination.splice(
            Math.min(
              index,
              destination.length,
            ),
            0,
            movedTask,
          )

          const reindexed =
            destination.map(
              (item, position) => ({
                ...item,
                position,
              }),
            )

          const byId = new Map(
            reindexed.map((item) => [
              item.id,
              item,
            ]),
          )

          return updated.map(
            (item) =>
              byId.get(item.id) ??
              item,
          )
        })

        /*
         * Entering in-progress.
         */
        if (
          to === "in_progress" &&
          !wasActive
        ) {
          startTimerFor(id, at)
        }

        return true
      },
      [
        commitActive,
        startTimerFor,
      ],
    )

  /* ------------------------------------------------------------------------ */
  /* Start task                                                                */
  /* ------------------------------------------------------------------------ */

  const startTask: TaskStore["startTask"] =
    useCallback(
      (id) => {
        const all =
          tasksRef.current

        const task = all.find(
          (item) => item.id === id,
        )

        if (
          !task ||
          isLocked(task.status)
        ) {
          return false
        }

        /*
         * Another task already running.
         */
        if (
          all.some(
            (item) =>
              item.status ===
                "in_progress" &&
              item.id !== id,
          )
        ) {
          return false
        }

        const nextPosition =
          all.filter(
            (item) =>
              item.status ===
                "in_progress" &&
              item.category ===
                task.category,
          ).length

        const at = Date.now()

        if (!isTaskStartAllowed(task, at)) {
          return false
        }

        setTasks((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status:
                    "in_progress",
                  position:
                    nextPosition,
                  startedAt:
                    item.startedAt ??
                    at,
                }
              : item,
          ),
        )

        startTimerFor(id, at)

        return true
      },
      [startTimerFor],
    )

  /* ------------------------------------------------------------------------ */
  /* Hold task                                                                 */
  /* ------------------------------------------------------------------------ */

  const holdTask: TaskStore["holdTask"] =
    useCallback(
      (id) => {
        const at = Date.now()

        if (
          timerRef.current
            .activeTaskId === id
        ) {
          commitActive(at)
          setTimer(IDLE_TIMER)
        }

        setTasks((prev) =>
          prev.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "on_hold",
                }
              : task,
          ),
        )
      },
      [commitActive],
    )

  /* ------------------------------------------------------------------------ */
  /* Complete task                                                             */
  /* ------------------------------------------------------------------------ */

  const completeTask: TaskStore["completeTask"] =
    useCallback(
      (id) => {
        const at = Date.now()

        if (
          timerRef.current
            .activeTaskId === id
        ) {
          commitActive(at)
          setTimer(IDLE_TIMER)
        }

        setTasks((prev) =>
          prev.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "completed",
                  completedAt: at,
                }
              : task,
          ),
        )
      },
      [commitActive],
    )

  /* ------------------------------------------------------------------------ */
  /* Confirm active                                                            */
  /* ------------------------------------------------------------------------ */

  const confirmActive:
    TaskStore["confirmActive"] =
    useCallback(() => {
      const at = Date.now()

      setTimer((previous) =>
        previous.activeTaskId
          ? {
              ...previous,
              phase: "running",
              checkAt:
                at + CHECK_INTERVAL_MS,
              checkDeadline: null,
            }
          : previous,
      )
    }, [])

  /* ------------------------------------------------------------------------ */
  /* Context value                                                             */
  /* ------------------------------------------------------------------------ */

  const value = useMemo<TaskStore>(
    () => ({
      tasks,
      timer,
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      startTask,
      holdTask,
      completeTask,
      confirmActive,
      hasActiveTask:
        !!timer.activeTaskId,
    }),
    [
      tasks,
      timer,
      addTask,
      updateTask,
      deleteTask,
      moveTask,
      startTask,
      holdTask,
      completeTask,
      confirmActive,
    ],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/* Active Task Selector                                                       */
/* -------------------------------------------------------------------------- */

export function useActiveTask(): {
  task: Task | null
  remaining: number
  spent: number
} {
  const { tasks, timer } = useTaskStore()

  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!timer.activeTaskId) {
      return
    }

    // Update immediately when task starts/changes.
    setNow(Date.now())

    // Only TimerWidget gets this 1-second clock.
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [timer.activeTaskId])

  const task =
    tasks.find(
      (item) => item.id === timer.activeTaskId,
    ) ?? null

  if (!task) {
    return {
      task: null,
      remaining: 0,
      spent: 0,
    }
  }

  return {
    task,
    remaining: remainingSeconds(
      task,
      timer,
      now,
    ),
    spent: spentSeconds(
      task,
      timer,
      now,
    ),
  }
}
