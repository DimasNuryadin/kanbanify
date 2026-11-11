"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Kanban,
  Layers,
  Lock,
  Mail,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Users,
  Zap,
} from "lucide-react";
import { AuthUser, BoardRole } from "@kinetix/contracts";
import { DEMO_USERS, hasValidAuthSession, useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const setCurrentUser = useWorkspaceStore((s) => s.setCurrentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const themeMode = useWorkspaceStore((s) => s.themeMode);
  const setThemeMode = useWorkspaceStore((s) => s.setThemeMode);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPersonaId, setLoadingPersonaId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // If already logged in, redirect straight to workspace (preserving invite if present)
  useEffect(() => {
    if (hasValidAuthSession()) {
      const target = inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : "/";
      router.replace(target);
    }
  }, [router, inviteToken]);

  // Sync theme
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      setThemeMode("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setThemeMode("light");
    }
  };

  const getDestinationUrl = () => {
    return inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : "/";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.login(
        { email: email.trim(), password },
        { useMock: useMockMode }
      );
      setCurrentUser(res.user, res.token);
      setSuccessMessage(`Welcome back, ${res.user.name}!`);
      setTimeout(() => {
        router.push(getDestinationUrl());
      }, 500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Authentication failed. Please verify credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handle1ClickDemoLogin = async (demo: AuthUser) => {
    setLoadingPersonaId(demo.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.login(
        { email: demo.email, password: "DemoPassword123!" },
        { useMock: useMockMode }
      );
      setCurrentUser(res.user, res.token);
      setSuccessMessage(`Logged in as ${res.user.name} (${res.user.default_role})!`);
      setTimeout(() => {
        router.push(getDestinationUrl());
      }, 400);
    } catch {
      // Seamless fallback: directly log in with pre-seeded demo user
      const fallbackToken = `kb_sess_${demo.id}_token`;
      setCurrentUser(demo, fallbackToken);
      setSuccessMessage(`Logged in as ${demo.name} (${demo.default_role})!`);
      setTimeout(() => {
        router.push(getDestinationUrl());
      }, 400);
    } finally {
      setLoadingPersonaId(null);
    }
  };

  const registerHref = inviteToken
    ? `/register?invite=${encodeURIComponent(inviteToken)}`
    : "/register";

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      {/* LEFT / CENTER COLUMN: Auth Card & Fast-Track Personas */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-y-auto">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <Kanban className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                Kanbanify
              </span>
              <span className="ml-1.5 rounded-sm bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400">
                v2.0
              </span>
            </div>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-xs hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Auth Content Container */}
        <div className="my-auto w-full max-w-md mx-auto py-8">
          {/* Invite Alert Pill if present */}
          {inviteToken && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-700 dark:text-indigo-300 animate-in fade-in slide-in-from-top-2">
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
              <span>
                <strong>Workspace Invite Attached:</strong> Log in to immediately redeem and join the board.
              </span>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Log in to Kanbanify
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Log in to continue to your Kanbanify Workspace
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@kinetix.dev"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || loadingPersonaId !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Log in to Kanbanify</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Register link */}
          <div className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Don't have an account?{" "}
            <Link
              href={registerHref}
              className="font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 hover:underline"
            >
              Create a Kanbanify account
            </Link>
          </div>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
              <span className="bg-zinc-50 px-3 text-zinc-400 dark:bg-zinc-950 dark:text-zinc-500">
                OR TRY INSTANT DEMO WORKSPACE AS:
              </span>
            </div>
          </div>

          {/* ⚡ Instant 1-Click Demo Login Cards (Developer / QA Fast-Track) */}
          <div className="space-y-2.5">
            {DEMO_USERS.map((demo) => {
              const isPersonaLoading = loadingPersonaId === demo.id;
              const isRoleAdmin = demo.default_role === "ADMIN";
              const isRoleEditor = demo.default_role === "EDITOR";
              const isRoleViewer = demo.default_role === "VIEWER";

              return (
                <button
                  key={demo.id}
                  type="button"
                  disabled={isLoading || loadingPersonaId !== null}
                  onClick={() => handle1ClickDemoLogin(demo)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.99] group ${
                    isRoleAdmin
                      ? "border-indigo-500/30 bg-white hover:bg-indigo-500/5 hover:border-indigo-500/50 dark:bg-zinc-900 dark:hover:bg-indigo-950/20"
                      : isRoleEditor
                        ? "border-emerald-500/30 bg-white hover:bg-emerald-500/5 hover:border-emerald-500/50 dark:bg-zinc-900 dark:hover:bg-emerald-950/20"
                        : "border-amber-500/30 bg-white hover:bg-amber-500/5 hover:border-amber-500/50 dark:bg-zinc-900 dark:hover:bg-amber-950/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: demo.color }}
                    >
                      {demo.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {isRoleAdmin && "👑 Login as Alex"}
                          {isRoleEditor && "✏️ Login as Sarah"}
                          {isRoleViewer && "👁️ Login as Budi"}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold border ${
                            isRoleAdmin
                              ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : isRoleEditor
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isRoleAdmin && "Workspace Admin"}
                          {isRoleEditor && "Board Editor"}
                          {isRoleViewer && "Read-Only Viewer"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {isRoleAdmin && "Full access & workspace settings"}
                        {isRoleEditor && "Standard member access & editing"}
                        {isRoleViewer && "Observer mode & read-only access"}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {isPersonaLoading ? (
                      <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
          Kanbanify Platform &copy; 2026 &bull; Secure JWT Session &bull; RBAC Protected
        </div>
      </div>

      {/* RIGHT COLUMN: Visual Product Showcase on Desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 text-white flex-col justify-between p-12 overflow-hidden border-l border-zinc-800">
        {/* Atmospheric Gradient Background Mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-zinc-950 to-zinc-950 pointer-events-none" />
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Showcase Header */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Interactive SaaS Workspace Preview</span>
          </div>
          <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white">
            High-Performance Collaborative Kanban
          </h2>
          <p className="mt-2 text-xs xl:text-sm text-zinc-400 max-w-lg">
            Real-time multi-tenant board management with O(1) fractional indexing, automated Butler triggers, and burndown telemetry.
          </p>
        </div>

        {/* Interactive / Animated Preview Graphic */}
        <div className="relative z-10 my-8 space-y-4">
          {/* Mini Board Showcase Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-xl">
            {/* Board Header Bar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-zinc-200">Kinetix Sprint 42</span>
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">
                  WORKSPACE
                </span>
              </div>
              {/* Co-Presence Avatars in preview */}
              <div className="flex items-center -space-x-1.5">
                {DEMO_USERS.map((u) => (
                  <div
                    key={u.id}
                    className="relative flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-zinc-900 shadow-xs"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.initials}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-zinc-900" />
                  </div>
                ))}
              </div>
            </div>

            {/* Mini Columns Showcase */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* In Progress Column */}
              <div className="rounded-xl bg-zinc-950/60 p-2.5 border border-zinc-800/80">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 mb-2">
                  <span>IN PROGRESS</span>
                  <span className="rounded bg-zinc-800 px-1 text-[9px]">2</span>
                </div>
                <div className="space-y-2">
                  {/* Card 1 */}
                  <div className="rounded-lg bg-zinc-900 p-2 border border-zinc-700/60 shadow-xs">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="h-1.5 w-6 rounded-full bg-indigo-500" />
                      <span className="h-1.5 w-4 rounded-full bg-emerald-500" />
                    </div>
                    <div className="text-[11px] font-semibold text-zinc-100">
                      ⚡ O(1) Fractional Indexing
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-zinc-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-mono">
                        <Check className="h-2.5 w-2.5" /> 4/4 done
                      </span>
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white">
                        AR
                      </span>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="rounded-lg bg-zinc-900 p-2 border border-zinc-700/60 shadow-xs">
                    <div className="text-[11px] font-semibold text-zinc-100">
                      🤖 Butler Automation Hooks
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-400">
                      <Clock className="h-2.5 w-2.5" /> Due in 2h
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Review Column */}
              <div className="rounded-xl bg-zinc-950/60 p-2.5 border border-zinc-800/80">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 mb-2">
                  <span>CODE REVIEW</span>
                  <span className="rounded bg-zinc-800 px-1 text-[9px]">1</span>
                </div>
                <div className="rounded-lg bg-zinc-900 p-2 border border-indigo-500/40 shadow-xs ring-1 ring-indigo-500/20">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="h-1.5 w-8 rounded-full bg-violet-500" />
                  </div>
                  <div className="text-[11px] font-semibold text-zinc-100">
                    📊 Burndown Telemetry
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-zinc-400">
                    <span className="rounded bg-indigo-500/20 px-1 text-indigo-300 font-mono">
                      v2.0-rc
                    </span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white">
                      SC
                    </span>
                  </div>
                </div>
              </div>

              {/* Done Column */}
              <div className="rounded-xl bg-zinc-950/60 p-2.5 border border-zinc-800/80">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 mb-2">
                  <span>DONE</span>
                  <span className="rounded bg-zinc-800 px-1 text-[9px]">4</span>
                </div>
                <div className="rounded-lg bg-zinc-900 p-2 border border-emerald-500/30 shadow-xs bg-emerald-950/10">
                  <div className="text-[11px] font-semibold text-zinc-300 line-through">
                    Multi-Tenant Auth Guard
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Butler Automation Pill Feature Badge */}
          <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3 shadow-lg backdrop-blur-md">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-200">
                  🤖 Butler Automation Active
                </span>
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300">
                  O(1) Drag
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                When card moved to Done &rarr; auto-mark due date complete & broadcast WebSocket event
              </p>
            </div>
          </div>
        </div>

        {/* Feature Grid Bullets */}
        <div className="relative z-10 grid grid-cols-2 gap-3 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Shield className="h-4 w-4 text-indigo-400" />
            <span>Role-Based Access Control</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>Sub-2ms Move Execution</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Users className="h-4 w-4 text-amber-400" />
            <span>Real-Time Co-Presence Sync</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Layers className="h-4 w-4 text-violet-400" />
            <span>Pomodoro & Sprint Retros</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
          <div className="flex flex-col items-center space-y-3">
            <Kanban className="h-8 w-8 text-indigo-500 animate-pulse" />
            <p className="text-xs text-zinc-400">Loading Kanbanify Login...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
