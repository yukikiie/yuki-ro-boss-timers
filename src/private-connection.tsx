import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiClient, appBasePath } from "./api";

export function PrivateConnection({ children }: { children: (disconnect: () => void) => ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const disconnected = () => {
      if (!active) return;
      setConnected(false);
      setCode("");
      setError("請重新輸入私人連接碼。舊的計時資料已隱藏。");
    };
    window.addEventListener("bosswatch-disconnected", disconnected);
    const remembered = apiClient.rememberedCode();
    if (remembered) void apiClient.connect(remembered).then(() => { if (active) setConnected(true); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "未能連接私人計時服務。");
    }).finally(() => { if (active) setChecking(false); });
    else setChecking(false);
    return () => { active = false; window.removeEventListener("bosswatch-disconnected", disconnected); };
  }, []);

  function disconnect() {
    apiClient.disconnect();
    setConnected(false);
    setCode("");
    setError("");
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiClient.connect(code);
      setCode("");
      setConnected(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "未能連接私人計時服務。"); }
    finally { setBusy(false); }
  }

  if (connected) return children(disconnect);
  return <main className="private-connection"><section className="private-connection-card" aria-labelledby="connection-heading">
    <img src={`${appBasePath}pixel/poring-standalone.png`} width="72" height="72" alt="粉紅波利" />
    <p className="eyebrow">YUKI · BOSSWATCH · GITHUB</p><h1 id="connection-heading">你的私人 Boss 計時</h1>
    <p>這是獨立的 GitHub 版本。輸入私人連接碼後，才會顯示你的計時資料。</p>
    {checking ? <p role="status">正在連接你的計時面板…</p> : <form onSubmit={(event) => void connect(event)}>
      <label htmlFor="connection-code">私人連接碼</label><input id="connection-code" name="connection-code" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={43} maxLength={43} required value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} aria-describedby="connection-help" autoFocus />
      <p id="connection-help">只在你信任的裝置連接。連接碼會儲存在此瀏覽器，不會放在網址內。請勿分享。</p>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? "連接中…" : "連接私人計時"}</button>
    </form>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <p className="connection-footnote">GitHub 只提供網站畫面；私人資料與背景通知由 Cloudflare 處理。原本的網站不會改動。</p>
  </section></main>;
}
