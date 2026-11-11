"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Kanban,
  Lock,
  Mail,
  Moon,
  Pencil,
  Shield,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { AuthUser, BoardRole } from "@kinetix/contracts";
import { hasValidAuthSession, useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const setCurrentUser = useWorkspaceStore((s) => s.setCurrentUser);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const themeMode = useWorkspaceStore((s) => s.themeMode);
  const setThemeMode = useWorkspaceStore((s) => s.setThemeMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [defaultRole, setDefaultRole] = useState<"ADMIN" | "EDITOR">("EDITOR");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validations
    if (!name.trim()) {
      setErrorMessage("Please enter your full name");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid work email address");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiClient.register(
        {
          name: name.trim(),
          email: email.trim(),
          password,
        },
        { useMock: useMockMode }
      );

      // Ensure user reflects chosen default workspace role
      const userWithChosenRole: AuthUser = {
        ...res.user,
        default_role: defaultRole,
      };

      setCurrentUser(userWithChosenRole, res.token);
      setSuccessMessage(`Account created successfully! Welcome to Kanbanify, ${res.user.name}!`);

      setTimeout(() => {
        router.push(getDestinationUrl());
      }, 500);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Registration failed. Please check details."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loginHref = inviteToken
    ? `/login?invite=${encodeURIComponent(inviteToken)}`
    : "/login";

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 p-6 sm:p-10 transition-colors overflow-y-auto">
      {/* Top Header Bar */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
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
        </Link>

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

      {/* Main Registration Card */}
      <div className="my-auto w-full max-w-xl mx-auto py-6">
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 sm:p-10 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          {/* Invite Alert Pill if present */}
          {inviteToken && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-700 dark:text-indigo-300 animate-in fade-in slide-in-from-top-2">
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
              <span>
                <strong>Board Invite Included:</strong> Complete registration to claim your seat on the board.
              </span>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Create your Kanbanify account
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Set up your workspace credentials and choose your default role
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

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="register-name"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  id="register-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
                />
              </div>
            </div>

            {/* Work Email */}
            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Work Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
                />
              </div>
            </div>

            {/* Passwords in 2 columns on tablet+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Password */}
              <div>
                <label
                  htmlFor="register-password"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  <input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 chars"
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-9 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="register-confirm-password"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  <input
                    id="register-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    minLength={6}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-9 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Default Workspace Role Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Default Workspace Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Editor Card */}
                <button
                  type="button"
                  onClick={() => setDefaultRole("EDITOR")}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    defaultRole === "EDITOR"
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30"
                      : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      <Pencil className="h-3.5 w-3.5 text-emerald-500" />
                      Board Editor
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Create, edit, move cards, log time, and collaborate with team members.
                  </p>
                </button>

                {/* Admin Card */}
                <button
                  type="button"
                  onClick={() => setDefaultRole("ADMIN")}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    defaultRole === "ADMIN"
                      ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20 ring-2 ring-indigo-500/30"
                      : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      <Shield className="h-3.5 w-3.5 text-indigo-500" />
                      Workspace Admin
                    </span>
                    <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.2 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      Full Access
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Manage board settings, invite team members, configure Butler automations & webhooks.
                  </p>
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Kanbanify Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Switch to Login link */}
          <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Already have a Kanbanify account?{" "}
            <Link
              href={loginHref}
              className="font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 hover:underline"
            >
              Log in to your workspace
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-xl mx-auto text-center text-[11px] text-zinc-400 dark:text-zinc-600">
        Kanbanify Platform &copy; 2026 &bull; Secure JWT Session &bull; RBAC Protected
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
          <div className="flex flex-col items-center space-y-3">
            <Kanban className="h-8 w-8 text-indigo-500 animate-pulse" />
            <p className="text-xs text-zinc-400">Loading Kanbanify Registration...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
