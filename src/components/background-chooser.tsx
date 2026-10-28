"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BACKGROUND_THEMES, resolveBackgroundTheme, type BackgroundThemeId } from "../../lib/background-themes";
import "../background-chooser.css";

function backgroundOptions(themeId: BackgroundThemeId, onSelect: (themeId: BackgroundThemeId) => void, identifier: string) {
  return <fieldset><legend className="visually-hidden">五款完整背景</legend><div className="background-options">{BACKGROUND_THEMES.map(theme => <label className={`background-option${theme.id === themeId ? " background-selected" : ""}`} key={theme.id}>
    <input type="radio" name={`background-theme-${identifier}`} value={theme.id} checked={theme.id === themeId} onChange={() => onSelect(theme.id as BackgroundThemeId)} />
    <picture><source media="(max-width: 1099px)" srcSet={theme.mobile} width={theme.mobileSize[0]} height={theme.mobileSize[1]} /><img src={theme.desktop} width={theme.desktopSize[0]} height={theme.desktopSize[1]} alt="" loading="lazy" /></picture>
    <span className="background-option-label">{theme.label}{theme.id === themeId && <small>使用中</small>}</span><span className="background-option-description">{theme.description}</span>
  </label>)}</div></fieldset>;
}

export function BackgroundSettings({ themeId, onSelect }: { themeId: BackgroundThemeId; onSelect: (themeId: BackgroundThemeId) => void }) {
  const identifier = `inline-${useId().replace(/:/g, "")}`;
  return <section className="background-settings" id="background-settings" aria-labelledby={`${identifier}-heading`}>
    <div className="background-settings-heading"><h2 id={`${identifier}-heading`}>主題背景</h2><p>選擇你喜歡的頁首場景</p></div>
    {backgroundOptions(themeId, onSelect, identifier)}
  </section>;
}

export function BackgroundChooser({ themeId, onSelect }: { themeId: BackgroundThemeId; onSelect: (themeId: BackgroundThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const identifier = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const galleryRef = useRef<HTMLElement>(null);
  const selectedTheme = resolveBackgroundTheme(themeId);

  useEffect(() => {
    if (!open) return;
    const positionGallery = () => {
      const gallery = galleryRef.current;
      if (!gallery?.style || !trigger.current?.getBoundingClientRect || typeof window === "undefined") return;
      const rectangle = trigger.current.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = window.innerHeight;
      const shell = root.current?.closest<HTMLElement>(".app-shell");
      const width = Math.max(0, Math.min(660, (shell?.clientWidth ?? viewportWidth) - 24, viewportWidth - 24));
      gallery.style.width = `${width}px`;
      gallery.style.maxHeight = `${Math.max(0, viewportHeight - 24)}px`;
      const height = gallery.getBoundingClientRect().height;
      const below = viewportHeight - rectangle.bottom - 12;
      const desiredTop = below >= Math.min(height, 240) ? rectangle.bottom + 8 : rectangle.top - height - 8;
      gallery.style.left = `${Math.max(12, Math.min(rectangle.right - width, viewportWidth - width - 12))}px`;
      gallery.style.top = `${Math.max(12, Math.min(desiredTop, viewportHeight - height - 12))}px`;
    };
    positionGallery();
    galleryRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !galleryRef.current?.contains(event.target as Node)) setOpen(false); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); setOpen(false); trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    if (typeof window !== "undefined") {
      window.addEventListener("resize", positionGallery);
      window.addEventListener("scroll", positionGallery, true);
    }
    return () => {
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard);
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", positionGallery);
        window.removeEventListener("scroll", positionGallery, true);
      }
    };
  }, [open, themeId]);

  return <div className="background-chooser" ref={root} style={{ "--background-mobile-height": `${100 * selectedTheme.mobileSize[1] / selectedTheme.mobileSize[0]}cqi`, "--background-desktop-height": `${100 * selectedTheme.desktopSize[1] / selectedTheme.desktopSize[0]}cqi` } as CSSProperties}>
    <button className="background-trigger" type="button" ref={trigger} aria-expanded={open} aria-haspopup="dialog" aria-controls={`background-gallery-${identifier}`} onClick={() => setOpen(!open)}>
      <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 2a8 8 0 1 0 0 16h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.7h2A3 3 0 0 0 18 8a8 8 0 0 0-8-6Z" /><circle cx="6" cy="7" r=".7" /><circle cx="10" cy="5" r=".7" /><circle cx="14" cy="7" r=".7" /><circle cx="5" cy="11" r=".7" /></svg><span>背景</span>
    </button>
    {open && typeof document !== "undefined" && createPortal(<section className="background-gallery" ref={galleryRef} id={`background-gallery-${identifier}`} role="dialog" aria-modal="false" aria-labelledby={`background-title-${identifier}`}>
      <div className="background-gallery-heading"><h2 id={`background-title-${identifier}`}>選擇頁首背景</h2><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }}>完成</button></div>
      {backgroundOptions(themeId, onSelect, identifier)}
      <p>只儲存在此瀏覽器，不影響計時或通知。</p>
    </section>, document.body)}
  </div>;
}
