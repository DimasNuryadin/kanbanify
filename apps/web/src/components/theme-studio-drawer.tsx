"use client";

import React, { useState } from "react";
import {
  Check,
  Eye,
  Layers,
  Palette,
  Sliders,
  Sparkles,
  SunMoon,
  X,
  Zap,
} from "lucide-react";
import {
  BoardThemeConfig,
  THEME_PRESET_CONFIGS,
  ThemePreset,
} from "@kinetix/contracts";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";

interface PresetOption {
  preset: ThemePreset;
  title: string;
  subtitle: string;
  badge: string;
  previewBg: string;
  previewBorder: string;
  accent: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    preset: "DEFAULT_CLEAN",
    title: "Default Clean",
    subtitle: "Crisp modern Linear & Trello surfaces with balanced contrast",
    badge: "Modern Clean",
    previewBg: "bg-slate-100 dark:bg-slate-900",
    previewBorder: "border-slate-300 dark:border-slate-700",
    accent: "#6366f1",
  },
  {
    preset: "FROSTED_GLASS",
    title: "Frosted Glass",
    subtitle: "True frosted glassmorphism with backdrop blur and soft borders",
    badge: "Glassmorphism",
    previewBg:
      "bg-gradient-to-br from-white/70 to-white/40 dark:from-slate-900/70 dark:to-slate-950/40 backdrop-blur-md",
    previewBorder: "border-white/50 dark:border-white/20",
    accent: "#38bdf8",
  },
  {
    preset: "CYBERPUNK_NEON",
    title: "Cyberpunk Neon",
    subtitle: "High-contrast obsidian canvas with vivid cyan and magenta glows",
    badge: "Neon Glow",
    previewBg: "bg-black",
    previewBorder: "border-pink-500/60 shadow-[0_0_12px_rgba(236,72,153,0.3)]",
    accent: "#ec4899",
  },
  {
    preset: "MINIMAL_NORD",
    title: "Minimal Nord",
    subtitle: "Calm Arctic slate-blue palette with focused typography",
    badge: "Arctic Calm",
    previewBg: "bg-[#2e3440] text-[#eceff4]",
    previewBorder: "border-[#4c566a]",
    accent: "#88c0d0",
  },
  {
    preset: "WARM_ESPRESSO",
    title: "Warm Espresso",
    subtitle: "Cozy dark-roast stone, amber highlights, and warm surfaces",
    badge: "Cozy Roast",
    previewBg: "bg-[#1c1917] text-[#fef3c7]",
    previewBorder: "border-amber-900/50",
    accent: "#f59e0b",
  },
];

const ACCENT_SWATCHES = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Sky", value: "#38bdf8" },
  { label: "Neon Pink", value: "#ec4899" },
  { label: "Nord Frost", value: "#88c0d0" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Purple", value: "#8b5cf6" },
];

