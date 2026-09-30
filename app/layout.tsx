import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AUTHOR, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import { AppShell } from "@/components/app-shell";
import { KeyboardShortcutsModal } from "@/components/keyboard-shortcuts-modal";
import { CommandBar } from "@/components/command-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionUserMenu, SessionUserMenuFallback } from "@/components/session-user-menu";
import { ContestReminderSlot } from "@/components/contest-reminder-slot";
import { StreakSlot } from "@/components/streak-slot";
import { SidebarNav } from "@/components/navbar";
import { SidebarNavSlot } from "@/components/sidebar-nav-slot";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  category: "education",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${ibmPlexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased selection:bg-muted selection:text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell
            contestReminder={
              <Suspense fallback={null}>
                <ContestReminderSlot />
              </Suspense>
            }
            streak={
              <Suspense fallback={null}>
                <StreakSlot />
              </Suspense>
            }
            sidebarNav={
              <Suspense fallback={<SidebarNav />}>
                <SidebarNavSlot />
              </Suspense>
            }
            userMenu={
              <Suspense fallback={<SessionUserMenuFallback />}>
                <SessionUserMenu />
              </Suspense>
            }
          >
            {children}
          </AppShell>
          <CommandBar />
          <KeyboardShortcutsModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
