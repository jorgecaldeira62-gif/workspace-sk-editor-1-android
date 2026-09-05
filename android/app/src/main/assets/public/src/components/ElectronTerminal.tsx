/**
 * ElectronTerminal — Terminal real via /api/exec-stream (SSE)
 * Funciona no app Electron (standalone, sem Replit).
 * Roda npm install, npm run dev, python, git, etc. de verdade.
 * Detecta porta do servidor → chama onServerDetected(port).
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, Trash2, Terminal, Loader2, CheckCircle, XCircle, Wifi } from "lucide-react";

interface TermLine {
  text: string;
  type: "stdout" | "stderr" | "info" | "success" | "error";
  ts: number;
}

interface Props {
  cwd?: string;
  projectKey?: string;
  initialCommand?: string;
  externalCommand?: string;       // Comando enviado por botões externos (auto-executa)
  onCmdConsumed?: () => void;     // Chamado após executar externalCommand
  onServerDetected?: (port: number) => void;
  onCommandDone?: (exitCode: number) => void;
}

const LINE_COLORS: Record<TermLine["type"], string> = {
  stdout: "text-gray-200",
  stderr: "text-red-300",
  info: "text-cyan-400",
  success: "text-green-400",
  error: "text-red-400",
};

// Detecta auto-complete de provider baseado na chave
function detectProvider(key: string): string {
  if (key.startsWith("sk-ant-")) return "Anthropic Claude";
  if (key.startsWith("AIza")) return "Google Gemini";
  if (key.startsWith("gsk_")) return "Groq";
  if (key.startsWith("pplx-")) return "Perplexity";
  if (key.startsWith("sk-")) return "OpenAI";
  return "Custom";
}

export default function ElectronTerminal({ cwd, projectKey, initialCommand, externalCommand, onCmdConsumed, onServerDetected, onCommandDone }: Props) {
  const [lines, setLines] = useState<TermLine[]>([
    { text: "Terminal pronto. Digite um comando ou clique em ▶ Iniciar.", type: "info", ts: Date.now() },
  ]);
  const [input, setInput] = useState(initialCommand || "");
  const [running, setRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((text: string, type: TermLine["type"] = "stdout") => {
    setLines(prev => [...prev.slice(-800), { text, type, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  // Roda initialCommand uma vez ao montar
  useEffect(() => {
    if (initialCommand) {
      setTimeout(() => runCommand(initialCommand), 300);
    }
  }, []); // eslint-disable-line

  // Reage a externalCommand enviado por botões (AI, PackageSearch, etc.)
  useEffect(() => {
    if (!externalCommand || !externalCommand.trim()) return;
    setTimeout(() => {
      runCommand(externalCommand);
      onCmdConsumed?.();
    }, 150);
  }, [externalCommand]); // eslint-disable-line

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || running) return;

    // Adiciona ao histórico
    setHistory(h => [cmd, ...h.filter(x => x !== cmd)].slice(0, 50));
    setHistIdx(-1);
    setInput("");

    push(`$ ${cmd}`, "info");
    setRunning(true);

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/exec-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, cwd: cwd || undefined, projectKey: projectKey || "default" }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        push(`Erro HTTP ${res.status}`, "error");
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "stdout") {
              push(msg.data, "stdout");
            } else if (msg.type === "stderr") {
              push(msg.data, "stderr");
            } else if (msg.type === "server_detected") {
              const port = msg.data?.port ?? msg.data;
              setServerPort(port);
              push(`\n✅ Servidor detectado na porta ${port}!`, "success");
              push(`   Preview: /api/proxy/${port}/`, "info");
              onServerDetected?.(port);
            } else if (msg.type === "exit") {
              const code = msg.data?.exitCode ?? 0;
              if (code === 0) push(`\n✓ Comando concluído com sucesso.`, "success");
              else push(`\n✗ Saiu com código ${code}`, "error");
              onCommandDone?.(code);
              setRunning(false);
            } else if (msg.type === "server_stopped") {
              push(`\nServidor parou.`, "info");
              setServerPort(null);
              setRunning(false);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        push(`\nErro de conexão: ${e?.message || e}`, "error");
      }
      setRunning(false);
    }
  }, [running, cwd, projectKey, push, onServerDetected, onCommandDone]);

  const stopServer = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    if (projectKey) {
      try {
        await fetch("/api/exec-stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectKey: projectKey || "default" }),
        });
      } catch {}
    }
    setRunning(false);
    setServerPort(null);
    push("\n⬛ Processo interrompido.", "info");
  }, [projectKey, push]);

  const clear = useCallback(() => {
    setLines([{ text: "Terminal limpo.", type: "info", ts: Date.now() }]);
  }, []);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx < 0 ? "" : history[idx] || "");
    } else if (e.key === "c" && e.ctrlKey) {
      stopServer();
    }
  };

  // Comandos rápidos baseados em tipo de projeto
  const quickCmds = [
    { label: "▶ npm install", cmd: "npm install" },
    { label: "🚀 npm run dev", cmd: "npm run dev" },
    { label: "🏗 npm run build", cmd: "npm run build" },
    { label: "▶ Install + Dev", cmd: "npm install && npm run dev" },
    { label: "node -v", cmd: "node -v && npm -v" },
    { label: "ls", cmd: "ls -la" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d1117] font-mono text-[12px]">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#161b22] border-b border-gray-700/50 shrink-0">
        <Terminal size={12} className="text-green-400" />
        <span className="text-[11px] font-bold text-green-300">Terminal Real</span>
        {running && (
          <span className="flex items-center gap-1 ml-1">
            <Loader2 size={10} className="animate-spin text-amber-400" />
            <span className="text-[10px] text-amber-400">executando...</span>
          </span>
        )}
        {serverPort && (
          <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-green-900/40 border border-green-600/30">
            <Wifi size={9} className="text-green-400" />
            <span className="text-[10px] text-green-300 font-bold">:{serverPort}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {running ? (
            <button onClick={stopServer} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-900/40 border border-red-600/40 text-red-300 hover:bg-red-900/60">
              <Square size={9} /> Parar
            </button>
          ) : null}
          <button onClick={clear} className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Quick commands */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#0d1117] border-b border-gray-700/30 shrink-0 overflow-x-auto scrollbar-none">
        {quickCmds.map(q => (
          <button
            key={q.cmd}
            onClick={() => runCommand(q.cmd)}
            disabled={running}
            className="flex-shrink-0 px-2 py-0.5 rounded text-[10px] bg-gray-800/60 border border-gray-700/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 disabled:opacity-40 transition-colors"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0">
        {lines.map((line, i) => (
          <pre
            key={i}
            className={`whitespace-pre-wrap break-all leading-relaxed ${LINE_COLORS[line.type]}`}
            style={{ fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: "11.5px" }}
          >
            {line.text}
          </pre>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#161b22] border-t border-gray-700/50 shrink-0">
        <span className="text-green-400 shrink-0">$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="npm install && npm run dev"
          disabled={running}
          className="flex-1 bg-transparent text-gray-200 outline-none placeholder-gray-700 text-[12px]"
          style={{ fontFamily: "'Fira Code', 'Consolas', monospace" }}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() => running ? stopServer() : runCommand(input)}
          className={`p-1 rounded transition-colors ${running ? "text-red-400 hover:bg-red-900/20" : "text-green-400 hover:bg-green-900/20"}`}
        >
          {running ? <Square size={13} /> : <Play size={13} />}
        </button>
      </div>
    </div>
  );
}
