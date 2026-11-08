import { BoardBackground, LabelColor } from "@kinetix/contracts";

export interface CuratedBackgroundOption {
  id: string;
  name: string;
  category: "gradient" | "solid";
  background: BoardBackground;
  previewStyle: string;
  isDarkCanvas?: boolean;
}

/**
 * 6 Curated Gradients + 6 Solid Clean Surfaces that adapt gracefully to Light/Dark mode.
 */
export const CURATED_BOARD_BACKGROUNDS: CuratedBackgroundOption[] = [
  // 6 Curated Gradients
  {
    id: "grad-midnight-nebula",
    name: "Midnight Nebula",
    category: "gradient",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    },
    previewStyle: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)",
    isDarkCanvas: true,
  },
  {
    id: "grad-ocean-horizon",
    name: "Ocean Horizon",
    category: "gradient",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0d9488 100%)",
    },
    previewStyle: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0d9488 100%)",
    isDarkCanvas: true,
  },
  {
    id: "grad-royal-amethyst",
    name: "Royal Amethyst",
    category: "gradient",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #312e81 0%, #5b21b6 50%, #9d174d 100%)",
    },
    previewStyle: "linear-gradient(135deg, #312e81 0%, #5b21b6 50%, #9d174d 100%)",
    isDarkCanvas: true,
  },
  {
    id: "grad-aurora-emerald",
    name: "Aurora Forest",
    category: "gradient",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #064e3b 0%, #0f766e 55%, #1e3a8a 100%)",
    },
    previewStyle: "linear-gradient(135deg, #064e3b 0%, #0f766e 55%, #1e3a8a 100%)",
    isDarkCanvas: true,
  },
  {
    id: "grad-sunset-amber",
    name: "Crimson Sunset",
    category: "gradient",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #7c2d12 0%, #b91c1c 50%, #701a75 100%)",
    },
    previewStyle: "linear-gradient(135deg, #7c2d12 0%, #b91c1c 50%, #701a75 100%)",
    isDarkCanvas: true,
  },
  {
    id: "grad-nordic-frost",
    name: "Nordic Frost",
    category: "gradient",
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)",
    },
    previewStyle: "linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)",
    isDarkCanvas: true,
  },

  // 6 Solid Clean Surfaces (Adapt gracefully to Light/Dark mode)
  {
    id: "solid-default",
    name: "Adaptive Studio",
    category: "solid",
    background: {
      type: "solid",
      value: "adaptive-default",
    },
    previewStyle: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
  },
  {
    id: "solid-indigo",
    name: "Indigo Porcelain",
    category: "solid",
    background: {
      type: "solid",
      value: "adaptive-indigo",
    },
    previewStyle: "#6366f1",
  },
  {
    id: "solid-sky",
    name: "Sky Breeze",
    category: "solid",
    background: {
      type: "solid",
      value: "adaptive-sky",
    },
    previewStyle: "#0ea5e9",
  },
  {
    id: "solid-emerald",
    name: "Sage Mint",
    category: "solid",
    background: {
      type: "solid",
      value: "adaptive-emerald",
    },
    previewStyle: "#10b981",
  },
  {
    id: "solid-amber",
    name: "Warm Sand",
    category: "solid",
    background: {
      type: "solid",
      value: "adaptive-amber",
    },
    previewStyle: "#f59e0b",
  },
  {
    id: "solid-rose",
    name: "Rose Quartz",
    category: "solid",
    background: {
      type: "solid",
      value: "adaptive-rose",
    },
    previewStyle: "#f43f5e",
  },
];

export const LABEL_COLOR_MAP: Record<
  LabelColor,
  {
    name: string;
    pillBg: string;
    pillText: string;
    dot: string;
    swatch: string;
  }
> = {
  green: {
    name: "Green",
    pillBg: "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 dark:bg-emerald-500/25 dark:hover:bg-emerald-500/35 dark:border-emerald-400/40",
    pillText: "text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
    swatch: "#10b981",
  },
  yellow: {
    name: "Yellow",
    pillBg: "bg-amber-400/25 hover:bg-amber-400/35 border-amber-500/40 dark:bg-amber-500/25 dark:hover:bg-amber-500/35 dark:border-amber-400/40",
    pillText: "text-amber-900 dark:text-amber-200",
    dot: "bg-amber-500",
    swatch: "#eab308",
  },
  orange: {
    name: "Orange",
    pillBg: "bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/40 dark:bg-orange-500/25 dark:hover:bg-orange-500/35 dark:border-orange-400/40",
    pillText: "text-orange-800 dark:text-orange-200",
    dot: "bg-orange-500",
    swatch: "#f97316",
  },
  red: {
    name: "Red",
    pillBg: "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 dark:bg-rose-500/25 dark:hover:bg-rose-500/35 dark:border-rose-400/40",
    pillText: "text-rose-800 dark:text-rose-200",
    dot: "bg-rose-500",
    swatch: "#ef4444",
  },
  purple: {
    name: "Purple",
    pillBg: "bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40 dark:bg-purple-500/25 dark:hover:bg-purple-500/35 dark:border-purple-400/40",
    pillText: "text-purple-800 dark:text-purple-200",
    dot: "bg-purple-500",
    swatch: "#a855f7",
  },
  blue: {
    name: "Blue",
    pillBg: "bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/40 dark:bg-blue-500/25 dark:hover:bg-blue-500/35 dark:border-blue-400/40",
    pillText: "text-blue-800 dark:text-blue-200",
    dot: "bg-blue-500",
    swatch: "#3b82f6",
  },
  sky: {
    name: "Sky",
    pillBg: "bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 dark:bg-sky-500/25 dark:hover:bg-sky-500/35 dark:border-sky-400/40",
    pillText: "text-sky-800 dark:text-sky-200",
    dot: "bg-sky-500",
    swatch: "#0ea5e9",
  },
  lime: {
    name: "Lime",
    pillBg: "bg-lime-500/20 hover:bg-lime-500/30 border-lime-500/40 dark:bg-lime-500/25 dark:hover:bg-lime-500/35 dark:border-lime-400/40",
    pillText: "text-lime-800 dark:text-lime-200",
    dot: "bg-lime-500",
    swatch: "#84cc16",
  },
  pink: {
    name: "Pink",
    pillBg: "bg-pink-500/20 hover:bg-pink-500/30 border-pink-500/40 dark:bg-pink-500/25 dark:hover:bg-pink-500/35 dark:border-pink-400/40",
    pillText: "text-pink-800 dark:text-pink-200",
    dot: "bg-pink-500",
    swatch: "#ec4899",
  },
  black: {
    name: "Carbon",
    pillBg: "bg-zinc-700/20 hover:bg-zinc-700/30 border-zinc-600/40 dark:bg-zinc-400/20 dark:hover:bg-zinc-400/30 dark:border-zinc-400/40",
    pillText: "text-zinc-800 dark:text-zinc-200",
    dot: "bg-zinc-700 dark:bg-zinc-300",
    swatch: "#3f3f46",
  },
};

