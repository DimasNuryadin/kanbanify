import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Kanbanify — Real-Time Kanban & AI Task Workspace",
  description:
    "High-performance collaborative Kanban board with O(1) fractional indexing, real-time WebSocket sync, and AI task decomposition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
