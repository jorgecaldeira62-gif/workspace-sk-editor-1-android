import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

type Status = "connecting" | "connected" | "disconnected" | "error";

interface PkgResult {
  name: string;
  description: string;
  version: string;
}

interface Props {
  onFallback?: () => void;
  externalCommand?: string;
  onCommandExecuted?: () => void;
  onCommandOutput?: (cmd: string, output: string, exitedClean: boolean) => void;
  onServerToggle?: (running: boolean, port?: number) => void;
  onBufferUpdate?: (buffer: string, hasError: boolean) => void;
  onRunningChange?: (running: boolean, cmd?: string) => void;
}

const CMD_TIMEOUT_MS = 1_140_000; // 19 minutos
const MAX_RECONNECT = 5;
const RECONNECT_DELAY_MS = 2500;

const SERVER_PORT_RE = /(?:listen(?:ing)?(?:\s+on)?(?:\s+port)?|started(?:\s+on)?|running(?:\s+on)?(?:\s+port)?|\bport\b|localhost|127\.0\.0\.1|0\.0\.0\.0|Local:|Network:|➜)\s*[:\s]*(?:https?:\/\/(?:localhost|127\.0\.0\.1))?:(\d{4,5})/i;
const SERVER_STOP_RE = /(?:SIGTERM|SIGINT|server\s+(?:closed|stopped|killed)|process\s+exit)/i;
const ERROR_RE = /(?:error|erro|exception|traceback|fatal|command not found|cannot find|failed|falhou|ENOENT|EACCES|SyntaxError|TypeError|ReferenceError|ModuleNotFoundError|ImportError)/i;

