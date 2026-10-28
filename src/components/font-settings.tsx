"use client";

import { useId } from "react";
import { FONT_STYLES, type FontPreferences, type TextPreferences } from "../../lib/font-preferences";
import "../font-settings.css";

export function FontSettings({ preferences, onChange, onReset }: {
  preferences: FontPreferences;
  onChange: (target: "names" | "ui", patch: Partial<TextPreferences>) => void;
  onReset: () => void;
}) {
  const identity = useId();
  return <section className="font-settings" id="font-settings" aria-labelledby={`${identity}-heading`}>
    <div className="font-settings-heading"><div><h2 id={`${identity}-heading`}>文字樣式</h2><p>只儲存在此瀏覽器</p></div><button type="button" className="font-reset" onClick={onReset}>恢復預設</button></div>
    <div className="font-settings-targets">{(["names", "ui"] as const).map(target => {
      const value = preferences[target];
      const title = target === "names" ? "Boss 名稱" : "介面文字";
      return <fieldset key={target}><legend>{title}</legend>
        <label className="font-style-field">字體<select aria-label={`${title}字體`} value={value.style} onChange={event => onChange(target, { style: event.target.value as TextPreferences["style"] })}>{FONT_STYLES.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
        <label className="font-size-field"><span>大小 <output>{value.size}{target === "names" ? " px" : "%"}</output></span><input type="range" aria-label={`${title}大小`} min={target === "names" ? 14 : 85} max={target === "names" ? 20 : 125} step={target === "names" ? 1 : 5} value={value.size} onChange={event => onChange(target, { size: Number(event.target.value) })} /></label>
        <div className="font-toggle-fields"><label><input type="checkbox" checked={value.bold !== false} onChange={event => onChange(target, { bold: event.target.checked })} /><span>粗體</span></label><label><input type="checkbox" checked={value.italic} onChange={event => onChange(target, { italic: event.target.checked })} /><span>斜體</span></label></div>
      </fieldset>;
    })}</div>
  </section>;
}
