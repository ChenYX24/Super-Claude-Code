"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { defaultLocale, type Locale } from "./config";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = localStorage.getItem("scc-locale");
  if (stored === "en" || stored === "zh-CN") return stored;
  return defaultLocale;
}

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<AbstractIntlMessages | null>(null);

  const loadMessages = useCallback(async (loc: Locale) => {
    try {
      const msgs = await import(`../../messages/${loc}.json`);
      setMessages(msgs.default || msgs);
    } catch {
      // Fallback to English
      const msgs = await import("../../messages/en.json");
      setMessages(msgs.default || msgs);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredLocale();
    setLocaleState(stored);
    loadMessages(stored);
  }, [loadMessages]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      localStorage.setItem("scc-locale", newLocale);
      loadMessages(newLocale);
      // Update html lang attribute
      document.documentElement.lang = newLocale;
    },
    [loadMessages]
  );

  if (!messages) {
    return null; // Wait for messages to load
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
