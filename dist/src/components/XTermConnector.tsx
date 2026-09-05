/**
 * XTermConnector — Terminal xterm.js com conexão WebSocket configurável
 * Funciona com: Termux (ttyd), qualquer servidor ws, ttyd local
 * Timeout: 19 minutos (como o SK Code Editor original)
 */
import { useEffect, useRef, useState } from "react";

const CMD_TIMEOUT_MS = 1_140_000; // 19 minutos
const MAX_RECONNECT  = 5;
const RECONNECT_DELAY_MS = 3000;

type Status = "idle" | "connecting" | "connected" | "disconnected" | "error";

interface Props {
  wsUrl: string;
  onClose: () => void;
}

function statusColor(s: Status) {
  if (s === "connected")    return "#4ade80";
  if (s === "connecting")   return "#facc15";
  if (s === "disconnected") return "#94a3b8";
  if (s === "error")        return "#f87171";
  return "#64748b";
}
function statusLabel(s: Status) {
  if (s === "connected")    return "✅ Conectado";
  if (s === "connecting")   return "⏳ Conectando...";
  if (s === "disconnected") return "🔴 Desconectado";
  if (s === "error")        return "❌ Erro";
  return "⬜ Aguardando";
}

export default function XTermConnector({ wsUrl, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status,    setStatus]    = useState<Status>("connecting");
  const [errMsg,    setErrMsg]    = useState("");
  const [reconnect, setReconnect] = useState(0);

  const wsRef    = useRef<WebSocket | null>(null);
  const termRef  = useRef<any>(null);
  const fitRef   = useRef<any>(null);
  const mountRef = useRef(true);
  const reconnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectFnRef   = useRef<(() => void) | null>(null);
  const reconnCountRef = useRef(0);

  useEffect(() => {
    mountRef.current = true;
    if (!containerRef.current) return;

    let term: any;
    let fit: any;

    // Carrega xterm.js dinamicamente
    Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
    ]).then(([{ Terminal }, { FitAddon }, { WebLinksAddon }]) => {
      if (!mountRef.current || !containerRef.current) return;

      // Importa CSS do xterm
      const link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css";
      document.head.appendChild(link);

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", "Courier New", monospace',
        theme: {
          background:   "#0d1117",
          foreground:   "#c9d1d9",
          cursor:       "#58a6ff",
          selectionBackground: "#264f78",
          black:        "#0d1117",
          red:          "#f85149",
          green:        "#3fb950",
          yellow:       "#d29922",
          blue:         "#58a6ff",
          magenta:      "#bc8cff",
          cyan:         "#39c5cf",
          white:        "#b1bac4",
          brightBlack:  "#6e7681",
          brightRed:    "#ff7b72",
          brightGreen:  "#56d364",
          brightYellow: "#e3b341",
          brightBlue:   "#79c0ff",
          brightMagenta:"#d2a8ff",
          brightCyan:   "#56d4dd",
          brightWhite:  "#f0f6fc",
        },
        scrollback: 20000,
        convertEol: false,
        allowProposedApi: true,
      });

      fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(containerRef.current!);
      termRef.current = term;
      fitRef.current  = fit;
      setTimeout(() => { try { fit.fit(); } catch {} }, 80);

      const ro = new ResizeObserver(() => {
        try { fit.fit(); } catch {}
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
          try { ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); } catch {}
        }
      });
      if (containerRef.current) ro.observe(containerRef.current);

      term.onData((data: string) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send(data); } catch {}
        }
      });

      const connect = () => {
        if (!mountRef.current) return;
        if (reconnTimerRef.current) { clearTimeout(reconnTimerRef.current); reconnTimerRef.current = null; }

        setStatus("connecting");
        if (reconnCountRef.current === 0) {
          term.writeln(`\x1b[90m[SK Terminal — Conectando a ${wsUrl}...]\x1b[0m\r\n`);
        } else {
          term.writeln(`\x1b[90m[Reconectando... ${reconnCountRef.current}/${MAX_RECONNECT}]\x1b[0m\r\n`);
        }

        try { wsRef.current?.close(); } catch {}

        let ws: WebSocket;
        try {
          ws = new WebSocket(wsUrl);
        } catch (e: any) {
          setStatus("error");
          setErrMsg(`URL inválida: ${e.message}`);
          term.writeln(`\r\n\x1b[31m[Erro: URL inválida — ${e.message}]\x1b[0m\r\n`);
          return;
        }

        wsRef.current = ws;
        ws.binaryType = "arraybuffer";

        const connTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            try { ws.close(); } catch {}
            if (!mountRef.current) return;
            setStatus("error");
            setErrMsg("Timeout — servidor não respondeu em 10s");
            term.writeln(`\r\n\x1b[31m[Timeout — verifique se o servidor está ativo]\x1b[0m\r\n`);
          }
        }, 10000);

        ws.onopen = () => {
          clearTimeout(connTimeout);
          if (!mountRef.current) { try { ws.close(); } catch {} return; }
          reconnCountRef.current = 0;
          setStatus("connected"); setErrMsg("");
          setReconnect(n => n + 1);
          term.writeln(`\x1b[32m[Conectado ✓ — ${wsUrl}]\x1b[0m`);
          term.writeln(`\x1b[90m[Timeout: 19 minutos · Reconexão automática: ${MAX_RECONNECT}x]\x1b[0m\r\n`);

          // Keepalive a cada 20s para não cair por inatividade
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try { ws.send(""); } catch {}
            }
          }, 20000);

          // Resize inicial
          setTimeout(() => {
            try { fit.fit(); } catch {}
            if (ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
              try { ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); } catch {}
            }
          }, 300);
        };

        ws.onmessage = (e: MessageEvent) => {
          if (e.data instanceof ArrayBuffer) {
            term.write(new Uint8Array(e.data));
          } else if (typeof e.data === "string" && e.data.length > 0) {
            term.write(e.data);
          }
        };

        ws.onclose = () => {
          clearTimeout(connTimeout);
          if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
          if (!mountRef.current) return;
          setStatus("disconnected");
          term.writeln(`\r\n\x1b[90m[Sessão encerrada]\x1b[0m\r\n`);

          if (reconnCountRef.current < MAX_RECONNECT) {
            reconnCountRef.current++;
            term.writeln(`\x1b[90m[Reconectando em ${RECONNECT_DELAY_MS / 1000}s...]\x1b[0m\r\n`);
            reconnTimerRef.current = setTimeout(() => connectFnRef.current?.(), RECONNECT_DELAY_MS);
          } else {
            term.writeln(`\x1b[33m[Máximo de tentativas. Clique em ↺ Reconectar.]\x1b[0m\r\n`);
          }
        };

        ws.onerror = () => {
          clearTimeout(connTimeout);
          if (!mountRef.current) return;
          setStatus("error");
          setErrMsg("Não foi possível conectar. Verifique o endereço e se o servidor está ativo.");
          term.writeln(`\r\n\x1b[31m[Erro de conexão — verifique o endereço WebSocket]\x1b[0m\r\n`);
          term.writeln(`\x1b[33m[Termux: pkg install ttyd && ttyd -p 7681 bash]\x1b[0m\r\n`);
        };
      };

      connectFnRef.current = connect;
      connect();

      return () => { ro.disconnect(); };
    });

    return () => {
      mountRef.current = false;
      if (reconnTimerRef.current) clearTimeout(reconnTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
      try { termRef.current?.dispose(); } catch {}
      termRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  const handleReconnect = () => {
    reconnCountRef.current = 0;
    connectFnRef.current?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1117" }}>
      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", background: "#161b22", borderBottom: "1px solid #30363d", flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(status), animation: status === "connecting" ? "pulse 1s infinite" : "none" }} />
        <span style={{ fontSize: 11, color: statusColor(status) }}>{statusLabel(status)}</span>
        <span style={{ fontSize: 11, color: "#6e7681", marginLeft: 4 }}>{wsUrl}</span>
        <div style={{ flex: 1 }} />
        {(status === "error" || status === "disconnected") && (
          <button onClick={handleReconnect}
            style={{ fontSize: 11, padding: "2px 10px", borderRadius: 6, border: "1px solid #388bfd", background: "transparent", color: "#388bfd", cursor: "pointer" }}>
            ↺ Reconectar
          </button>
        )}
        <button onClick={onClose}
          style={{ fontSize: 11, padding: "2px 10px", borderRadius: 6, border: "1px solid #f85149", background: "transparent", color: "#f85149", cursor: "pointer" }}>
          ✕ Fechar
        </button>
      </div>

      {/* Erro */}
      {errMsg && (
        <div style={{ padding: "6px 10px", background: "#3d1f1f", borderBottom: "1px solid #f85149", fontSize: 12, color: "#f85149", flexShrink: 0 }}>
          {errMsg}
        </div>
      )}

      {/* xterm container */}
      <div ref={containerRef} style={{ flex: 1, overflow: "hidden", padding: 4 }} />
    </div>
  );
}
