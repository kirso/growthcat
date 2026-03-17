"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/onboarding", label: "Onboarding", icon: "🚀" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/panel", label: "Panel Console", icon: "🎙️" },
  { href: "/pipeline", label: "Content Pipeline", icon: "📝" },
  { href: "/community", label: "Community", icon: "👥" },
  { href: "/experiments", label: "Experiments", icon: "🧪" },
  { href: "/feedback", label: "Feedback", icon: "💬" },
  { href: "/report", label: "Weekly Report", icon: "📈" },
];

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--color-op-bg)] text-[var(--color-op-text)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col
          bg-[var(--color-op-card)] border-r border-[var(--color-op-border)]
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Branding */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-op-border)]">
          <span className="text-xl">🐱</span>
          <span className="font-semibold text-[var(--color-op-text)] tracking-tight">
            GrowthCat Operator
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                  ${
                    isActive
                      ? "border-l-2 border-[var(--color-op-green)] text-[var(--color-op-text)] bg-[var(--color-op-card-alt)]"
                      : "border-l-2 border-transparent text-[var(--color-op-muted)] hover:text-[var(--color-op-text)] hover:bg-[var(--color-op-card-alt)]"
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-op-border)] text-xs text-[var(--color-op-dim)]">
          v0.1.0 &middot; Week 1
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-op-border)] bg-[var(--color-op-card)] lg:px-6">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-1.5 rounded text-[var(--color-op-muted)] hover:text-[var(--color-op-text)] hover:bg-[var(--color-op-card-alt)]"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-lg">🐱</span>
            <span className="font-semibold text-sm">GrowthCat</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 text-xs text-[var(--color-op-dim)]">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-op-green)]" />
            System Online
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
