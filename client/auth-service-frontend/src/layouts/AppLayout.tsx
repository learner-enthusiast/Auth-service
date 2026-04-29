import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-4">
        <div className="font-semibold">Auth Service</div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-64 border-r border-border bg-sidebar text-sidebar-foreground p-4">
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2 py-1 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                )
              }
            >
              Home
            </NavLink>
          </nav>
        </aside>

        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
