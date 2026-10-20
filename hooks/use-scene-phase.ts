"use client";

import { useEffect, useState } from "react";
import { getHongKongScenePhase, type SceneMode } from "../lib/scene-time";

export function useScenePhase(mode: SceneMode = "auto", timestamp?: number) {
  const [localTime, setLocalTime] = useState(0);
  const hasClock = typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0;

  useEffect(() => {
    if (mode !== "auto" || hasClock) return;
    const updateTime = () => setLocalTime(Date.now());
    updateTime();
    const interval = window.setInterval(updateTime, 15000);
    window.addEventListener("focus", updateTime);
    document.addEventListener("visibilitychange", updateTime);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateTime);
      document.removeEventListener("visibilitychange", updateTime);
    };
  }, [hasClock, mode]);

  return mode === "auto" ? getHongKongScenePhase(hasClock ? timestamp : localTime || NaN) : mode;
}
