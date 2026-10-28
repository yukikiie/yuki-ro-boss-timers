"use client";

import { useCallback, useState } from "react";
import { DEFAULT_FONT_PREFERENCES, normalizeFontPreferences, type FontPreferences, type TextPreferences } from "../lib/font-preferences";

export const FONT_STORAGE_KEY = "bosswatch.typography";

export function readFontPreferences(storage?: Pick<Storage, "getItem">) {
  try { return normalizeFontPreferences(JSON.parse(storage?.getItem(FONT_STORAGE_KEY) || "null")); }
  catch { return DEFAULT_FONT_PREFERENCES; }
}

export function useFontPreferences() {
  const [preferences, setPreferences] = useState<FontPreferences>(() => {
    try { return readFontPreferences(typeof window === "undefined" ? undefined : window.localStorage); }
    catch { return DEFAULT_FONT_PREFERENCES; }
  });
  const updatePreferences = useCallback((target: "names" | "ui", patch: Partial<TextPreferences>) => {
    setPreferences(current => {
      const next = normalizeFontPreferences({ ...current, [target]: { ...current[target], ...patch } });
      try { window.localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_FONT_PREFERENCES);
    try { window.localStorage.removeItem(FONT_STORAGE_KEY); } catch {}
  }, []);
  return { preferences, updatePreferences, resetPreferences };
}