export function ThemeStudioDrawer() {
  const isOpen = useWorkspaceStore((s) => s.isThemeStudioOpen);
  const setOpen = useWorkspaceStore((s) => s.setThemeStudioOpen);
  const board = useWorkspaceStore((s) => s.board);
  const useMockMode = useWorkspaceStore((s) => s.useMockMode);
  const activeRole = useWorkspaceStore((s) => s.activeRole);
  const isViewer = activeRole === "VIEWER";

  const updateBoardThemeConfig = useWorkspaceStore(
    (s) => s.updateBoardThemeConfig
  );
  const addToast = useWorkspaceStore((s) => s.addToast);

  const themeConfig = board.theme_config ?? {
    preset: "DEFAULT_CLEAN",
    glass_blur: "md",
    card_density: "comfortable",
    card_radius: "md",
    accent_color: "#6366f1",
    show_custom_fields_on_front: true,
    show_dependency_badges_on_front: true,
  };

  const handleApplyPreset = async (preset: ThemePreset) => {
    if (isViewer) return;
    const baseConfig = THEME_PRESET_CONFIGS[preset];
    const nextConfig: BoardThemeConfig = {
      ...baseConfig,
      show_custom_fields_on_front: themeConfig.show_custom_fields_on_front,
      show_dependency_badges_on_front:
        themeConfig.show_dependency_badges_on_front,
    };

    updateBoardThemeConfig(nextConfig);
    try {
      await apiClient.updateBoardTheme(
        board.id,
        {
          preset,
          glass_blur: nextConfig.glass_blur,
          card_density: nextConfig.card_density,
          card_radius: nextConfig.card_radius,
          accent_color: nextConfig.accent_color,
        },
        { useMock: useMockMode }
      );

      addToast({
        id: `theme-${Date.now()}`,
        ruleName: "Theme Preset Applied",
        cardTitle: "Board Theme",
        actionSummary: `Switched aesthetic preset to ${preset.replace(/_/g, " ")}.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Theme Update Failed",
        cardTitle: "Board Theme",
        actionSummary:
          err instanceof Error ? err.message : "Failed to persist theme",
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleUpdateOption = async (patch: Partial<BoardThemeConfig>) => {
    if (isViewer) return;
    const nextConfig: BoardThemeConfig = {
      ...themeConfig,
      ...patch,
    };
    updateBoardThemeConfig(nextConfig);

    try {
      await apiClient.updateBoardTheme(board.id, patch, {
        useMock: useMockMode,
      });
    } catch (err) {
      addToast({
        id: `err-${Date.now()}`,
        ruleName: "Update Failed",
        cardTitle: "Board Theme",
        actionSummary:
          err instanceof Error ? err.message : "Failed to update theme",
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Drawer */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-6 py-4 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
              <Palette className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>🎨 Glassmorphism & Theme Studio</span>
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Live board aesthetic presets & density studio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Studio Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Viewer Notice */}
          {isViewer && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              👁️ You have Viewer permissions. Theme customization is
              read-only.
            </div>
          )}

          {/* 1. Aesthetic Presets Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Aesthetic Presets ({PRESET_OPTIONS.length})
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">
                Active: {themeConfig.preset}
              </span>
            </div>

            <div className="space-y-2.5">
              {PRESET_OPTIONS.map((opt) => {
                const isActive = themeConfig.preset === opt.preset;
                return (
                  <button
                    key={opt.preset}
                    type="button"
                    disabled={isViewer}
                    onClick={() => handleApplyPreset(opt.preset)}
                    className={`w-full text-left rounded-xl border p-3 transition-all relative overflow-hidden ${
                      isActive
                        ? "border-indigo-500 ring-2 ring-indigo-500/30 shadow-md bg-indigo-50/20 dark:bg-indigo-950/20"
                        : "border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {opt.title}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                            style={{
                              borderColor: `${opt.accent}40`,
                              backgroundColor: `${opt.accent}15`,
                              color: opt.accent,
                            }}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                          {opt.subtitle}
                        </p>
                      </div>

                      {/* Small visual surface preview swatch */}
                      <div
                        className={`h-7 w-12 rounded-lg border shrink-0 ${opt.previewBg} ${opt.previewBorder} flex items-center justify-center`}
                      >
                        {isActive && (
                          <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 font-bold" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Card Density Control */}
          <div className="border-t border-zinc-200/80 pt-5 dark:border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Card Density
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isViewer}
                onClick={() =>
                  handleUpdateOption({ card_density: "comfortable" })
                }
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-semibold transition-all ${
                  themeConfig.card_density === "comfortable"
                    ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                <span>Comfortable</span>
                <span className="text-[10px] font-normal text-zinc-400 mt-0.5">
                  Spacious & airy (Trello default)
                </span>
              </button>

              <button
                type="button"
                disabled={isViewer}
                onClick={() =>
                  handleUpdateOption({ card_density: "compact" })
                }
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-semibold transition-all ${
                  themeConfig.card_density === "compact"
                    ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                }`}
              >
                <span>Compact</span>
                <span className="text-[10px] font-normal text-zinc-400 mt-0.5">
                  Tight padding & dense rows
                </span>
              </button>
            </div>
          </div>

          {/* 3. Corner Radius Control */}
          <div className="border-t border-zinc-200/80 pt-5 dark:border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Corner Radius
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "sm", label: "Sharp", sub: "6px" },
                { id: "md", label: "Standard", sub: "12px" },
                { id: "xl", label: "Playful", sub: "16px" },
              ].map((r) => {
                const active = themeConfig.card_radius === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={isViewer}
                    onClick={() =>
                      handleUpdateOption({
                        card_radius: r.id as "sm" | "md" | "xl",
                      })
                    }
                    className={`flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 text-xs font-semibold transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 ring-2 ring-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-300"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {r.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Glass Blur Intensity */}
          <div className="border-t border-zinc-200/80 pt-5 dark:border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Backdrop Blur Intensity
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {(["none", "sm", "md", "lg"] as const).map((b) => {
                const active = themeConfig.glass_blur === b;
                return (
                  <button
                    key={b}
                    type="button"
                    disabled={isViewer}
                    onClick={() => handleUpdateOption({ glass_blur: b })}
                    className={`rounded-lg border py-1.5 text-xs font-semibold uppercase transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Accent Color Swatches */}
          <div className="border-t border-zinc-200/80 pt-5 dark:border-zinc-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Board Accent Color
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((sw) => {
                const active =
                  themeConfig.accent_color.toLowerCase() ===
                  sw.value.toLowerCase();
                return (
                  <button
                    key={sw.value}
                    type="button"
                    disabled={isViewer}
                    onClick={() =>
                      handleUpdateOption({ accent_color: sw.value })
                    }
                    title={sw.label}
                    className={`h-7 w-7 rounded-full border transition-transform ${
                      active
                        ? "scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: sw.value }}
                  />
                );
              })}
            </div>
          </div>

          {/* 6. Card Front Badges Visibility Toggles */}
          <div className="border-t border-zinc-200/80 pt-5 dark:border-zinc-800/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Card Front Badge Visibility
            </h3>

            {/* Custom Fields Toggle */}
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-900/60 cursor-pointer">
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Show Custom Fields Badges
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Render Environment, Est. Hours, and QA pills on Kanban card
                  fronts
                </p>
              </div>
              <input
                type="checkbox"
                disabled={isViewer}
                checked={themeConfig.show_custom_fields_on_front}
                onChange={(e) =>
                  handleUpdateOption({
                    show_custom_fields_on_front: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            {/* Dependency Badges Toggle */}
            <label className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs font-medium dark:border-zinc-800 dark:bg-zinc-900/60 cursor-pointer">
              <div className="space-y-0.5">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Show Dependency / Blocker Badges
                </span>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Render red alert badges indicating blocked downstream cards
                </p>
              </div>
              <input
                type="checkbox"
                disabled={isViewer}
                checked={themeConfig.show_dependency_badges_on_front}
                onChange={(e) =>
                  handleUpdateOption({
                    show_dependency_badges_on_front: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200/80 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800/80 dark:bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-500">
          <span>Synced with Fastify backend API</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}
