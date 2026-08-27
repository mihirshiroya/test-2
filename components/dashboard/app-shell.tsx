"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  StickyNote,
  FolderKanban,
  Columns3,
  Menu,
  X,
  Timer,
} from "lucide-react"
import { TimerWidget } from "@/components/timer/timer-widget"

const NAV = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Notes", href: "/notes", icon: StickyNote },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Kanban", href: "/kanban", icon: Columns3 },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const current = NAV.find((n) => isActive(n.href))?.label ?? "Overview"

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-sidebar transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Timer size={18} aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight">FocusBoard</span>
          </Link>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setMobileOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Main navigation">
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground text-pretty">
            Only one task runs at a time across Notes and Projects. Drag a card
            into <span className="font-medium text-foreground">In Progress</span> to start its countdown.
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-20 bg-foreground/40 md:hidden"
        />
      )}

      {/* Main */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base font-semibold text-foreground">{current}</h1>
          </div>
          <TimerWidget />
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
