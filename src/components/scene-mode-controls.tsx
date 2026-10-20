"use client";

import { SCENE_PHASES, type SceneMode } from "../../lib/scene-time";

export function SceneModeControls({ mode, onChange }: { mode: SceneMode; onChange: (mode: SceneMode) => void }) {
  return <fieldset className="scene-mode-controls">
    <legend>場景預覽 · 香港時間</legend>
    <div className="scene-mode-buttons">
      <button type="button" aria-pressed={mode === "auto"} onClick={() => onChange("auto")}>自動</button>
      {SCENE_PHASES.map((phase) => <button key={phase.id} type="button" aria-pressed={mode === phase.id} onClick={() => onChange(phase.id)}>{phase.label}</button>)}
    </div>
    <p>早晨 06:00–11:59 · 晴日下午 12:00–17:59 · 星空夜晚 18:00–05:59</p>
  </fieldset>;
}
