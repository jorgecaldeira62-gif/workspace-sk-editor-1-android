/**
 * SKTerminal — Terminal com proxy gratuito + Termux/ttyd
 * - Sem servidor próprio (funciona no APK/PWA offline)
 * - Timeout: 2min comandos normais, 10min instalações
 * - Termux: ws://localhost:7681 via xterm.js real
 * - Proxies: allorigins, corsproxy, codetabs (gratuitos)
 */
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import type { FC } from "react";

const XTermConnector = lazy(() => import("./XTermConnector")) as FC<{ wsUrl: string; onClose: () => void }>;

const CMD_TIMEOUT_MS     = 120_000;   // 2 minutos
const INSTALL_TIMEOUT_MS = 600_000;   // 10 minutos

type Color = "green" | "red" | "yellow" | "cyan" | "blue" | "magenta" | "white" | "gray";
interface Part { text: string; color?: Color; bold?: boolean; dim?: boolean; }
interface Line { id: number; parts: Part[]; }

let _id = 0;
function mkid() { return ++_id; }
function sline(text: string, color?: Color, bold = false, dim = false): Line {
  return { id: mkid(), parts: [{ text, color, bold, dim }] };
}
function mline(...parts: Part[]): Line { return { id: mkid(), parts }; }

const COLORS: Record<Color, string> = {
  green: "#4ade80", red: "#f87171", yellow: "#fbbf24", cyan: "#22d3ee",
  blue: "#60a5fa", magenta: "#c084fc", white: "#f1f5f9", gray: "#64748b",
};

const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function proxyFetch(url: string, timeoutMs = CMD_TIMEOUT_MS): Promise<string> {
  for (let i = 0; i < PROXIES.length; i++) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), Math.min(timeoutMs, 30000));
      const r = await fetch(PROXIES[i](url), { signal: ctrl.signal });
      clearTimeout(id);
      if (r.ok) return await r.text();
    } catch {}
  }
  throw new Error("Todos os proxies falharam");
}

interface Props {
  onCommandOutput?: (cmd: string, output: string, ok: boolean) => void;
  pendingCmd?: string;
  onCmdConsumed?: () => void;
}

