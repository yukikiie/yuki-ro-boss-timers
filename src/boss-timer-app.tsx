"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiFetch, appBasePath } from "./api";
import { PrivateConnection } from "./private-connection";
import { activateApplicationWorker, isApplicationRegistration } from "./push-registration";
import { bossCatalog, bossDetails, sortBossesForDisplay } from "../lib/boss-catalog.js";
import { ReferenceCountdown } from "./components/reference-countdown";
import { AnimatedBossPortrait } from "./components/animated-boss-portrait";
import { AnimatedHeader, LivingGarden } from "./components/living-scene";
import { useScenePhase } from "../hooks/use-scene-phase";
import { SCENE_ASSETS, type SceneMode } from "../lib/scene-time";
import { ArrowRight, ArrowUpRight, Bell, BellOff, BookOpen, Check, CheckCheck, CircleHelp, Clock3, Crosshair, Diamond, LoaderCircle, Moon, MoreHorizontal, Plus, RefreshCw, ShieldCheck, Smartphone, Sparkles, Star, Sunrise, Timer, Trash2, WifiOff, X } from "lucide-react";

type Boss = {
  id: string; name: string; kind: "MVP" | "Mini"; favorite: boolean;
  status: "unknown" | "counting" | "due" | "resting" | "paused";
  dueAt: number | null; observedAt: number | null; cycle: string;
  source: "manual" | "kill" | null; respawnMinutes: number;
};
type AppState = {
  serverNow: number;
  schedule: { cycle: string; resting: boolean; nextReset: number; restStart: number };
  bosses: Boss[];
  alerts: { id: string; title: string; message: string; createdAt: number; status: string }[];
  push: { configured: boolean; publicKey: string | null; subscriptions: number; schedulerReady: boolean };
};
type View = "timers" | "notifications" | "guide";
type TimerDialog = { type: "countdown"; boss: Boss } | { type: "add" } | null;

const navigation = [
  { id: "timers" as const, label: "計時", english: "Boss timers", icon: Timer },
  { id: "notifications" as const, label: "通知中心", english: "Notifications", icon: Bell },
  { id: "guide" as const, label: "使用說明", english: "Getting started", icon: BookOpen },
];

