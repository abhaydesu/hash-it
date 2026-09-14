import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Navbar, SidebarNav } from "@/components/navbar";
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
  title: "HASH_IT - DSA Retention Engine",
  description: "Personal DSA review system built around FSRS memory science, patterns, and developer-focused analytics.",
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
      <body className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col selection:bg-[#D6C2A8] selection:text-[#1D1A17] dark:selection:bg-[#5A3E2A] dark:selection:text-[#F7F1E8]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="flex min-h-screen flex-col">
            <Navbar user={user} />
            <div className="mx-auto flex w-full max-w-[1600px] flex-1">
              <SidebarNav />
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
          </div>
          <CommandBar />
          <KeyboardShortcutsModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
