import React from 'react';
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { CommandBar } from "@/components/command-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Hash-It — Practice log & recall schedule for LeetCode",
  description: "A practice log for LeetCode that decides when you should solve each problem again.",
  icons: {
    icon: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const user = session?.user ?? null;

  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${ibmPlexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased selection:bg-muted selection:text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell user={user}>{children}</AppShell>
          <CommandBar />
          <KeyboardShortcutsModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
