"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Kanban, ShieldAlert, ShieldCheck } from "lucide-react";
import { hasValidAuthSession, useWorkspaceStore } from "@/store/workspace-store";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const syncStoredAuth = useWorkspaceStore((s) => s.syncStoredAuth);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check localStorage for active session
    const valid = hasValidAuthSession();
    if (!valid) {
      setIsAuthenticated(false);
      let inviteParam = "";
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams(window.location.search);
        const invite = searchParams.get("invite");
        if (invite) {
          inviteParam = `?invite=${encodeURIComponent(invite)}`;
        }
      }
      router.replace(`/login${inviteParam}`);
    } else {
      syncStoredAuth();
      setIsAuthenticated(true);
    }
  }, [router, syncStoredAuth]);

  // Prevent any rendering of Kanban workspace until authenticated session is verified
  if (isAuthenticated !== true) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white p-6 select-none">
        <div className="flex flex-col items-center space-y-5 max-w-sm text-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 animate-pulse">
              <Kanban className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-zinc-950 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
              Kanbanify Workspace
            </h2>
            <p className="text-xs text-zinc-400">
              Verifying workspace credentials & RBAC session...
            </p>
          </div>

          <div className="w-44 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-indeterminate w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
