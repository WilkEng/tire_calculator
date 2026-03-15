"use client";

import { EventProvider } from "@/context/EventContext";
import { AppNav } from "@/components/layout/AppNav";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </EventProvider>
  );
}