function durationText(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map((part) => String(part).padStart(2, "0")).join(":");
}
function timeText(timestamp: number | null) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}
function localClock(timestamp: number, offset: number) {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp + offset * 3600000);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}
function isResting(timestamp: number) {
  const hour = new Date(timestamp + 8 * 3600000).getUTCHours();
  return hour >= 3 && hour < 5;
}
function publicKeyBytes(value: string) {
  const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
function PixelNavigationIcon({ view }: { view: View }) {
  return <svg className="pixel-nav-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {view === "timers" ? <><path d="M9 1H15M12 1V4M18 5L20 3" /><circle cx="12" cy="14" r="8" /><path d="M12 8V14L15 16" /></> : view === "notifications" ? <><path d="M4 17H20L18 14V9C18 5 16 3 12 3S6 5 6 9V14ZM10 21H14M12 1V3" /></> : <><path d="M10 2H14L15 5L18 6L21 5L23 9L20 11V14L22 16L20 20L17 19L14 21L13 23H9L8 20L5 19L2 20L0 16L3 14V11L1 9L3 5L6 6L9 5Z" /><circle cx="11.5" cy="12.5" r="3.5" /></>}
  </svg>;
}
function PixelHearts() {
  return <div className="pixel-hearts" aria-hidden="true">{[0, 1, 2, 3, 4].map((heart) => <svg key={heart} viewBox="0 0 16 14" className={heart === 4 ? "heart-empty" : ""}><path d="M2 0H6V2H10V0H14V2H16V8H14V10H12V12H10V14H6V12H4V10H2V8H0V2H2Z" /><path d="M2 2H6V4H2Z" className="heart-shine" /></svg>)}</div>;
}
function PixelPoring() {
  return <img className="poring-icon" src="/pixel/poring-standalone.png" alt="" width="58" height="58" />;
}
function PixelAttributeIcon({ value, race = false }: { value: string; race?: boolean }) {
  const icon = race ? value : value.slice(0, 1);
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {icon === "風" ? <><path d="M16 21C8 23 2 17 4 10C6 3 15 1 20 7C23 11 19 15 15 13C12 11 14 7 17 9" /><path d="M8 8C5 11 7 16 11 16H15C19 16 20 19 17 21M9 19L9 22" /></> :
    icon === "火" ? <><path d="M13 2C14 8 19 9 19 15C19 20 16 22 12 22S5 19 5 15C5 12 7 10 8 8C8 13 11 13 11 9C11 7 11 4 13 2Z" fill="#ff9a31" stroke="#a94c34" /><path d="M12 12C12 16 9 15 9 18C9 20 10 21 12 21S15 20 15 18C15 16 13 15 12 12Z" fill="#fff073" stroke="none" /></> :
    icon === "水" ? <><path d="M12 2C10 7 5 11 5 16C5 24 19 24 19 16C19 11 14 7 12 2Z" fill="#7ab6e5" /><path d="M8 15C7 18 9 20 11 20" stroke="#e5f8ff" /></> :
    icon === "暗" ? <path d="M16 2A10 10 0 1 0 21 18A9 9 0 0 1 16 2Z" fill="currentColor" stroke="none" /> :
    icon === "念" ? <><path d="M6 20V9C6 1 18 1 18 9V20L15 18L12 21L9 18Z" /><circle cx="10" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /></> :
    icon === "地" ? <path d="M2 21L9 7L12 13L15 3L22 21Z" fill="#a88961" /> :
    icon === "聖" || icon === "無" ? <><path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9Z" fill="#ffd667" stroke="#956321" /><path d="M4 3L5 6M20 18L21 21" stroke="#b98730" /></> :
    icon === "人形" ? <><circle cx="12" cy="5" r="3" fill="currentColor" stroke="none" /><path d="M7 22V14L5 18L3 17L6 10C8 8 16 8 18 10L21 17L19 18L17 14V22H13V16H11V22Z" fill="currentColor" stroke="none" /></> :
    icon === "無形" ? <><path d="M4 14C0 8 7 1 13 3C19 0 25 9 20 14L22 19L16 18L12 22L8 18L2 20Z" fill="currentColor" stroke="none" /><path d="M8 10H10M15 9H17M10 15H14" stroke="#f9d7e8" /></> :
    icon === "動物" ? <><ellipse cx="5" cy="9" rx="2.5" ry="3.5" fill="currentColor" stroke="none" /><ellipse cx="10" cy="5" rx="2.5" ry="3.5" fill="currentColor" stroke="none" /><ellipse cx="16" cy="5" rx="2.5" ry="3.5" fill="currentColor" stroke="none" /><ellipse cx="21" cy="10" rx="2.5" ry="3.5" fill="currentColor" stroke="none" /><path d="M6 18C6 15 9 11 13 11C17 11 20 15 20 18C20 22 16 22 13 20C10 22 6 22 6 18Z" fill="currentColor" stroke="none" /></> :
    icon === "植物" ? <><path d="M12 22V10M12 16L7 11M12 13L17 7" stroke="#8b5b36" strokeWidth="3" /><path d="M11 13C3 14 2 8 3 3C9 4 13 7 11 13Z" fill="#58a66b" stroke="#1e654c" /><path d="M13 10C12 3 18 1 22 2C22 8 19 12 13 10Z" fill="#6dbd79" stroke="#1e654c" /></> :
    icon === "惡魔" ? <><path d="M3 2L8 8C11 6 14 6 17 8L22 2L21 15C20 24 5 24 3 15Z" fill="currentColor" stroke="none" /><path d="M7 12L10 14M18 12L15 14M10 19H15" stroke="#f9d7e8" /></> :
    icon === "天使" ? <><ellipse cx="12" cy="3" rx="4" ry="1.5" stroke="#b59b42" /><path d="M12 12C7 12 6 3 2 4C0 11 4 18 12 21C20 18 24 11 22 4C18 3 17 12 12 12Z" fill="#ffe582" stroke="#a88735" /><path d="M5 9L8 15M19 9L16 15" stroke="#fff7bc" /></> :
    icon === "龍" ? <><path d="M5 3L11 7L13 2L17 7L22 8L19 13L15 13C19 23 5 25 3 17C8 21 10 17 9 13L4 11Z" fill="#dfb0bc" /><circle cx="17" cy="9" r="1" fill="currentColor" stroke="none" /></> :
    icon === "不死" ? <><path d="M5 13C-2 0 26 0 19 13L17 15V21H7V15Z" /><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none" /><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none" /><path d="M10 17V21M14 17V21" /></> :
    icon === "魚貝" || icon === "魚" ? <><path d="M2 12C7 4 13 4 18 10L23 6V18L18 14C13 20 7 20 2 12Z" fill="#96bde6" /><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" /></> : <circle cx="12" cy="12" r="8" />}
  </svg>;
}
function BossCardFrame({ featured, navigation = false }: { featured: boolean; navigation?: boolean }) {
  const width = navigation ? 422 : 455;
  const height = navigation ? 64 : featured ? 132 : 110;
  const outer = `M9 1H${width - 9}L${width - 1} 9V${height - 9}L${width - 9} ${height - 1}H9L1 ${height - 9}V9Z`;
  const inner = `M11 6H${width - 11}L${width - 6} 11V${height - 11}L${width - 11} ${height - 6}H11L6 ${height - 11}V11Z`;
  return <svg className={`boss-card-frame ${navigation ? "navigation-frame" : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><path d={outer} fill="#faf9ff" stroke="#b8e6dc" strokeWidth="6" /><path d={outer} fill="#faf9ff" stroke="#241b51" strokeWidth="3" /><path d={inner} fill="none" stroke="#d2e4ec" strokeWidth="4" /><path d={inner} fill="none" stroke="#a99dd8" strokeWidth="1.2" /></svg>;
}
function BossMetadata({ boss }: { boss: Boss }) {
  const details = bossDetails(boss);
  if (!details) return null;
  return <div className="boss-metadata" aria-label="Boss 資訊"><span className="attribute-chip chip-size" aria-label={`體型：${details.size}型`}>{details.size}</span><span className={`attribute-chip chip-element element-${details.element}`} aria-label={`屬性：${details.element}`}><PixelAttributeIcon value={details.element} />{details.element}</span><span className="attribute-chip chip-race" aria-label={`種族：${details.race}`}><PixelAttributeIcon value={details.race} race />{details.race}</span></div>;
}
function BossPortrait({ boss }: { boss: Boss }) {
  const details = bossDetails(boss);
  if (!details) return <BossSigil bossId={boss.id} index={0} />;
  return <div className={`boss-portrait portrait-${details.id}`} aria-hidden="true"><AnimatedBossPortrait spriteIndex={details.spriteIndex} /></div>;
}
function BossSigil({ bossId, index }: { bossId: string; index: number }) {
  const knownIndex = ["atroce", "lady-tanee", "boitata", "wandering-samurai"].indexOf(bossId);
  const variant = knownIndex < 0 ? index % 4 : knownIndex;
  return <div className={`boss-sigil sigil-${variant}`} aria-hidden="true"><svg viewBox="0 0 32 32" shapeRendering="crispEdges">
    {variant === 0 ? <><path fill="#8272b5" d="M4 4H10V8H22V4H28V20H25V25H21V28H11V25H7V20H4Z" /><path fill="#b6a3df" d="M7 7H10V11H22V7H25V19H22V23H19V26H13V23H10V19H7Z" /><path fill="#e9c879" d="M7 14H13V17H7ZM19 14H25V17H19Z" /><path fill="#3e2c5a" d="M10 14H13V17H10ZM19 14H22V17H19ZM13 20H19V23H13Z" /><path fill="#ede1f3" d="M10 20H13V23H10ZM19 20H22V23H19Z" /></> : variant === 1 ? <><path fill="#62b3a1" d="M13 4H19V7H25V10H29V16H23V13H19V16H13V13H9V16H3V10H7V7H13Z" /><path fill="#a0d4a8" d="M10 4H13V7H19V4H22V7H25V10H19V13H13V10H7V7H10Z" /><path fill="#e1ae62" d="M13 14H19V26H22V29H10V26H13Z" /><path fill="#fff0a9" d="M11 16H14V19H11ZM19 16H22V19H19ZM14 19H19V22H14Z" /><path fill="#8a5d57" d="M16 23H19V26H16Z" /></> : variant === 2 ? <><path fill="#bd6b84" d="M15 2H19V9H23V13H27V23H24V27H20V30H11V27H7V23H5V16H9V10H13V6H15Z" /><path fill="#ed9b72" d="M15 8H18V14H22V17H24V23H21V26H11V23H8V18H12V14H15Z" /><path fill="#f8d783" d="M16 15H19V20H21V24H18V27H13V24H11V21H15V18H16Z" /><path fill="#482b50" d="M9 16H12V19H9ZM21 17H24V20H21Z" /></> : <><path fill="#70b9bd" d="M10 4H22V7H25V13H28V16H4V13H7V7H10Z" /><path fill="#bce1d1" d="M10 7H22V10H10ZM7 13H25V16H7Z" /><path fill="#b28d9c" d="M10 16H22V23H25V29H7V23H10Z" /><path fill="#4f3e62" d="M10 17H22V20H10ZM13 23H19V29H13Z" /><path fill="#f3cf83" d="M10 17H13V20H10ZM19 17H22V20H19ZM15 3H18V9H15Z" /><path fill="#87cac4" d="M24 21H27V24H30V27H27V30H24V27H21V24H24Z" /></>}
  </svg></div>;
}

function previewState(extraDigits = false, allBosses = false): AppState {
  const timestamp = Date.UTC(2026, 9, 19, 4);
  const samples: readonly { id: string; name: string; kind: "MVP" | "Mini"; remaining: number }[] = allBosses ? bossCatalog.map((boss, index) => ({ id: boss.id, name: boss.name, kind: boss.kind === "MVP" ? "MVP" : "Mini", remaining: index < 8 ? (index + 1) * 200 : 0 })) : [
    { id: "dark-ranger", name: "暗・遊俠", kind: "Mini", remaining: extraDigits ? 369 : 200 },
    { id: "atroce", name: "阿特羅斯", kind: "MVP", remaining: extraDigits ? 1027 : 760 },
    { id: "boitata", name: "波伊塔塔", kind: "Mini", remaining: 1085 },
    { id: "lady-tanee", name: "嗒妮小姐", kind: "MVP", remaining: 1810 },
    { id: "tao-gunka", name: "塔奧群卡", kind: "MVP", remaining: 0 },
  ] as const;
  return {
    serverNow: timestamp,
    schedule: { cycle: "2026-10-19", resting: false, nextReset: timestamp + 61200000, restStart: timestamp + 54000000 },
    bosses: samples.map((boss) => ({ id: boss.id, name: boss.name, kind: boss.kind, favorite: true, status: boss.remaining ? "counting" : "unknown", dueAt: boss.remaining ? timestamp + boss.remaining * 1000 : null, observedAt: null, cycle: "2026-10-19", source: null, respawnMinutes: boss.kind === "Mini" ? 120 : 180 })),
    alerts: [],
    push: { configured: false, publicKey: null, subscriptions: 0, schedulerReady: false },
  };
}

export function BossTimerApp({ referencePreview = false, previewExtraDigits = false, previewAllBosses = false, previewSceneMode = "auto", previewTallHeader = false, onDisconnect }: { referencePreview?: boolean; previewExtraDigits?: boolean; previewAllBosses?: boolean; previewSceneMode?: SceneMode; previewTallHeader?: boolean; onDisconnect?: () => void }) {
  const [data, setData] = useState<AppState | null>(() => referencePreview ? previewState(previewExtraDigits, previewAllBosses) : null);
  const [loading, setLoading] = useState(!referencePreview);
  const [networkError, setNetworkError] = useState("");
  const [offset, setOffset] = useState(0);
  const [clock, setClock] = useState(referencePreview ? Date.UTC(2026, 9, 19, 4) : 0);
  const [view, setView] = useState<View>("timers");
  const [filter, setFilter] = useState("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dialog, setDialog] = useState<TimerDialog>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [hours, setHours] = useState("00");
  const [minutes, setMinutes] = useState("00");
  const [seconds, setSeconds] = useState("00");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"MVP" | "Mini">("MVP");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [pushConfirmed, setPushConfirmed] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [browser, setBrowser] = useState({ checked: false, supported: false, ios: false, standalone: false, permission: "default" });

  const applyState = useCallback((value: AppState) => {
    setData(value);
    setOffset(value.serverNow - Date.now());
    setClock(Date.now());
    setNetworkError("");
  }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    try { setMotionEnabled(localStorage.getItem("bosswatch.motion") !== "paused"); } catch {}
    return () => preference.removeEventListener("change", updatePreference);
  }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (referencePreview) return;
    try {
      const response = await apiFetch("/api/state", { cache: "no-store", signal });
      const result = await response.json() as AppState & { error?: string };
      if (!response.ok) throw new Error(result.error || "暫時無法取得計時資料。");
      applyState(result);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setNetworkError(error.message);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [applyState, referencePreview]);
  useEffect(() => {
    if (referencePreview) return;
    const controller = new AbortController();
    const initialRefresh = setTimeout(() => void refresh(controller.signal), 0);
    const interval = setInterval(() => void refresh(controller.signal), 15000);
    return () => { controller.abort(); clearInterval(interval); clearTimeout(initialRefresh); };
  }, [refresh, referencePreview]);
  useEffect(() => {
    if (referencePreview) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [referencePreview]);
  useEffect(() => {
    if (referencePreview) return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const supported = window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const browserTimeout = setTimeout(() => setBrowser({ checked: true, supported, ios, standalone, permission: "Notification" in window ? Notification.permission : "default" }), 0);
    if (supported) void navigator.serviceWorker.getRegistration(appBasePath).then((registration) => isApplicationRegistration(registration, appBasePath, window.location.href) ? registration!.pushManager.getSubscription() : null).then(async (existing) => {
      setSubscription(existing || null);
      if (!existing) return;
      const response = await apiFetch("/api/push/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: existing.endpoint }) });
      if (response.ok) {
        const result = await response.json() as { connected: boolean };
        setPushConfirmed(result.connected === true);
      }
    }).catch(() => {});
    return () => clearTimeout(browserTimeout);
  }, [referencePreview]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setDialog(null);
      if (event.key !== "Tab") return;
      const elements = document.querySelector<HTMLElement>(".dialog")?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [dialog, busy]);

  const now = clock ? clock + offset : 0;
  const scenePhase = useScenePhase(referencePreview ? previewSceneMode : "auto", referencePreview ? undefined : now);
  const resting = now ? isResting(now) : Boolean(data?.schedule.resting);
  const bosses = useMemo(() => data?.bosses || [], [data]);
  const favoriteCount = bosses.filter((boss) => boss.favorite).length;
  const visibleBosses = useMemo(() => {
    const filtered = bosses.filter((boss) => (filter === "All" || boss.kind === filter) && (!favoritesOnly || boss.favorite));
    return sortBossesForDisplay(filtered) as Boss[];
  }, [bosses, filter, favoritesOnly]);
  const featuredBoss = !resting ? visibleBosses.find((boss: Boss) => boss.dueAt && ["counting", "due"].includes(boss.status)) : undefined;

  async function mutate(action: string, values: Record<string, unknown> = {}, message = "設定已儲存") {
    if (referencePreview) { setToast("本機樣式預覽，不會變更真實倒數。"); return false; }
    setBusy(true); setFormError("");
    try {
      const response = await apiFetch("/api/bosses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values }) });
      const result = await response.json() as AppState & { error?: string };
      if (!response.ok) throw new Error(result.error || "未能儲存，請再試一次。");
      applyState(result); setToast(message); setMenu(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "連線失敗，變更尚未儲存。";
      setFormError(message); if (!dialog) setToast(message);
      return false;
    } finally { setBusy(false); }
  }
  function openCountdown(boss: Boss) {
    const remaining = boss.dueAt && now ? Math.max(0, Math.ceil((boss.dueAt - now) / 1000)) : 0;
    setHours(String(Math.floor(remaining / 3600)).padStart(2, "0"));
    setMinutes(String(Math.floor((remaining % 3600) / 60)).padStart(2, "0"));
    setSeconds(String(remaining % 60).padStart(2, "0"));
    setFormError(""); setMenu(null); setDialog({ type: "countdown", boss });
  }
  async function submitDialog(event: React.FormEvent) {
    event.preventDefault();
    if (dialog?.type === "countdown") {
      if ([hours, minutes, seconds].some((field) => !/^\d{1,2}$/.test(field)) || Number(minutes) > 59 || Number(seconds) > 59 || Number(hours) > 23) {
        setFormError("請輸入有效時間：小時 0–23，分鐘及秒數 0–59。"); return;
      }
      const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
      if (total < 1) { setFormError("倒數時間必須大於 0 秒。"); return; }
      if (await mutate("countdown", { bossId: dialog.boss.id, seconds: total }, `${dialog.boss.name} 的倒數已設定`)) setDialog(null);
    } else if (dialog?.type === "add") {
      if (!newName.trim()) { setFormError("請輸入 Boss 名稱。"); return; }
      if (await mutate("add", { name: newName.trim(), kind: newKind }, "已新增 Boss，接著設定倒數吧")) setDialog(null);
    }
  }
  async function connectPush() {
    if (referencePreview) return;
    setPushError("");
    if (browser.ios && !browser.standalone) { setPushError("請先將網站加入 iPhone 主畫面，再從主畫面圖示開啟。"); return; }
    if (!browser.supported) { setPushError("此瀏覽器未支援網頁推播，請使用最新 Safari 並從主畫面開啟。"); return; }
    if (!data?.push.configured || !data.push.publicKey) { setPushError("推播服務尚未完成設定，目前只能使用網頁計時。"); return; }
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setBrowser((current) => ({ ...current, permission }));
      if (permission !== "granted") throw new Error("通知權限尚未允許。請在 iPhone 的設定中允許此網頁 App 的通知。");
      const registration = await activateApplicationWorker(navigator.serviceWorker, appBasePath);
      const current = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(data.push.publicKey) });
      setSubscription(current);
      const response = await apiFetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(current.toJSON()) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "裝置未能連接到通知服務，請重試。");
      setPushConfirmed(true); setToast("此裝置已連接。請傳送測試，確認手機實際收到通知。"); void refresh();
    } catch (error) { setPushError(error instanceof Error ? error.message : "未能啟用通知。"); }
    finally { setPushBusy(false); }
  }
  async function testPush() {
    if (referencePreview) return;
    if (!subscription) return;
    setPushBusy(true); setPushError("");
    try {
      const response = await apiFetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "測試通知傳送失敗。");
      setPushConfirmed(true); setToast("測試已交給推播服務。請確認 iPhone 是否實際收到。");
    } catch (error) { setPushError(error instanceof Error ? error.message : "未能傳送測試通知。"); }
    finally { setPushBusy(false); }
  }
  async function disconnectPush() {
    if (referencePreview) return;
    if (!subscription) return;
    setPushBusy(true); setPushError("");
    try {
      const response = await apiFetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "未能停用此裝置。");
      await subscription.unsubscribe(); setSubscription(null); setPushConfirmed(false); setToast("此裝置的通知已停用"); void refresh();
    } catch (error) { setPushError(error instanceof Error ? error.message : "未能停用通知。"); }
    finally { setPushBusy(false); }
  }
  const pushReady = Boolean(subscription && pushConfirmed && data?.push.configured && data.push.schedulerReady);

  return <div className={`app-shell ${view === "timers" ? "reference-timers" : ""} ${!motionEnabled || reducedMotion ? "motion-paused" : ""}`} data-ui-version="boss-roster-v12" data-scene-phase={scenePhase} style={{ "--scene-garden-image": `url("${SCENE_ASSETS[scenePhase].garden}")` } as CSSProperties}>
    <header className={`map-masthead ${view !== "timers" ? "masthead-compact" : ""}`}>
      {view === "timers" ? <><AnimatedHeader phase={scenePhase} paused={!motionEnabled || reducedMotion} tall={!referencePreview || previewTallHeader} /><h1 className="visually-hidden">RO MVP / Mini 重生時間</h1><button className="motion-toggle" type="button" disabled={reducedMotion} aria-label={reducedMotion ? "系統已啟用減少動態效果" : motionEnabled ? "暫停所有動畫" : "播放所有動畫"} title={reducedMotion ? "系統已啟用減少動態效果" : motionEnabled ? "暫停所有動畫" : "播放所有動畫"} aria-pressed={!motionEnabled || reducedMotion} onClick={() => { const enabled = !motionEnabled; setMotionEnabled(enabled); try { localStorage.setItem("bosswatch.motion", enabled ? "playing" : "paused"); } catch {} }}><svg viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">{motionEnabled && !reducedMotion ? <path d="M3 2H7V14H3ZM10 2H14V14H10Z" /> : <path d="M3 1H5V3H8V5H11V7H14V9H11V11H8V13H5V15H3Z" />}</svg></button></> : <>
      <div className="map-art" aria-hidden="true" />
      <div className="masthead-meta"><span className="site-signature">YUKI · BOSSWATCH</span><span className={`connection-status ${networkError ? "offline" : ""}`}><span />{loading ? "連線中" : networkError ? "尚未同步" : "已同步"}</span></div>
      <div className="page-heading"><div className="title-panel"><PixelPoring /><h1>{view === "notifications" ? "通知中心" : "設定與說明"}</h1></div></div>
      </>}
      <nav className="main-nav" aria-label="主要導覽">{navigation.map((item) => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><PixelNavigationIcon view={item.id} /><span>{item.label}</span>{item.id === "notifications" && Boolean(data?.alerts.length) && <span className="nav-count">{data?.alerts.length}</span>}</button>)}</nav>
    </header>
    <div className="main-shell">
      {view === "timers" && <LivingGarden phase={scenePhase} />}
      <main className="main-content">
        <div className="dashboard-clockbar"><PixelHearts /><div className="dual-clock"><div><span>香港時間</span><strong>{localClock(now, 8)}<small>HKT</small></strong></div><span className="clock-rule" /><div><span>遊戲時間</span><strong>{localClock(now, 7)}<small>GAME</small></strong></div></div></div>
        {networkError && <div className="notice notice-error" role="alert"><WifiOff size={19} /><div><strong>連線暫時中斷</strong><p>{networkError}{data && " 畫面保留上次資料；新的提醒及變更可能無法送達。"}</p></div><button className="icon-button" aria-label="重試同步" onClick={() => void refresh()}><RefreshCw size={18} /></button></div>}

        {view === "timers" && <>
          <details className="timer-tools"><summary aria-label="計時工具，篩選與新增"><PixelNavigationIcon view="guide" /><span>計時工具</span></summary>
          <div className="cycle-strip"><div className="cycle-icon"><Sunrise size={21} strokeWidth={1.5} /></div><div><strong>每日輪替</strong><span>05:00 HKT 換日重置 <span className="cycle-dot">·</span>03:00–05:00 Boss 休眠</span></div><span className="cycle-reset">下次重置 <strong>{data && now ? durationText((data.schedule.nextReset - now) / 1000) : "--:--:--"}</strong><CircleHelp size={15} aria-label="換日會清除舊倒數，請重新確認今日 Boss" /></span></div>
          <section className="boss-section" aria-labelledby="boss-list-title"><div className="section-title"><div><h2 id="boss-list-title">我的 Boss <span>{bosses.length.toString().padStart(2, "0")}</span></h2><p>最近重生優先；未設定倒數的 Boss 排在後面，同時重生時 MVP 在前。</p></div><button className="button button-outline" disabled={!data || busy} onClick={() => { setNewName(""); setNewKind("MVP"); setFormError(""); setDialog({ type: "add" }); }}><Plus size={16} />新增 Boss</button></div>
            <div className="list-toolbar"><div className="filter-tabs" role="group" aria-label="Boss 類型">{["All", "MVP", "Mini"].map((kind) => <button key={kind} className={filter === kind ? "selected" : ""} onClick={() => setFilter(kind)}>{kind === "All" ? "全部" : kind}<span>{kind === "All" ? bosses.length : bosses.filter((boss) => boss.kind === kind).length}</span></button>)}</div><div className="list-options"><button className={favoritesOnly ? "text-control chosen" : "text-control"} onClick={() => setFavoritesOnly(!favoritesOnly)} aria-pressed={favoritesOnly}><Star size={14} fill={favoritesOnly ? "currentColor" : "none"} />最愛 <span>{favoriteCount}</span></button><span className="sort-note"><Clock3 size={14} />最近重生優先</span></div></div>
          </section></details><section className="boss-section" aria-label="依重生時間排序的 Boss">
            {loading && !data ? <div className="loading-state"><LoaderCircle className="spin" size={25} /><p>正在開啟你的計時面板…</p></div> : visibleBosses.length ? <div className="boss-grid">{visibleBosses.map((boss) => {
              const counting = Boolean(boss.dueAt && ["counting", "due"].includes(boss.status) && !resting);
              const due = counting && Boolean(now && (boss.dueAt || Infinity) <= now);
              const isAsleep = resting || boss.status === "resting";
              const featured = featuredBoss?.id === boss.id;
              return <article className={`boss-card ${featured ? "card-featured" : ""} ${counting ? "card-counting" : ""} ${due ? "card-due" : ""} ${menu === boss.id ? "card-menu-open" : ""}`} key={boss.id} aria-label={`${boss.name}，${boss.kind}${featured ? "，下一隻重生" : ""}`}>
                <BossCardFrame featured={featured} />
                {featured && <div className="featured-label">下一隻</div>}
                <div className="boss-card-top"><span className={`kind-label kind-${boss.kind.toLowerCase()}`}>{boss.kind === "MVP" ? <Diamond size={10} fill="currentColor" /> : <Sparkles size={11} />}{boss.kind}</span><div className="card-actions"><button className={`icon-button favorite-button ${boss.favorite ? "is-favorite" : ""}`} aria-label={`${boss.favorite ? "取消" : "加入"}最愛 ${boss.name}`} disabled={busy} onClick={() => void mutate("favorite", { bossId: boss.id, favorite: !boss.favorite }, boss.favorite ? "已取消最愛" : "已加入最愛")}><Star size={16} fill={boss.favorite ? "currentColor" : "none"} /></button><div className="menu-wrap"><button className="icon-button" aria-label={`${boss.name} 更多選項`} aria-expanded={menu === boss.id} onClick={() => setMenu(menu === boss.id ? null : boss.id)}><MoreHorizontal size={19} /></button>{menu === boss.id && <><button className="menu-dismiss" aria-label="關閉選單" onClick={() => setMenu(null)} /><div className="card-menu"><button disabled={busy} onClick={() => void mutate("resting", { bossId: boss.id }, `${boss.name} 已標記休眠`)}><Moon size={15} />標記休眠</button><button disabled={busy || resting} onClick={() => { if (window.confirm(`確認 ${boss.name} 剛剛被擊殺？將從現在開始 ${boss.respawnMinutes / 60} 小時倒數。`)) void mutate("kill", { bossId: boss.id }, `${boss.name} 已從擊殺時間開始倒數`); }} title={`從現在開始 ${boss.respawnMinutes / 60} 小時倒數`}><Check size={15} />剛被擊殺</button><button disabled={busy} onClick={() => void mutate("clear", { bossId: boss.id }, "倒數已清除")}><RefreshCw size={15} />清除倒數</button><button className="danger-text" disabled={busy} onClick={() => { if (window.confirm(`移除 ${boss.name}？此 Boss 的倒數也會清除。`)) void mutate("remove", { bossId: boss.id }, "Boss 已移除"); }}><Trash2 size={15} />移除 Boss</button></div></>}</div></div></div>
                <div className="boss-portrait-wrap"><BossPortrait boss={boss} /></div>
                <div className="boss-identity"><div className="boss-name-row"><h3 className={Array.from(boss.name).length > 4 ? "boss-name-long" : undefined} title={boss.name}>{boss.name}</h3><BossMetadata boss={boss} /></div><div className={`boss-status ${due ? "status-due" : counting ? "status-counting" : ""}`}><span />{isAsleep ? "休眠中" : due ? "預計已出現" : counting ? "倒數中" : "等待設定"}<span className="respawn-duration">{boss.respawnMinutes / 60} 小時重生</span></div></div>
                <div className="boss-countdown"><strong className={!counting ? "empty-countdown" : ""}><ReferenceCountdown value={counting && now ? durationText(((boss.dueAt || now) - now) / 1000) : "--:--:--"} /></strong><p>{isAsleep ? "下一次輪替後，重新確認此 Boss" : counting ? <>預計出現 <span>{timeText(boss.dueAt)} HKT</span></> : "輸入遊戲中的實際倒數"}</p></div>
                <div className="card-button-row"><button className="button button-card" aria-label={`${boss.name} 設定倒數`} disabled={busy || resting} onClick={() => openCountdown(boss)}>設定倒數</button></div>
              </article>;
            })}</div> : <div className="empty-list"><Crosshair size={30} strokeWidth={1} /><h3>{"這裡還沒有 Boss"}</h3><p>{favoritesOnly ? "為 Boss 點亮星號，或關閉「只看最愛」。" : "新增你想追蹤的 Boss，再輸入遊戲中的實際時間。"}</p></div>}
          </section>
          <section className="phone-panel"><div className="phone-illustration" aria-hidden="true"><Smartphone size={31} strokeWidth={1.5} /><span><Bell size={13} fill="currentColor" /></span></div><div className="phone-copy"><h3>iPhone 提醒</h3><p>將 10 分鐘、5 分鐘及出現提醒，送到你的 iPhone。</p></div><button className="button button-dark" onClick={() => setView("notifications")}>設定手機通知 <ArrowUpRight size={16} /></button></section>
          <div className="manual-notice"><ShieldCheck size={15} /><p>手動計時版，不會讀取或操作遊戲。每日 05:00 HKT 清除舊倒數，請確認新輪替後重新設定。Cloudflare 每分鐘檢查提醒；無須開著電腦，手機仍需網路與通知權限。</p></div>
        </>}

        {view === "notifications" && <div className="notifications-layout"><section className="settings-panel"><div className="settings-panel-heading"><span className="settings-icon"><Smartphone size={25} strokeWidth={1.5} /></span><div><p className="eyebrow">PHONE NOTIFICATIONS</p><h2>連接你的 iPhone</h2></div><span className={`device-badge ${pushReady ? "device-ready" : ""}`}><span />{pushReady ? "已連接" : subscription ? "請驗證" : "尚未連接"}</span></div>
          <p className="settings-intro">設定完成後，網站與電腦都不必一直開著。Cloudflare 會每分鐘檢查倒數提醒，手機需保持網路連線並允許通知。</p>
          <div className={`scheduler-status ${data?.push.schedulerReady ? "scheduler-online" : ""}`}><span /><strong>雲端背景提醒{data?.push.schedulerReady ? "已就緒" : "未就緒"}</strong><span>{data?.push.schedulerReady ? "Cloudflare 每分鐘檢查" : "請確認雲端通知服務設定"}</span></div>
          <div className="reminder-milestones">{[{ time: "10", caption: "分鐘前", label: "準備出發" }, { time: "05", caption: "分鐘前", label: "就快到了" }, { time: "00", caption: "出現時", label: "冒險開始" }].map((milestone) => <div key={milestone.time}><Bell size={15} /><strong>{milestone.time}<small>{milestone.caption}</small></strong><span>{milestone.label}</span></div>)}</div>
          {browser.ios && !browser.standalone && <div className="ios-instructions"><div><span className="step-number">1</span><p>在 <strong>Safari</strong> 開啟此網站，點選分享按鈕。</p></div><div><span className="step-number">2</span><p>選擇 <strong>「加入主畫面」</strong>，再從新圖示開啟。</p></div><div><span className="step-number">3</span><p>回到這裡點選「允許通知」，並傳送測試。</p></div><span className="ios-note">iPhone 須使用 iOS 16.4 或更新版本。</span></div>}
          {data && !data.push.configured && <div className="notice notice-warm"><CircleHelp size={19} /><div><strong>手機推播尚未啟用</strong><p>網頁倒數可以使用；推播服務完成設定前，不會向手機發送通知。</p></div></div>}
          {data?.push.configured && !data.push.schedulerReady && <div className="notice notice-warm"><Clock3 size={19} /><div><strong>背景提醒服務尚未就緒</strong><p>可連接裝置及測試推播，但請勿依賴自動倒數提醒。</p></div></div>}
          {subscription && !pushConfirmed && <p className="subscription-note">此瀏覽器已有通知訂閱。請重新連接或發送測試，確認它已連接到你的帳戶。</p>}
          {pushError && <p className="inline-error" role="alert">{pushError}</p>}
          <div className="push-actions"><button className="button button-dark" disabled={pushBusy || !data?.push.configured || Boolean(browser.ios && !browser.standalone)} onClick={() => void connectPush()}>{pushBusy ? <LoaderCircle size={16} className="spin" /> : <Bell size={16} />}{pushConfirmed ? "重新連接通知" : "允許通知 · 連接此裝置"}</button>{subscription && <button className="button button-outline" disabled={pushBusy} onClick={() => void testPush()}>傳送測試 <ArrowUpRight size={15} /></button>}</div>
          {subscription && <button className="disconnect-link" disabled={pushBusy} onClick={() => void disconnectPush()}><BellOff size={13} />停用此裝置的通知</button>}
          {browser.checked && !browser.supported && !(browser.ios && !browser.standalone) && <p className="inline-error">此瀏覽器目前不支援網頁推播。請更新系統，並使用支援推播的瀏覽器。</p>}
          <div className="notification-disclaimer"><ShieldCheck size={15} /><p>雲端每分鐘檢查，並非秒級提醒。測試成功僅表示通知已交給推播服務，請在手機確認實際收到。專注模式、網路或省電設定可能延遲通知。03:00–05:00 HKT 休眠時段不發 Boss 提醒。</p></div>
        </section><section className="recent-alerts"><div className="section-title"><div><h2>最近提醒 <span>{data?.alerts.length || 0}</span></h2><p>伺服器建立的提醒紀錄</p></div><Bell size={18} /></div>{data?.alerts.length ? <div className="alert-list">{data.alerts.slice(0, 20).map((alert) => <article key={alert.id}><span className="alert-icon"><Bell size={16} /></span><div><strong>{alert.title}</strong><p>{alert.message}</p><span>{timeText(alert.createdAt)} HKT <span>·</span>{["sent", "accepted"].includes(alert.status) ? "已交給推播服務" : alert.status === "failed" ? "傳送失敗" : alert.status === "pending" ? "等待傳送" : alert.status === "no_subscription" ? "沒有已連接裝置" : "已建立"}</span></div></article>)}</div> : <div className="alerts-empty"><div><Bell size={28} strokeWidth={1} /><span /></div><h3>好消息，還在路上。</h3><p>設定倒數後，提醒紀錄會出現在這裡。</p></div>}</section></div>}

        {view === "guide" && <div className="guide-layout"><section className="guide-intro"><div className="eyebrow">THREE STEPS. ALL SET.</div><h2>設定一次，<br /><span>把等待交給倒數。</span></h2><p>先做好計時和通知，遊戲仍然由你掌控。這個版本不會自動辨識 Boss 或執行遊戲操作。</p><button className="button button-dark" onClick={() => setView("timers")}>回到我的計時 <ArrowRight size={16} /></button></section><div className="guide-steps"><article><span className="guide-step">01</span><div><Timer size={22} /><h3>輸入每一隻的實際倒數</h3><p>在遊戲內確認 Boss 名稱和剩餘時間，點選「設定倒數」。每一隻都獨立計時，不會套用同一個時間。</p></div></article><article><span className="guide-step">02</span><div><CheckCheck size={22} /><h3>剛擊殺？一按重新開始</h3><p>確定 Boss 剛剛死亡後，選擇「剛被擊殺」。Mini 從 2 小時、MVP 從 3 小時開始倒數。若與遊戲顯示不同，請用實際倒數覆蓋。</p></div></article><article><span className="guide-step">03</span><div><Smartphone size={22} /><h3>把提醒送到你的 iPhone</h3><p>用 Safari 加入主畫面，從圖示開啟並允許通知。Cloudflare 會每分鐘檢查提醒，無須開著電腦。先傳送測試，確認手機收到，再依賴正式提醒。</p><button className="inline-link" onClick={() => setView("notifications")}>前往設定通知 <ArrowUpRight size={14} /></button></div></article></div><section className="settings-panel private-account-settings"><h3>私人連接</h3><p>計時資料與原本網站分開儲存。更換連接碼或使用共用裝置時，請先中斷連接。已啟用的通知不會因此停用；若不想再收到，請先到通知中心停用此裝置。</p><button className="button button-outline" type="button" onClick={onDisconnect}>中斷連接／更換連接碼</button></section><section className="daily-guide"><Moon size={27} strokeWidth={1.3} /><div><h3>每天 05:00 HKT，重新確認新輪替。</h3><p>遊戲時間比香港慢 1 小時。Boss 休眠為遊戲 02:00–04:00，即香港 03:00–05:00；休眠期間停止提醒。香港 05:00 換日清除昨日倒數，新的 Boss 不會自動從 2 或 3 小時開始。</p></div></section></div>}
        <footer className="footer"><a href={appBasePath} aria-label="Bosswatch 首頁">YUKI · BOSSWATCH</a><span>獨立計時工具 · 非官方遊戲服務 <span className="footer-dot">·</span>HKT / UTC+8</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="手機主要導覽"><BossCardFrame featured={false} navigation />{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} aria-label={item.id === "guide" ? "設定與使用說明" : item.label} onClick={() => { setView(item.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}><PixelNavigationIcon view={item.id} /><span>{item.id === "guide" ? "設定" : item.id === "notifications" ? "通知" : item.label}</span></button>)}</nav>
    {dialog && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !busy) setDialog(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close icon-button" disabled={busy} aria-label="關閉視窗" onClick={() => setDialog(null)}><X size={20} /></button><span className="dialog-symbol">{dialog.type === "countdown" ? <Timer size={25} /> : <Plus size={25} />}</span><p className="eyebrow">{dialog.type === "countdown" ? "SET YOUR COUNTDOWN" : "A NEW ADVENTURE"}</p><h2 id="dialog-title">{dialog.type === "countdown" ? dialog.boss.name : "新增你的 Boss"}</h2><p className="dialog-description">{dialog.type === "countdown" ? "請輸入遊戲中目前顯示的剩餘時間。" : "加入想追蹤的 Boss，建立獨立倒數。"}</p><form onSubmit={(event) => void submitDialog(event)}>{dialog.type === "countdown" ? <><div className="duration-inputs">{[{ label: "小時", value: hours, change: setHours }, { label: "分鐘", value: minutes, change: setMinutes }, { label: "秒", value: seconds, change: setSeconds }].map((field, index) => <div key={field.label}><label>{field.label}<input aria-label={field.label} type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} value={field.value} onFocus={(event) => event.target.select()} onChange={(event) => field.change(event.target.value.replace(/\D/g, "").slice(0, 2))} autoFocus={index === 0} disabled={busy} /></label>{index < 2 && <span>:</span>}</div>)}</div><div className="form-tip"><Bell size={14} /><p>只建立尚未經過的提醒；不補發已錯過的 10 或 5 分鐘通知。</p></div>{resting && <p className="inline-error">目前是每日休眠時段，請 05:00 HKT 後確認新輪替。</p>}</> : <div className="add-fields"><label>Boss 名稱<input autoFocus maxLength={40} placeholder="例如：阿特羅斯" value={newName} onChange={(event) => setNewName(event.target.value)} disabled={busy} /></label><label>類型<select value={newKind} onChange={(event) => setNewKind(event.target.value as "MVP" | "Mini")} disabled={busy}><option value="MVP">MVP · 擊殺後 3 小時</option><option value="Mini">Mini · 擊殺後 2 小時</option></select></label></div>}{formError && <p className="inline-error" role="alert">{formError}</p>}<button className="button button-dark dialog-submit" type="submit" disabled={busy || (dialog.type === "countdown" && resting)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{busy ? "儲存中…" : dialog.type === "countdown" ? "開始倒數" : "新增 Boss"}</button><button className="dialog-cancel" type="button" disabled={busy} onClick={() => setDialog(null)}>取消</button></form></section></div>}
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button className="icon-button" aria-label="關閉提示" onClick={() => setToast("")}><X size={15} /></button></div>}
  </div>;
}

export default function Home() { return <PrivateConnection>{(disconnect) => <BossTimerApp onDisconnect={disconnect} />}</PrivateConnection>; }
