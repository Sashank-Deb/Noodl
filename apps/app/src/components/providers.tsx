"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/context/settings";
import { AuthProvider } from "@/context/auth";

/**
 * App-wide state that changes rarely (theme, settings, auth) lives in React
 * Context. Fast-changing editor state lives in Zustand (src/store).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SettingsProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={500}>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