export const CARD_COVER_COLORS = [
  { name: "Emerald", value: "#10b981", alias: "green" },
  { name: "Amber", value: "#f59e0b", alias: "yellow" },
  { name: "Orange", value: "#f97316", alias: "orange" },
  { name: "Rose", value: "#ef4444", alias: "red" },
  { name: "Purple", value: "#8b5cf6", alias: "purple" },
  { name: "Blue", value: "#3b82f6", alias: "blue" },
  { name: "Sky", value: "#0ea5e9", alias: "sky" },
  { name: "Teal", value: "#14b8a6", alias: "lime" },
  { name: "Pink", value: "#ec4899", alias: "pink" },
  { name: "Slate", value: "#475569", alias: "black" },
];

const NAMED_COVER_COLOR_MAP: Record<string, string> = {
  green: "#10b981",
  emerald: "#10b981",
  yellow: "#f59e0b",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  rose: "#ef4444",
  purple: "#8b5cf6",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  lime: "#84cc16",
  teal: "#14b8a6",
  pink: "#ec4899",
  black: "#475569",
  slate: "#475569",
};

export function resolveCoverColor(value: string | null | undefined): string {
  if (!value) return "#3b82f6";
  const normalized = value.trim().toLowerCase();
  return NAMED_COVER_COLOR_MAP[normalized] ?? value;
}

export const LIST_COLOR_ACCENTS = [
  { name: "None", value: null },
  { name: "Blue", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Slate", value: "#64748b" },
];

export type DueDateStatus = "complete" | "overdue" | "due-soon" | "upcoming";

export function getDueDateStatus(
  dueDate: string | null | undefined,
  isDueComplete?: boolean
): DueDateStatus | null {
  if (!dueDate) return null;
  if (isDueComplete) return "complete";

  const now = Date.now();
  const dueTime = new Date(dueDate).getTime();
  const diffMs = dueTime - now;

  if (diffMs < 0) {
    return "overdue";
  }
  // Within 48 hours
  if (diffMs <= 48 * 60 * 60 * 1000) {
    return "due-soon";
  }
  return "upcoming";
}

export function resolveBoardCanvasClasses(background?: BoardBackground): {
  className: string;
  style?: React.CSSProperties;
} {
  if (!background) {
    return {
      className:
        "bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
    };
  }

  if (background.type === "gradient") {
    return {
      className: "text-zinc-900 dark:text-zinc-100",
      style: {
        backgroundImage: background.value,
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
      },
    };
  }

  if (background.type === "image") {
    return {
      className: "text-zinc-900 dark:text-zinc-100",
      style: {
        backgroundImage: `linear-gradient(rgba(9, 13, 22, 0.45), rgba(9, 13, 22, 0.55)), url(${background.value})`,
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
    };
  }

  // Solid adaptive surfaces
  switch (background.value) {
    case "adaptive-indigo":
      return {
        className:
          "bg-indigo-50/90 text-zinc-900 dark:bg-[#0b0f24] dark:text-zinc-100",
      };
    case "adaptive-sky":
      return {
        className:
          "bg-sky-50/90 text-zinc-900 dark:bg-[#081926] dark:text-zinc-100",
      };
    case "adaptive-emerald":
      return {
        className:
          "bg-emerald-50/80 text-zinc-900 dark:bg-[#071c18] dark:text-zinc-100",
      };
    case "adaptive-amber":
      return {
        className:
          "bg-amber-50/75 text-zinc-900 dark:bg-[#1c140a] dark:text-zinc-100",
      };
    case "adaptive-rose":
      return {
        className:
          "bg-rose-50/80 text-zinc-900 dark:bg-[#1e0b14] dark:text-zinc-100",
      };
    case "adaptive-default":
    default:
      if (background.value.startsWith("#") || background.value.startsWith("rgb")) {
        return {
          className: "text-zinc-900 dark:text-zinc-100",
          style: { backgroundColor: background.value },
        };
      }
      return {
        className:
          "bg-zinc-100/90 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
      };
  }
}
