import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { auth } from "@/backendRoutes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/state/auth/AuthContext";
import { useState } from "react";

export function AppLayout() {
  const navigate = useNavigate();
  const { refreshFromCookies } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await auth.logout();
    } finally {
      // Proactively clear readable cookies (backend also clears cookies)
      document.cookie = "accessToken=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = "refreshToken=; Path=/; Max-Age=0; SameSite=Lax";

      refreshFromCookies();
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  }
  return (
    <div className="min-h-screen bg-linear-to-br from-black via-zinc-950 to-red-950 text-white">
      <header className="relative h-14 flex items-center justify-between gap-3 px-4 bg-black border-b border-red-900/60 text-white">
        <div className="font-semibold text-red-500">Auth Service</div>

        <Button
          variant="ghost"
          className="border border-red-900/40 bg-black/40 text-zinc-200 hover:bg-red-900/30 hover:text-red-300"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </Button>

        <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-red-600 to-transparent opacity-60" />
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <aside className="w-64 bg-black border-r border-red-900/60 text-white p-4">
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  "text-zinc-400 hover:bg-red-900/30 hover:text-red-400",

                  isActive &&
                    "bg-red-600/20 text-red-400 font-medium border border-red-600/30",
                )
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/clients"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  "text-zinc-400 hover:bg-red-900/30 hover:text-red-400",
                  isActive &&
                    "bg-red-600/20 text-red-400 font-medium border border-red-600/30",
                )
              }
            >
              Clients
            </NavLink>

            {/* <NavLink
              to="/docs"
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  "text-zinc-400 hover:bg-red-900/30 hover:text-red-400",
                  isActive &&
                    "bg-red-600/20 text-red-400 font-medium border border-red-600/30",
                )
              }
            >
              Docs
            </NavLink> */}
          </nav>
        </aside>

        <main className="flex-1 min-h-screen p-6 bg-linear-to-br from-black via-zinc-950 to-red-950 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.08),transparent_60%)] pointer-events-none" />

          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
