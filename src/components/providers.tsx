"use client";

import { ReactNode } from "react";
import { ToastProvider } from "./toast";
import { I18nProvider } from "@/i18n/provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </I18nProvider>
  );
}
