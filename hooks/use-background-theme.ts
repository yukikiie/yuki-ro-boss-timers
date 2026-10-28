"use client";

import { useCallback, useState } from "react";
import { resolveBackgroundTheme, type BackgroundThemeId } from "../lib/background-themes";

export const BACKGROUND_STORAGE_KEY = "bosswatch.background";

export function readBackgroundTheme(storage?: Pick<Storage, "getItem">) {
  try { return resolveBackgroundTheme(storage?.getItem(BACKGROUND_STORAGE_KEY)).id as BackgroundThemeId; }
  catch { return "moon-garden" as const; }
}

export function useBackgroundTheme(previewBackgroundTheme?: BackgroundThemeId) {
  const isolated = previewBackgroundTheme !== undefined;
  const [themeId, updateTheme] = useState<BackgroundThemeId>(() => {
    if (isolated) return resolveBackgroundTheme(previewBackgroundTheme).id as BackgroundThemeId;
    try { return readBackgroundTheme(typeof window === "undefined" ? undefined : window.localStorage); }
    catch { return "moon-garden"; }
  });
  const setThemeId = useCallback((value: BackgroundThemeId) => {
    const next = resolveBackgroundTheme(value).id as BackgroundThemeId;
    updateTheme(next);
    if (isolated || typeof window === "undefined") return;
    try { window.localStorage.setItem(BACKGROUND_STORAGE_KEY, next); } catch {}
  }, [isolated]);
  return { themeId, setThemeId };
}
