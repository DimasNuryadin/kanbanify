"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeMode, useWorkspaceStore } from "@/store/workspace-store";

const THEME_STORAGE_KEY = "kinetix-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const themeMode = useWorkspaceStore((s) => s.themeMode);
  const setThemeMode = useWorkspaceStore((s) => s.setThemeMode);
  const isCommandPaletteOpen = useWorkspaceStore((s) => s.isCommandPaletteOpen);
  const setCommandPaletteOpen = useWorkspaceStore(
    (s) => s.setCommandPaletteOpen
  );
  const selectedCardId = useWorkspaceStore((s) => s.selectedCardId);
  const isCreateCardModalOpen = useWorkspaceStore(
    (s) => s.isCreateCardModalOpen
  );
  const openCreateCardModal = useWorkspaceStore((s) => s.openCreateCardModal);
  const toggleLabelsExpanded = useWorkspaceStore((s) => s.toggleLabelsExpanded);
  const isBoardMenuOpen = useWorkspaceStore((s) => s.isBoardMenuOpen);
  const setBoardMenuOpen = useWorkspaceStore((s) => s.setBoardMenuOpen);
  const memberFilterId = useWorkspaceStore((s) => s.memberFilterId);
  const setMemberFilterId = useWorkspaceStore((s) => s.setMemberFilterId);
  const firstMemberId = useWorkspaceStore((s) => s.board.members[0]?.id ?? null);

  // Hydrate theme preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        THEME_STORAGE_KEY
      ) as ThemeMode | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeMode(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, [setThemeMode]);

  // Apply .dark class to <html> and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyResolvedTheme = () => {
      const shouldBeDark =
        themeMode === "dark" || (themeMode === "system" && mediaQuery.matches);
      if (shouldBeDark) {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };

    applyResolvedTheme();
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Ignore storage errors
    }

    if (themeMode === "system") {
      mediaQuery.addEventListener("change", applyResolvedTheme);
      return () => mediaQuery.removeEventListener("change", applyResolvedTheme);
    }
  }, [themeMode]);

  // Global keyboard shortcuts (Cmd+K / Ctrl+K, C/N, L, Q, B)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditable =
        !target ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable;

      if (
        isEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isCommandPaletteOpen ||
        isCreateCardModalOpen ||
        Boolean(selectedCardId)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "c" || key === "n") {
        e.preventDefault();
        openCreateCardModal(null);
      } else if (key === "l") {
        e.preventDefault();
        toggleLabelsExpanded();
      } else if (key === "b") {
        e.preventDefault();
        setBoardMenuOpen(!isBoardMenuOpen);
      } else if (key === "q" && firstMemberId) {
        e.preventDefault();
        setMemberFilterId(
          memberFilterId === firstMemberId ? null : firstMemberId
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    isCreateCardModalOpen,
    selectedCardId,
    openCreateCardModal,
    toggleLabelsExpanded,
    isBoardMenuOpen,
    setBoardMenuOpen,
    memberFilterId,
    setMemberFilterId,
    firstMemberId,
  ]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