export default function SKTerminal({ onCommandOutput, pendingCmd, onCmdConsumed }: Props) {
  const [output, setOutput] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [termuxPanel, setTermuxPanel] = useState(false);
  const [termuxUrlInput, setTermuxUrlInput] = useState(() => localStorage.getItem("sk_termux_url") || "ws://localhost:7681");
  const [termuxUrl, setTermuxUrl] = useState(() => localStorage.getItem("sk_termux_url") || "ws://localhost:7681");
  const [termuxActive, setTermuxActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!pendingCmd) return;
    onCmdConsumed?.();
    sendCommand(pendingCmd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCmd]);

  // ─── Electron Real Terminal ───────────────────────────────────────────────
  const isElectron = !!(window as any).electronAPI?.isElectron;
  const [elecActive, setElecActive] = useState(isElectron); // auto-ativa no Electron
  const [elecOutput, setElecOutput] = useState<string>("");
  const [elecInput, setElecInput] = useState("");
  const [elecSessionId, setElecSessionId] = useState<number | null>(null);
  const [elecInfo, setElecInfo] = useState<{ shell: string; home: string; platform: string } | null>(null);
  const elecOutputRef = useRef<HTMLDivElement>(null);
  const elecInputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const elecScroll = useCallback(() => {
    setTimeout(() => { elecOutputRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 30);
  }, []);

  const startElecTerminal = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    const info = await api.info();
    setElecInfo(info);
    const result = await api.terminal.spawn();
    const { id } = result;
    setElecSessionId(id);
    setElecOutput(`[Shell: ${info.shell}]\r\n[Pasta: ${info.home}]\r\n[Plataforma: ${info.platform} ${info.arch}]\r\n\r\n`);
    const removeData = api.terminal.onData(id, (data: string) => {
      setElecOutput(o => o + data);
      elecScroll();
    });
    api.terminal.onExit(id, (code: number) => {
      setElecOutput(o => o + `\r\n[Processo encerrado com código ${code}]`);
      setElecSessionId(null);
    });
    cleanupRef.current = removeData;
    setElecActive(true);
    setTimeout(() => elecInputRef.current?.focus(), 100);
  }, [elecScroll]);

  const stopElecTerminal = useCallback(() => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (elecSessionId !== null) {
      (window as any).electronAPI?.terminal.kill(elecSessionId);
      setElecSessionId(null);
    }
    setElecActive(false);
    setElecOutput("");
  }, [elecSessionId]);

  const sendElecInput = useCallback((text: string) => {
    if (elecSessionId === null) return;
    (window as any).electronAPI?.terminal.write(elecSessionId, text);
  }, [elecSessionId]);

  const push = useCallback((...lines: Line[]) => setOutput(o => [...o, ...lines]), []);
  const scroll = useCallback(() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50), []);

  // Auto-inicia terminal real quando rodando no Electron
  useEffect(() => {
    if (isElectron) {
      startElecTerminal();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isElectron) {
      push(
        sline("╔════════════════════════════════════════════╗", "cyan"),
        sline("║  SK Terminal  ·  Proxy Mode (PWA)          ║", "cyan"),
        sline("║  Timeout: 2min cmd · 10min install         ║", "cyan"),
        sline("║  🔌 Termux: conecte Android via Wi-Fi       ║", "cyan"),
        sline("╚════════════════════════════════════════════╝", "cyan"),
        sline(""),
        sline("Comandos disponíveis:", "gray"),
        sline("  npm install <pkg>  · pip install <pkg>  · node <url>", "gray"),
        sline("  fetch <url>  · curl <url>  · help  · clear", "gray"),
        sline(""),
        sline("🔌 Clique em [Termux] para usar terminal Linux real do Android.", "yellow"),
        sline(""),
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    setHistory(h => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1);
    push(mline(
      { text: "maikon@sk", color: "green", bold: true },
      { text: ":~$ ", color: "cyan" },
      { text: cmd, color: "white" },
    ));
    scroll();

    if (cmd === "clear") { setOutput([]); return; }
    if (cmd === "help") {
      push(
        sline("Comandos disponíveis:", "cyan", true),
        sline("  fetch <url>         — busca uma URL (via proxy)", "gray"),
        sline("  curl <url>          — mesmo que fetch", "gray"),
        sline("  npm install <pkg>   — mostra como instalar (timeout 10min)", "gray"),
        sline("  pip install <pkg>   — mesmo para Python", "gray"),
        sline("  node <url>          — executa JS de uma URL", "gray"),
        sline("  clear               — limpa o terminal", "gray"),
        sline("  help                — esta ajuda", "gray"),
        sline(""),
        sline("💡 Para terminal Linux real: clique em [🔌 Termux]", "yellow"),
      );
      scroll();
      return;
    }

    setBusy(true); busyRef.current = true;
    const isInstall = /^(npm|pip|yarn|pnpm)\s+install/.test(cmd);
    const timeout = isInstall ? INSTALL_TIMEOUT_MS : CMD_TIMEOUT_MS;

    try {
      // fetch / curl
      if (/^(fetch|curl)\s+https?:\/\//.test(cmd)) {
        const url = cmd.replace(/^(fetch|curl)\s+/, "").trim();
        push(sline(`Buscando: ${url}`, "gray", false, true));
        scroll();
        const text = await proxyFetch(url, timeout);
        const lines = text.split("\n").slice(0, 40);
        lines.forEach(l => push(sline(l, "white")));
        if (text.split("\n").length > 40) push(sline(`... (${text.split("\n").length - 40} linhas omitidas)`, "gray", false, true));
        push(sline("✓ OK", "green"));
        onCommandOutput?.(cmd, text, true);
      }
      // npm / pip install info
      else if (/^(npm|pip|yarn|pnpm)\s+install/.test(cmd)) {
        push(sline(`⏳ Timeout de instalação: 10 minutos`, "yellow", false, true));
        push(sline(`Para instalar pacotes reais, use o 🔌 Termux:`, "yellow"));
        push(sline(`  1. Abra o Termux no Android`, "gray"));
        push(sline(`  2. Digite: pkg install nodejs && ${cmd}`, "gray"));
        push(sline(`  3. Clique em [🔌 Termux] para conectar`, "gray"));
        push(sline(""), sline("Ou no Replit, use o terminal do ambiente.", "gray"));
      }
      // node <url>
      else if (/^node\s+https?:\/\//.test(cmd)) {
        const url = cmd.replace(/^node\s+/, "").trim();
        push(sline(`Carregando: ${url}`, "gray", false, true));
        const code = await proxyFetch(url, timeout);
        push(sline("Código carregado. Execute no Node.js local ou Termux.", "cyan"));
        push(sline(code.slice(0, 200) + (code.length > 200 ? "..." : ""), "gray", false, true));
      }
      // ls, pwd, echo, etc (simulado)
      else if (cmd === "ls" || cmd === "ls -la" || cmd === "ls -l") {
        push(sline("assets/  index.html  src/  package.json  README.md", "white"));
      }
      else if (cmd === "pwd") { push(sline("/home/maikon/projeto", "white")); }
      else if (cmd.startsWith("echo ")) { push(sline(cmd.slice(5), "white")); }
      else if (cmd === "whoami") { push(sline("maikon", "green")); }
      else if (cmd === "date") { push(sline(new Date().toLocaleString("pt-BR"), "white")); }
      else if (cmd === "node -v" || cmd === "node --version") { push(sline("Use 🔌 Termux para Node.js real", "yellow")); }
      else if (cmd === "python3 --version" || cmd === "python --version") { push(sline("Use 🔌 Termux para Python real", "yellow")); }
      else {
        push(sline(`Comando não suportado no terminal proxy.`, "yellow"));
        push(sline(`💡 Use 🔌 Termux para comandos Linux reais.`, "cyan"));
        push(sline(`   Ou tente: fetch <url>  curl <url>  help`, "gray", false, true));
      }
    } catch (e: any) {
      push(sline(`✗ Erro: ${e.message}`, "red"));
      onCommandOutput?.(cmd, e.message, false);
    } finally {
      setBusy(false); busyRef.current = false; scroll();
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const v = input.trim();
      setInput("");
      if (v) runCommand(v);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx(i => { const n = Math.min(i + 1, history.length - 1); setInput(history[n] ?? ""); return n; });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx(i => { const n = Math.max(i - 1, -1); setInput(n === -1 ? "" : (history[n] ?? "")); return n; });
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault(); setOutput([]);
    }
  }

  // ─── Enviar comando para o terminal ativo ────────────────────────────────
  const sendCommand = useCallback((cmd: string) => {
    if (elecActive && elecSessionId !== null) {
      sendElecInput(cmd + "\n");
    } else {
      setInput(cmd);
      runCommand(cmd);
    }
  }, [elecActive, elecSessionId, sendElecInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const QUICK_CMDS = [
    { label: "npm install", cmd: "npm install" },
    { label: "npm run dev", cmd: "npm run dev" },
    { label: "install + dev", cmd: "npm install && npm run dev" },
    { label: "npm build", cmd: "npm run build" },
    { label: "node -v", cmd: "node -v" },
    { label: "ls", cmd: "ls" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1117", fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "#161b22", borderBottom: "1px solid #30363d", flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f85149" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d29922" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3fb950" }} />
        </div>
        <span style={{ fontSize: 11, color: "#8b949e", marginLeft: 4 }}>
          {elecActive ? `🖥 Shell Real — ${elecInfo?.shell ?? "iniciando..."}` : termuxActive ? "🔌 Termux conectado" : "sk-terminal — proxy"}
        </span>
        <div style={{ flex: 1 }} />
        {isElectron && (
          <button
            onClick={() => { elecActive ? stopElecTerminal() : startElecTerminal(); setTermuxActive(false); setTermuxPanel(false); }}
            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: elecActive ? "1px solid #58a6ff" : "1px solid #30363d", background: elecActive ? "#0d1f33" : "transparent", color: elecActive ? "#58a6ff" : "#c9d1d9", cursor: "pointer", fontWeight: 700 }}
          >{elecActive ? "🖥 Reconectar" : "🖥 Terminal Real (PC)"}</button>
        )}
        {!isElectron && (
          <button
            onClick={() => { setTermuxPanel(p => !p); setTermuxActive(false); setElecActive(false); }}
            style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: termuxPanel ? "1px solid #3fb950" : "1px solid #30363d", background: termuxPanel ? "#0d2114" : "transparent", color: termuxPanel ? "#3fb950" : "#8b949e", cursor: "pointer" }}
          >🔌 Termux</button>
        )}
        <button
          onClick={() => { setOutput([]); setElecOutput(""); }}
          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer" }}
        >limpar</button>
      </div>

      {/* Botões rápidos */}
      <div style={{ display: "flex", gap: 4, padding: "4px 8px", background: "#0d1117", borderBottom: "1px solid #1a2030", flexShrink: 0, overflowX: "auto" }}>
        {QUICK_CMDS.map(({ label, cmd }) => (
          <button
            key={cmd}
            onClick={() => sendCommand(cmd)}
            style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 5, whiteSpace: "nowrap",
              border: "1px solid #21262d", background: "#161b22", color: "#58a6ff",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >▶ {label}</button>
        ))}
      </div>

      {/* Electron Real Terminal */}
      {elecActive && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div
            ref={elecOutputRef}
            style={{ flex: 1, overflowY: "auto", padding: "8px 10px", background: "#0d1117", fontSize: 12, lineHeight: 1.5, fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-all", cursor: "text" }}
            onClick={() => elecInputRef.current?.focus()}
          >
            <span style={{ color: "#c9d1d9" }}>{elecOutput}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "#161b22", borderTop: "1px solid #30363d" }}>
            <span style={{ color: "#3fb950", fontWeight: 700, fontSize: 12 }}>$</span>
            <input
              ref={elecInputRef}
              value={elecInput}
              onChange={e => setElecInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const cmd = elecInput;
                  setElecInput("");
                  sendElecInput(cmd + "\n");
                } else if (e.key === "c" && e.ctrlKey) {
                  sendElecInput("\x03");
                } else if (e.key === "d" && e.ctrlKey) {
                  sendElecInput("\x04");
                } else if (e.key === "l" && e.ctrlKey) {
                  setElecOutput("");
                } else if (e.key === "Tab") {
                  e.preventDefault();
                  sendElecInput("\t");
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  sendElecInput("\x1b[A");
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  sendElecInput("\x1b[B");
                }
              }}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0f6fc", caretColor: "#58a6ff", fontFamily: "inherit", fontSize: 12 }}
              placeholder={elecSessionId ? "digite um comando e pressione Enter..." : "sessão encerrada"}
              disabled={!elecSessionId}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div style={{ padding: "2px 10px", background: "#161b22", fontSize: 10, color: "#6e7681" }}>
            Enter=executar · Ctrl+C=interromper · Ctrl+D=logout · Ctrl+L=limpar · ↑↓=histórico do shell
          </div>
        </div>
      )}

      {/* Painel Termux */}
      {termuxPanel && !termuxActive && (
        <div style={{ background: "#0d1117", borderBottom: "1px solid #1a4a2a", padding: "8px 10px", flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: "#3fb950", fontWeight: 700, marginBottom: 4 }}>🔌 Conectar ao Termux / ttyd</p>
          <p style={{ fontSize: 10, color: "#8b949e", marginBottom: 6 }}>
            No Termux: <span style={{ color: "#d29922", fontFamily: "monospace" }}>pkg install ttyd && ttyd -p 7681 bash</span>
          </p>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={termuxUrlInput}
              onChange={e => setTermuxUrlInput(e.target.value)}
              style={{ flex: 1, background: "#161b22", border: "1px solid #30363d", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "#c9d1d9", fontFamily: "monospace", outline: "none" }}
              placeholder="ws://localhost:7681"
            />
            <button
              onClick={() => { const u = termuxUrlInput.trim() || "ws://localhost:7681"; localStorage.setItem("sk_termux_url", u); setTermuxUrl(u); setTermuxActive(true); }}
              style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "#1a4a2a", border: "1px solid #3fb950", color: "#3fb950", cursor: "pointer", fontWeight: 700 }}
            >Conectar</button>
            <button onClick={() => setTermuxPanel(false)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #30363d", background: "transparent", color: "#8b949e", cursor: "pointer" }}>✕</button>
          </div>
          <p style={{ fontSize: 10, color: "#6e7681", marginTop: 4 }}>💡 Timeout: 19min · Reconexão automática · Funciona na mesma rede Wi-Fi</p>
        </div>
      )}

      {/* xterm.js Termux ativo */}
      {termuxActive && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <Suspense fallback={<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e", fontSize: 13 }}>Carregando terminal...</div>}>
            <XTermConnector wsUrl={termuxUrl} onClose={() => { setTermuxActive(false); setTermuxPanel(true); }} />
          </Suspense>
        </div>
      )}

      {/* Output proxy terminal */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "8px 10px", background: "#0d1117", cursor: "text", fontSize: 12, lineHeight: 1.6, display: (termuxActive || elecActive) ? "none" : undefined }}
        onClick={() => inputRef.current?.focus()}
      >
        {output.map(l => (
          <div key={l.id} style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {l.parts.map((p, i) => (
              <span key={i} style={{ color: p.color ? COLORS[p.color] : "#94a3b8", fontWeight: p.bold ? 700 : undefined, opacity: p.dim ? 0.55 : undefined }}>
                {p.text}
              </span>
            ))}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ color: COLORS.green, fontWeight: 700 }}>maikon@sk</span>
          <span style={{ color: COLORS.cyan }}>:~$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy || termuxActive}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0f6fc", caretColor: "#58a6ff", fontFamily: "inherit", fontSize: 12 }}
            placeholder={busy ? "executando..." : ""}
            autoComplete="off"
            spellCheck={false}
          />
          {busy && <span style={{ fontSize: 10, color: "#d29922" }}>●</span>}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      {!termuxActive && !elecActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 10px", background: "#161b22", borderTop: "1px solid #30363d", fontSize: 10, color: "#6e7681", flexShrink: 0 }}>
          <span>⌨ Enter=executar · ↑↓=histórico · Ctrl+L=limpar · 🔌=Termux real</span>
          <span style={{ marginLeft: "auto" }}>2min · install 10min</span>
        </div>
      )}
    </div>
  );
}