const MISSING_PKG_RES = [
  /(?:sh|bash|zsh):\s*\d*:?\s*([^\s:]+):\s*(?:not found|command not found)/i,
  /Cannot find module ['"](@?[a-zA-Z0-9._/@-]+)['"]/i,
  /Cannot find package ['"](@?[a-zA-Z0-9._/@-]+)['"]/i,
  /npm ERR! missing: ([a-zA-Z0-9@._/-]+)@/i,
  /ModuleNotFoundError: No module named ['"]([a-zA-Z0-9._-]+)['"]/i,
];
const CLI_TO_INSTALL: Record<string, string> = {
  tsx: "tsx", "ts-node": "ts-node", vite: "vite", next: "next",
  tsc: "typescript", eslint: "eslint", prettier: "prettier",
  jest: "jest", vitest: "vitest", nodemon: "nodemon",
  concurrently: "concurrently", "cross-env": "cross-env",
};

function detectMissingPkg(text: string): { pkg: string; isPip: boolean } | null {
  for (const re of MISSING_PKG_RES) {
    const m = text.match(re);
    if (m && m[1]) {
      const raw = m[1].trim();
      if (raw.startsWith(".") || raw.startsWith("/")) continue;
      const isPip = /ModuleNotFoundError/.test(text);
      const pkg = CLI_TO_INSTALL[raw] ?? raw.split("/").slice(0, raw.startsWith("@") ? 2 : 1).join("/");
      return { pkg, isPip };
    }
  }
  return null;
}

const QUICK_CMDS = [
  { label: "📦 npm install",    cmd: "npm install" },
  { label: "▶ npm run dev",     cmd: "npm run dev" },
  { label: "🔨 npm run build",  cmd: "npm run build" },
  { label: "🧪 npm test",       cmd: "npm test" },
  { label: "🚀 npm start",      cmd: "npm start" },
  { label: "📋 node index.js",  cmd: "node index.js" },
  { label: "🐍 pip install -r", cmd: "pip install -r requirements.txt" },
  { label: "🐍 python main.py", cmd: "python3 main.py" },
];

export default function RealTerminal({
  onFallback,
  externalCommand,
  onCommandExecuted,
  onCommandOutput,
  onServerToggle,
  onBufferUpdate,
  onRunningChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [runningCmd, setRunningCmd] = useState<string | null>(null);
  const [missingPkg, setMissingPkg] = useState<{ pkg: string; isPip: boolean } | null>(null);

  // ── Explicação de erros em português ────────────────────────────────────
  const [errorExplain, setErrorExplain] = useState<string | null>(null);

  // ── Busca de pacotes ─────────────────────────────────────────────────────
  const [showPkgSearch, setShowPkgSearch] = useState(false);
  const [pkgMode, setPkgMode]             = useState<"npm" | "pip">("npm");
  const [pkgQuery, setPkgQuery]           = useState("");
  const [pkgResults, setPkgResults]       = useState<PkgResult[]>([]);
  const [pkgSearching, setPkgSearching]   = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scroll tracking ──────────────────────────────────────────────────────
  const [linesAbove, setLinesAbove] = useState(0);

  // ── Refs internos ────────────────────────────────────────────────────────
  const wsRef    = useRef<WebSocket | null>(null);
  const termRef  = useRef<Terminal | null>(null);
  const runTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectFnRef = useRef<(() => void) | null>(null);
  const mountedRef   = useRef(true);
  const reconnectCountRef    = useRef(0);
  const autoReconnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keepalive do lado do cliente — evita que o proxy feche conexão por inatividade
  const clientHeartbeatRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const onServerToggleRef = useRef(onServerToggle);
  useEffect(() => { onServerToggleRef.current = onServerToggle; }, [onServerToggle]);
  const onBufferUpdateRef = useRef(onBufferUpdate);
  useEffect(() => { onBufferUpdateRef.current = onBufferUpdate; }, [onBufferUpdate]);
  const onRunningChangeRef = useRef(onRunningChange);
  useEffect(() => { onRunningChangeRef.current = onRunningChange; }, [onRunningChange]);

  const globalBufferRef      = useRef<string>("");
  const bufferFlushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCmdRef        = useRef<string | null>(null);
  const outputBufferRef      = useRef<string>("");
  const silenceTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOutputFlush = (cmd: string) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    // Para npm install/pip install: aguarda 12s de silêncio (pacotes podem demorar)
    // Para outros comandos: aguarda 5s de silêncio
    const isInstall = /npm install|pip install|yarn add|pnpm add/i.test(cmd);
    const delay = isInstall ? 12_000 : 5_000;
    silenceTimerRef.current = setTimeout(() => {
      const out = outputBufferRef.current;
      const clean = out.includes("$") || out.includes("#") || out.includes("✓") || out.includes("added ") || out.includes("Successfully installed");
      onCommandOutput?.(cmd, out, clean);
      currentCmdRef.current = null;
      outputBufferRef.current = "";
      setRunningCmd(null);
      onRunningChangeRef.current?.(false);
    }, delay);
  };

  // ── Setup do terminal (xterm + WebSocket) ────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
      theme: {
        background: "#0d0d0d", foreground: "#c8dda8", cursor: "#88c060",
        cursorAccent: "#0d0d0d", selectionBackground: "#3d5c28",
        black: "#0d0d0d", red: "#e06c75", green: "#88c060",
        yellow: "#e5c07b", blue: "#61afef", magenta: "#c678dd",
        cyan: "#56b6c2", white: "#abb2bf", brightBlack: "#5c6370",
        brightRed: "#e06c75", brightGreen: "#98c379", brightYellow: "#e5c07b",
        brightBlue: "#61afef", brightMagenta: "#c678dd", brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    termRef.current = term;
    setTimeout(() => { try { fitAddon.fit(); } catch { } }, 50);

    // Rastreia scroll para mostrar botão "ir ao fim"
    term.onScroll(() => {
      const buf = term.buffer.active;
      // viewportY = quantas linhas o usuário scrollou para cima
      const above = buf.viewportY ?? 0;
      setLinesAbove(above);
    });

    // onData lê sempre wsRef.current — sem duplicar listeners ao reconectar
    term.onData((data: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);

    // Busca URL direta ao API server (porta 8080) via /api/config para evitar
    // duplo-proxy Replit→Vite→API que impede WebSocket de funcionar no ambiente Replit.
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fallbackWsUrl = `${proto}//${window.location.host}/api/ws/terminal`;

    let wsUrl = fallbackWsUrl;

    fetch("/api/config")
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then((cfg) => {
        if (!mountedRef.current) return;
        if (cfg?.terminalWsUrl) wsUrl = cfg.terminalWsUrl;
        connectFnRef.current = connect;
        connect();
      });

    const connect = () => {
      if (!mountedRef.current) return;
      if (autoReconnTimerRef.current) { clearTimeout(autoReconnTimerRef.current); autoReconnTimerRef.current = null; }

      setStatus("connecting");
      if (reconnectCountRef.current === 0) {
        term.writeln("\x1b[90m[Conectando ao terminal...]\x1b[0m\r\n");
      } else {
        term.writeln(`\x1b[90m[Reconectando... tentativa ${reconnectCountRef.current}/${MAX_RECONNECT}]\x1b[0m\r\n`);
      }

      try { wsRef.current?.close(); } catch { }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      const connTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          if (!mountedRef.current) return;
          setStatus("error");
          term.writeln("\r\n\x1b[31m[Conexão esgotou — servidor não respondeu em 8s]\x1b[0m\r\n");
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(connTimeout);
        if (!mountedRef.current) { ws.close(); return; }
        reconnectCountRef.current = 0;
        setStatus("connected");
        term.writeln("\x1b[32m[Terminal bash conectado ✓]\x1b[0m\r\n");

        // ── Keepalive do cliente ──────────────────────────────────────────
        // Envia um byte nulo a cada 20s para manter o proxy do Replit vivo.
        // Sem isso, o proxy fecha a conexão após ~60s de inatividade de dados,
        // mesmo que o npm install ainda esteja rodando no servidor.
        if (clientHeartbeatRef.current) clearInterval(clientHeartbeatRef.current);
        clientHeartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(""); } catch { /* ok */ }
          }
        }, 20_000);

        // Setup inicial: cria pasta de projetos persistente, configura PT-BR
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              `export LANG=pt_BR.UTF-8 LC_ALL=pt_BR.UTF-8 2>/dev/null; ` +
              `mkdir -p ~/sk-projetos 2>/dev/null; ` +
              `cd ~/sk-projetos; ` +
              `echo -e "\\x1b[90m📂 Pasta de trabalho: $(pwd)\\x1b[0m"; ` +
              `echo -e "\\x1b[90m📦 Pacotes instalados aqui ficam salvos entre sessões\\x1b[0m"\n`
            );
          }
        }, 800);
      };

      ws.onmessage = (e: MessageEvent) => {
        let text = "";
        if (e.data instanceof ArrayBuffer) {
          const arr = new Uint8Array(e.data);
          term.write(arr);
          text = new TextDecoder().decode(arr);
        } else {
          term.write(e.data as string);
          text = e.data as string;
        }
        const plain = text.replace(/\x1b\[[0-9;]*[mGKHJA-Za-z]/g, "").replace(/\r/g, "");

        const missing = detectMissingPkg(plain);
        if (missing) setMissingPkg(missing);

        const portMatch = plain.match(SERVER_PORT_RE);
        if (portMatch) {
          const p = Number(portMatch[1]);
          if (p >= 1024 && p < 65535) onServerToggleRef.current?.(true, p);
        }
        if (SERVER_STOP_RE.test(plain)) onServerToggleRef.current?.(false);

        // Aumentado para 30000 — Jasmim vê erros completos sem truncar
        globalBufferRef.current = (globalBufferRef.current + plain).slice(-30000);
        const hasErr = ERROR_RE.test(plain);
        if (hasErr) {
          // Mostra explicação em português para o usuário
          const context = (globalBufferRef.current + plain).slice(-2000);
          const explain = explainErrorPt(context);
          if (explain) setErrorExplain(explain);
        } else if (/\$\s*$/.test(plain) && plain.trim().length < 10) {
          // Prompt limpo = comando ok, esconde o banner
          setErrorExplain(null);
        }
        if (bufferFlushTimerRef.current) clearTimeout(bufferFlushTimerRef.current);
        bufferFlushTimerRef.current = setTimeout(() => {
          onBufferUpdateRef.current?.(globalBufferRef.current, hasErr || ERROR_RE.test(globalBufferRef.current.slice(-1000)));
        }, 1500);

        if (currentCmdRef.current) {
          outputBufferRef.current += plain;
          scheduleOutputFlush(currentCmdRef.current);
        }
      };

      ws.onclose = () => {
        clearTimeout(connTimeout);
        if (clientHeartbeatRef.current) { clearInterval(clientHeartbeatRef.current); clientHeartbeatRef.current = null; }
        if (!mountedRef.current) return;
        setStatus("disconnected");
        setRunningCmd(null);
        onRunningChangeRef.current?.(false);
        currentCmdRef.current = null;
        term.writeln("\r\n\x1b[90m[Sessão encerrada]\x1b[0m\r\n");

        // Reconexão automática
        if (reconnectCountRef.current < MAX_RECONNECT) {
          reconnectCountRef.current++;
          term.writeln(`\x1b[90m[Reconectando em ${RECONNECT_DELAY_MS / 1000}s...]\x1b[0m\r\n`);
          autoReconnTimerRef.current = setTimeout(() => connectFnRef.current?.(), RECONNECT_DELAY_MS);
        } else {
          term.writeln("\x1b[33m[Máximo de tentativas atingido. Clique em ↺ Reconectar.]\x1b[0m\r\n");
        }
      };

      ws.onerror = () => {
        clearTimeout(connTimeout);
        if (!mountedRef.current) return;
        setStatus("error");
        setRunningCmd(null);
        term.writeln("\r\n\x1b[31m[Erro ao conectar ao servidor de terminal]\x1b[0m\r\n");
      };
    };

    return () => {
      mountedRef.current = false;
      if (autoReconnTimerRef.current) clearTimeout(autoReconnTimerRef.current);
      if (runTimerRef.current) clearTimeout(runTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (bufferFlushTimerRef.current) clearTimeout(bufferFlushTimerRef.current);
      if (clientHeartbeatRef.current) clearInterval(clientHeartbeatRef.current);
      ro.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // ── Executa comandos externos (da IA / botões de ação) ───────────────────
  useEffect(() => {
    if (!externalCommand) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const t = setTimeout(() => {
        const ws2 = wsRef.current;
        if (ws2 && ws2.readyState === WebSocket.OPEN) sendCmd(ws2, termRef.current, externalCommand);
      }, 1000);
      return () => clearTimeout(t);
    }
    sendCmd(ws, termRef.current, externalCommand);
    onCommandExecuted?.();
    return undefined;
  }, [externalCommand]);

  function sendCmd(ws: WebSocket, term: Terminal | null, cmd: string) {
    if (term) term.writeln(`\r\n\x1b[32m▶ Executando:\x1b[0m \x1b[33m${cmd}\x1b[0m`);
    setRunningCmd(cmd);
    onRunningChangeRef.current?.(true, cmd);
    currentCmdRef.current = cmd;
    outputBufferRef.current = "";
    ws.send(cmd + "\n");
    onCommandExecuted?.();
    if (runTimerRef.current) clearTimeout(runTimerRef.current);
    runTimerRef.current = setTimeout(() => {
      setRunningCmd(null);
      onRunningChangeRef.current?.(false);
      if (currentCmdRef.current === cmd) {
        const out = outputBufferRef.current.slice(0, 8000);
        onCommandOutput?.(cmd, out + "\n[Timeout — comando excedeu 10 minutos]", false);
        currentCmdRef.current = null;
        outputBufferRef.current = "";
      }
    }, CMD_TIMEOUT_MS);
  }

  const quickSend = useCallback((cmd: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    sendCmd(ws, termRef.current, cmd);
  }, []);

  const handleReconnect = () => {
    reconnectCountRef.current = 0;
    connectFnRef.current?.();
  };

  // ── Busca de pacotes npm / pip ───────────────────────────────────────────
  const searchPackages = useCallback(async (query: string, mode: "npm" | "pip") => {
    if (!query.trim() || query.length < 2) { setPkgResults([]); return; }
    setPkgSearching(true);
    try {
      if (mode === "npm") {
        const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=8`);
        if (!res.ok) throw new Error("Falha");
        const data = await res.json();
        setPkgResults((data.objects ?? []).map((o: any) => ({
          name: o.package.name,
          description: o.package.description ?? "",
          version: o.package.version ?? "",
        })));
      } else {
        const names = [query, query.replace(/-/g, "_"), query.replace(/_/g, "-")];
        const found: PkgResult[] = [];
        for (const n of names) {
          try {
            const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(n)}/json`);
            if (res.ok) {
              const { info } = await res.json();
              if (info && !found.find(x => x.name === info.name)) {
                found.push({ name: info.name, description: info.summary ?? "", version: info.version ?? "" });
              }
            }
          } catch { /* sem resultado */ }
        }
        setPkgResults(found);
      }
    } catch {
      setPkgResults([]);
    } finally {
      setPkgSearching(false);
    }
  }, []);

  const handlePkgQueryChange = (q: string) => {
    setPkgQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => searchPackages(q, pkgMode), 400);
  };

  const handlePkgModeChange = (m: "npm" | "pip") => {
    setPkgMode(m);
    setPkgResults([]);
    if (pkgQuery.trim().length >= 2) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => searchPackages(pkgQuery, m), 400);
    }
  };

  const installPkg = (name: string) => {
    const cmd = pkgMode === "npm" ? `npm install ${name}` : `pip install ${name}`;
    quickSend(cmd);
    setShowPkgSearch(false);
    setPkgQuery("");
    setPkgResults([]);
  };

  // ── Tradução de erros para português ─────────────────────────────────────
  function explainErrorPt(text: string): string | null {
    const t = text.toLowerCase();
    if (/command not found|not found.*command/i.test(text))
      return "⚠️ Comando não encontrado — o programa pode não estar instalado. Tente instalar com npm install ou pip install.";
    if (/cannot find module|module not found/i.test(text)) {
      const m = text.match(/cannot find module ['"]([^'"]+)['"]/i);
      return `⚠️ Módulo Node.js não encontrado${m ? `: "${m[1]}"` : ""}. Rode: npm install ${m?.[1] || "[nome]"}`;
    }
    if (/modulenotfounderror|no module named/i.test(text)) {
      const m = text.match(/no module named '([^']+)'/i);
      return `⚠️ Biblioteca Python não instalada${m ? `: "${m[1]}"` : ""}. Rode: pip install ${m?.[1] || "[nome]"}`;
    }
    if (/enoent/i.test(text))
      return "⚠️ Arquivo ou pasta não encontrado (ENOENT). Verifique se o caminho está correto.";
    if (/eacces|permission denied/i.test(text))
      return "⚠️ Permissão negada. O arquivo ou pasta não pode ser acessado. Verifique as permissões.";
    if (/eaddrinuse|address already in use/i.test(text)) {
      const m = text.match(/:(\d{4,5})/);
      return `⚠️ Porta${m ? ` ${m[1]}` : ""} já está em uso. Mude a porta no seu código ou pare o outro processo.`;
    }
    if (/econnrefused|connection refused/i.test(text))
      return "⚠️ Conexão recusada. O servidor não está rodando ou a porta está errada.";
    if (/syntaxerror/i.test(text))
      return "⚠️ Erro de sintaxe no código — há um erro de digitação. Verifique a linha indicada acima.";
    if (/typeerror/i.test(text))
      return "⚠️ Erro de tipo — uma variável ou valor está sendo usado de forma incorreta. Veja a linha indicada.";
    if (/referenceerror/i.test(text))
      return "⚠️ Variável ou função não definida. Verifique se o nome está certo e se foi declarada.";
    if (/importerror|cannot import/i.test(text))
      return "⚠️ Erro ao importar — a biblioteca pode não estar instalada ou o nome está errado.";
    if (/traceback/i.test(text))
      return "⚠️ Erro Python detectado. Veja as linhas acima (Traceback) para identificar onde ocorreu.";
    if (/npm err!/i.test(text))
      return "⚠️ Erro no npm. Veja a mensagem acima. Tente rodar: npm install para reinstalar as dependências.";
    if (/build failed|compilation failed/i.test(text))
      return "⚠️ A compilação falhou. Veja os erros listados acima e corrija antes de tentar de novo.";
    if (/out of memory|heap out of memory/i.test(text))
      return "⚠️ Memória insuficiente. O processo consumiu toda a RAM disponível. Reinicie o terminal.";
    if (t.includes("error") || t.includes("erro") || t.includes("exception") || t.includes("fatal"))
      return "⚠️ Erro detectado no terminal. Leia a mensagem acima para identificar o problema.";
    return null;
  }

  // ── Status visual ────────────────────────────────────────────────────────
  const statusDot: Record<Status, string> = {
    connecting:   "bg-yellow-400 animate-pulse",
    connected:    "bg-green-400",
    disconnected: "bg-gray-500 animate-pulse",
    error:        "bg-red-500",
  };
  const statusLabel: Record<Status, string> = {
    connecting:   "conectando...",
    connected:    "bash ativo",
    disconnected: "reconectando...",
    error:        "erro",
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d0d] overflow-hidden">

      {/* ── Status bar ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] border-b border-gray-700/30 shrink-0 min-h-[28px]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${statusDot[status]}`} />
        <span className="text-[11px] text-gray-500">{statusLabel[status]}</span>

        {runningCmd && (
          <div className="flex items-center gap-1.5 ml-1">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
            <span className="text-[10px] text-yellow-300 font-mono max-w-[180px] truncate">
              ⏳ {runningCmd.length > 35 ? runningCmd.slice(0, 35) + "…" : runningCmd}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Botão busca de pacotes */}
        <button
          onClick={() => { setShowPkgSearch(v => !v); setPkgQuery(""); setPkgResults([]); }}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all active:scale-95 ${
            showPkgSearch
              ? "bg-gray-800/30 text-green-300 border-green-600/50"
              : "text-gray-500 border-gray-700/30 hover:border-green-700/40 hover:text-green-400"
          }`}
          title="Buscar e instalar biblioteca"
        >
          📦 Pacotes
        </button>

        {(status === "error" || (status === "disconnected" && reconnectCountRef.current >= MAX_RECONNECT)) && (
          <button
            onClick={handleReconnect}
            className="text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-all active:scale-95 text-green-400 border-green-700/30 hover:border-green-600/50 hover:bg-green-900/10"
          >
            ↺ Reconectar
          </button>
        )}
      </div>

      {/* ── Banner de erro em português ── */}
      {errorExplain && (
        <div className="shrink-0 flex items-start gap-2 px-3 py-2 bg-[#1f0e0e] border-b border-red-800/50">
          <span className="text-[12px] text-red-300 flex-1 leading-relaxed">{errorExplain}</span>
          <button
            onClick={() => setErrorExplain(null)}
            className="text-red-700 hover:text-red-400 shrink-0 text-[11px] mt-0.5"
            title="Fechar"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Painel de busca de pacotes ── */}
      {showPkgSearch && (
        <div className="shrink-0 bg-[#111a0a] border-b border-green-700/30 px-2 py-2 flex flex-col gap-1.5">
          {/* Tabs npm / pip */}
          <div className="flex items-center gap-1">
            {(["npm", "pip"] as const).map(m => (
              <button
                key={m}
                onClick={() => handlePkgModeChange(m)}
                className={`px-3 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  pkgMode === m
                    ? "bg-green-700/50 text-green-200 border border-green-600/50"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {m === "npm" ? "📦 npm" : "🐍 pip"}
              </button>
            ))}
            <span className="text-[10px] text-gray-600 ml-auto">
              {pkgMode === "npm" ? "npmjs.com" : "pypi.org"}
            </span>
          </div>

          {/* Campo de busca */}
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={pkgQuery}
              onChange={e => handlePkgQueryChange(e.target.value)}
              placeholder={pkgMode === "npm" ? "ex: axios, lodash, react-query..." : "ex: requests, numpy, flask..."}
              className="w-full bg-[#141414] border border-gray-700/40 rounded-lg px-3 py-1.5 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-600/60 focus:ring-1 focus:ring-green-700/30"
            />
            {pkgSearching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-green-600/40 border-t-green-400 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Resultados */}
          {pkgResults.length > 0 && (
            <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto">
              {pkgResults.map(pkg => (
                <button
                  key={pkg.name}
                  onClick={() => installPkg(pkg.name)}
                  disabled={status !== "connected"}
                  className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-[#141414] hover:bg-green-900/20 border border-gray-700/30 hover:border-green-600/40 text-left transition-all group disabled:opacity-40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-green-300 font-mono">{pkg.name}</span>
                      {pkg.version && (
                        <span className="text-[9px] text-gray-600 font-mono">v{pkg.version}</span>
                      )}
                    </div>
                    {pkg.description && (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{pkg.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-green-600 group-hover:text-green-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                    instalar →
                  </span>
                </button>
              ))}
            </div>
          )}

          {!pkgSearching && pkgQuery.length >= 2 && pkgResults.length === 0 && (
            <p className="text-[11px] text-gray-600 px-1">
              {pkgMode === "pip"
                ? "Não encontrado no PyPI. Verifique o nome exato."
                : "Nenhum resultado encontrado."}
            </p>
          )}
        </div>
      )}

      {/* ── Barra de comandos rápidos ── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#111a0a] border-b border-gray-700/20 shrink-0 overflow-x-auto scrollbar-hide">
        {QUICK_CMDS.map(({ label, cmd }) => (
          <button
            key={cmd}
            onPointerDown={() => quickSend(cmd)}
            disabled={status !== "connected"}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#141414] border border-gray-700/40 text-gray-400 hover:border-green-600/50 hover:text-green-300 hover:bg-green-900/10 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
            title={cmd}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Banner: pacote faltando detectado ── */}
      {missingPkg && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-900/20 border-b border-amber-600/30 shrink-0">
          <span className="text-[11px] text-amber-300 flex-1 truncate">
            📦 <span className="font-bold font-mono">{missingPkg.pkg}</span> não encontrado
          </span>
          <button
            onPointerDown={() => {
              const cmd = missingPkg.isPip ? `pip install ${missingPkg.pkg}` : `npm install ${missingPkg.pkg}`;
              quickSend(cmd);
              setMissingPkg(null);
            }}
            className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-600/30 border border-amber-500/50 text-amber-200 hover:bg-amber-600/50 active:scale-95 transition-all"
          >
            {missingPkg.isPip ? "pip install" : "npm install"} →
          </button>
          <button
            onPointerDown={() => setMissingPkg(null)}
            className="shrink-0 text-gray-600 hover:text-gray-400 p-0.5"
          >✕</button>
        </div>
      )}

      {/* ── xterm container + botão ir ao fim ── */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={containerRef} className="w-full h-full p-1" />

        {/* Botão "Ir ao fim" — aparece quando o usuário scrollou para cima */}
        {linesAbove > 0 && (
          <button
            onPointerDown={() => {
              termRef.current?.scrollToBottom();
              setLinesAbove(0);
            }}
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414]/95 border border-green-600/50 text-green-300 text-[11px] font-bold shadow-lg hover:bg-green-900/40 active:scale-95 transition-all backdrop-blur-sm"
            title="Ir para o final do terminal"
          >
            <span className="text-[10px] text-gray-500">{linesAbove.toLocaleString()} linhas acima</span>
            <span>⬇ Fim</span>
          </button>
        )}
      </div>
    </div>
  );
}
