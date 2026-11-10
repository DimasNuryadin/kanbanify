"use client";

import React, { useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { AuthUser, BoardRole } from "@kinetix/contracts";
import { DEMO_USERS, useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

export function AuthModal() {
  const isAuthModalOpen = useWorkspaceStore((s) => s.isAuthModalOpen);
  const setAuthModalOpen = useWorkspaceStore((s) => s.setAuthModalOpen);
  const currentUser = useWorkspaceStore((s) => s.currentUser);
  const setCurrentUser = useWorkspaceStore((s) => s.setCurrentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleDemoSwitch = async (demoUser: AuthUser) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await apiClient.login(
        { email: demoUser.email, password: "DemoPassword123!" },
        { useMock: useMockMode }
      );
      setCurrentUser(res.user, res.token);
      setSuccessMessage(`Switched to demo user: ${res.user.name} (${res.user.default_role})`);
      setTimeout(() => {
        setAuthModalOpen(false);
      }, 700);
    } catch {
      // Fallback: switch directly
      setCurrentUser(demoUser, `kb_sess_${demoUser.id}`);
      setSuccessMessage(`Switched to ${demoUser.name} (${demoUser.default_role})`);
      setTimeout(() => {
        setAuthModalOpen(false);
      }, 700);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (mode === "login") {
        const res = await apiClient.login(
          { email, password },
          { useMock: useMockMode }
        );
        setCurrentUser(res.user, res.token);
        setSuccessMessage(`Welcome back, ${res.user.name}!`);
      } else {
        const res = await apiClient.register(
          { name, email, password },
          { useMock: useMockMode }
        );
        setCurrentUser(res.user, res.token);
        setSuccessMessage(`Account created! Welcome, ${res.user.name}!`);
      }
      setTimeout(() => {
        setAuthModalOpen(false);
      }, 800);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Authentication request failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-base font-bold text-zinc-900 dark:text-zinc-100"
              >
                {mode === "login" ? "Sign In to Kanbanify" : "Create Kanbanify Account"}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                JWT Authentication & Role-Based Access Control
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 1-Click Instant Demo Account Switcher Bar */}
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-6 py-3 dark:border-zinc-800/80 dark:bg-zinc-950/50">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              1-Click Demo Account Switcher
            </span>
            <span className="text-[10px] lowercase font-normal text-zinc-400">
              No typing needed
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((demo) => {
              const isCurrent = currentUser?.email === demo.email;
              const roleColor =
                demo.default_role === "ADMIN"
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : demo.default_role === "EDITOR"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";

              return (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => handleDemoSwitch(demo)}
                  disabled={isLoading}
                  className={`flex flex-col items-center rounded-xl border p-2 text-center transition-all ${
                    isCurrent
                      ? "ring-2 ring-indigo-500 border-transparent bg-white shadow-xs dark:bg-zinc-800"
                      : "border-zinc-200 bg-white/70 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
                  }`}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-xs mb-1"
                    style={{ backgroundColor: demo.color }}
                  >
                    {demo.initials}
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-900 truncate max-w-full dark:text-zinc-100">
                    {demo.name.split(" ")[0]}
                  </span>
                  <span
                    className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-tight border ${roleColor}`}
                  >
                    {demo.default_role === "ADMIN" && "👑 Admin"}
                    {demo.default_role === "EDITOR" && "✏️ Editor"}
                    {demo.default_role === "VIEWER" && "👁️ Viewer"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs: Sign In / Register */}
        <div className="flex border-b border-zinc-100 px-6 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMessage(null);
            }}
            className={`pb-2.5 text-xs font-semibold transition-all border-b-2 mr-6 ${
              mode === "login"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Sign In with Email
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setErrorMessage(null);
            }}
            className={`pb-2.5 text-xs font-semibold transition-all border-b-2 ${
              mode === "register"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Register Account
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:text-rose-300">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-300">
            <Check className="h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5 dark:text-zinc-300">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Lee"
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5 dark:text-zinc-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@kinetix.dev"
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5 dark:text-zinc-300">
              Password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-9 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {isLoading
                ? "Processing..."
                : mode === "login"
                  ? "Sign In to Account"
                  : "Create Account & Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
