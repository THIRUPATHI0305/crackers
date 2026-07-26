"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { uiCopy, type UiCopyKey } from "@/lib/ui-copy";

export type LocaleCode = "en" | "ta" | "hi";

const STORAGE_KEY = "sn_locale";

type LocaleContextValue = {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: (key: UiCopyKey) => string;
  /** Prefer Tamil text when locale is ta; otherwise English. */
  L: (en: string, ta?: string | null) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(enabled: LocaleCode[]): LocaleCode {
  if (typeof window === "undefined") return enabled[0] || "en";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "en" || raw === "ta" || raw === "hi") {
      if (enabled.includes(raw)) return raw;
    }
  } catch {
    /* ignore */
  }
  return enabled[0] || "en";
}

export function LocaleProvider({
  enabledLanguages,
  children,
}: {
  enabledLanguages: { en: boolean; ta: boolean; hi: boolean };
  children: ReactNode;
}) {
  const enabled = useMemo(() => {
    const list: LocaleCode[] = [];
    if (enabledLanguages.en) list.push("en");
    if (enabledLanguages.ta) list.push("ta");
    if (enabledLanguages.hi) list.push("hi");
    return list.length > 0 ? list : (["en"] as LocaleCode[]);
  }, [enabledLanguages]);

  const [locale, setLocaleState] = useState<LocaleCode>(enabled[0] || "en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale(enabled));
    setHydrated(true);
  }, [enabled]);

  useEffect(() => {
    if (!hydrated) return;
    if (!enabled.includes(locale)) {
      setLocaleState(enabled[0] || "en");
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = locale === "ta" ? "ta" : "en";
  }, [locale, enabled, hydrated]);

  const setLocale = useCallback(
    (next: LocaleCode) => {
      if (enabled.includes(next)) setLocaleState(next);
    },
    [enabled]
  );

  const t = useCallback(
    (key: UiCopyKey) => {
      const table = locale === "ta" ? uiCopy.ta : uiCopy.en;
      return table[key] || uiCopy.en[key] || key;
    },
    [locale]
  );

  const L = useCallback(
    (en: string, ta?: string | null) => {
      if (locale === "ta" && ta?.trim()) return ta.trim();
      return en;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, L }),
    [locale, setLocale, t, L]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "en" as LocaleCode,
      setLocale: () => {},
      t: (key: UiCopyKey) => uiCopy.en[key] || key,
      L: (en: string, ta?: string | null) => en || ta || "",
    };
  }
  return ctx;
}
