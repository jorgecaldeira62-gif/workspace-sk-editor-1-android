import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Mic, MicOff, Trash2, Download, Check, Copy } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface OutputChunk {
  type: "stdout" | "stderr";
  text: string;
}

interface Entry {
  id: number;
  command: string;
  chunks: OutputChunk[];
  running: boolean;
  exitCode: number | null;
  durationMs: number;
  missingPackage: string | null;
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

// ─── Detecta pacote faltando ──────────────────────────────────────────────────
const CLI_TO_PKG: Record<string, string> = {
  tsx: "tsx", "ts-node": "ts-node", vite: "vite", next: "next",
  tsc: "typescript", eslint: "eslint", prettier: "prettier",
  jest: "jest", vitest: "vitest", nodemon: "nodemon",
  concurrently: "concurrently", "cross-env": "cross-env",
};

function detectMissing(text: string): string | null {
  const shell = text.match(/(?:sh|bash|zsh):\s*\d*:?\s*([^\s:]+):\s*(?:not found|command not found)/);
  if (shell && CLI_TO_PKG[shell[1]]) return "__deps__";
  const mod = text.match(/Cannot find (?:module|package) ['"](@?[a-zA-Z0-9._/-]+)['"]/);
  if (mod) { const m = mod[1]; if (!m.startsWith(".") && !m.startsWith("/")) return m.split("/").slice(0, m.startsWith("@") ? 2 : 1).join("/"); }
  const npm = text.match(/npm ERR! missing: ([a-zA-Z0-9@._/-]+)@/);
  if (npm) return npm[1].split("/").slice(0, npm[1].startsWith("@") ? 2 : 1).join("/");
  return null;
}

const ERROR_RE = /(?:error|erro|exception|traceback|fatal|command not found|cannot find|failed|falhou|ENOENT|EACCES|SyntaxError|TypeError|ReferenceError|ModuleNotFoundError)/i;

// ─── Voice hook ───────────────────────────────────────────────────────────────
function useVoice(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "pt-BR"; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start(); recRef.current = rec; setListening(true);
  }, [listening, onResult]);
  return { listening, toggle };
}

// ─── Comandos rápidos ─────────────────────────────────────────────────────────
const QUICK = [
  { label: "npm install", cmd: "npm install" },
  { label: "npm run dev", cmd: "npm run dev" },
  { label: "npm run build", cmd: "npm run build" },
  { label: "npm start", cmd: "npm start" },
  { label: "node index.js", cmd: "node index.js" },
  { label: "python3 main.py", cmd: "python3 main.py" },
  { label: "pip install -r", cmd: "pip install -r requirements.txt" },
  { label: "ls -la", cmd: "ls -la" },
];

// ─── Formata duração ──────────────────────────────────────────────────────────
function fmtDur(ms: number) {
  if (ms >= 60000) return `${Math.round(ms / 1000)}s`;
  if (ms >= 1000)  return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function getBase() {
  return (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function StreamTerminal({
  externalCommand,
  onCommandExecuted,
  onCommandOutput,
  onServerToggle,
  onBufferUpdate,
  onRunningChange,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showPkgSearch, setShowPkgSearch] = useState(false);
  const [pkgMode, setPkgMode] = useState<"npm" | "pip">("npm");
  const [pkgQuery, setPkgQuery] = useState("");
  const [pkgResults, setPkgResults] = useState<{ name: string; description: string; version: string }[]>([]);
  const [pkgSearching, setPkgSearching] = useState(false);
  const [lastExtCmd, setLastExtCmd] = useState<string | undefined>();
  // Suporte a stdin interativo
  const [stdinInput, setStdinInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const stdinRef = useRef<HTMLInputElement>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const entryCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<string>("");
  const bufTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { listening, toggle: toggleVoice } = useVoice((t) => {
    setInput(prev => prev ? prev + " " + t : t);
    setTimeout(() => inputRef.current?.focus(), 50);
  });

  // Auto-scroll
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  // Foco automático
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  // Notifica Jasmim com buffer
  const flushBuffer = useCallback(() => {
    if (bufTimerRef.current) clearTimeout(bufTimerRef.current);
    bufTimerRef.current = setTimeout(() => {
      const buf = bufferRef.current;
      const hasErr = ERROR_RE.test(buf.slice(-2000));
      onBufferUpdate?.(buf, hasErr);
    }, 1500);
  }, [onBufferUpdate]);

  // Executa comando via SSE
  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || isRunning) return;

    setInput("");
    setHistoryIdx(-1);
    setIsRunning(true);
    setSessionId(null);
    setStdinInput("");
    onRunningChange?.(true, trimmed);

    const id = ++entryCounter.current;
    const newEntry: Entry = { id, command: trimmed, chunks: [], running: true, exitCode: null, durationMs: 0, missingPackage: null };
    setEntries(prev => [...prev, newEntry]);

    const abort = new AbortController();
    abortRef.current = abort;

    const updateEntry = (updater: (e: Entry) => Entry) => {
      setEntries(prev => prev.map(e => e.id === id ? updater(e) : e));
    };

    try {
      const res = await fetch(`${getBase()}/api/projects/default/exec-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Erro desconhecido");
        updateEntry(e => ({ ...e, running: false, exitCode: 1, chunks: [{ type: "stderr", text: `Erro HTTP: ${errText}` }] }));
        setIsRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));

            if (ev.type === "session_id") {
              setSessionId(ev.sessionId);
              setTimeout(() => stdinRef.current?.focus(), 100);
            } else if (ev.type === "stdout" || ev.type === "stderr") {
              updateEntry(e => ({ ...e, chunks: [...e.chunks, { type: ev.type, text: ev.data }] }));
              bufferRef.current = (bufferRef.current + ev.data).slice(-8000);
              flushBuffer();
              // Foca no input de stdin quando processo pede entrada
              setTimeout(() => stdinRef.current?.focus(), 50);
            } else if (ev.type === "server_detected") {
              onServerToggle?.(true, ev.port);
              updateEntry(e => ({ ...e, chunks: [...e.chunks, { type: "stdout", text: `\n🌐 Servidor na porta ${ev.port} — preview conectado!\n` }] }));
            } else if (ev.type === "exit") {
              const allText = (await new Promise<string>(resolve => {
                setEntries(prev => {
                  const entry = prev.find(e => e.id === id);
                  resolve(entry?.chunks.map(c => c.text).join("") ?? "");
                  return prev;
                });
              }));
              const missing = ev.exitCode !== 0 ? detectMissing(allText) : null;
              updateEntry(e => ({ ...e, running: false, exitCode: ev.exitCode, durationMs: ev.durationMs, missingPackage: missing }));
              const clean = ev.exitCode === 0;
              onCommandOutput?.(trimmed, allText, clean);
              if (!clean) onServerToggle?.(false);
            }
          } catch { /* ignora parse errors */ }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        updateEntry(e => ({ ...e, running: false, exitCode: 130, chunks: [...e.chunks, { type: "stderr", text: "\n^C interrompido\n" }] }));
      } else {
        updateEntry(e => ({ ...e, running: false, exitCode: 1, chunks: [...e.chunks, { type: "stderr", text: `\nErro de conexão: ${err.message}\n` }] }));
      }
    } finally {
      setIsRunning(false);
      onRunningChange?.(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
      onCommandExecuted?.();
    }
  }, [isRunning, onCommandOutput, onServerToggle, onCommandExecuted, onRunningChange, flushBuffer]);

  // Envia texto para stdin do processo rodando (ex: responder input() do Python)
  const sendStdin = useCallback(async (text: string) => {
    if (!sessionId || !text) return;
    const data = text.endsWith("\n") ? text : text + "\n";
    setStdinInput("");
    // Mostra o que foi digitado no output como feedback visual
    const id = entryCounter.current;
    setEntries(prev => prev.map(e => e.id === id
      ? { ...e, chunks: [...e.chunks, { type: "stdout" as const, text: `\u001b[36m${text}\u001b[0m\n` }] }
      : e
    ));
    try {
      await fetch(`${getBase()}/api/projects/default/exec-stdin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, data }),
      });
    } catch { /* ignora — processo pode ter encerrado */ }
  }, [sessionId]);

  // Executa comando externo (IA / botões)
  useEffect(() => {
    if (externalCommand && externalCommand !== lastExtCmd) {
      setLastExtCmd(externalCommand);
      runCommand(externalCommand);
    }
  }, [externalCommand, lastExtCmd, runCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const history = entries.map(en => en.command);
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const ni = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(ni);
      setInput(history[history.length - 1 - ni] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const ni = Math.max(historyIdx - 1, -1);
      setHistoryIdx(ni);
      setInput(ni === -1 ? "" : (history[history.length - 1 - ni] ?? ""));
    } else if (e.key === "c" && e.ctrlKey) {
      if (isRunning && abortRef.current) {
        abortRef.current.abort();
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    }
  };

  const copyOutput = (entry: Entry) => {
    const text = entry.chunks.map(c => c.text).join("");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  // ── Busca de pacotes ─────────────────────────────────────────────────────
  const searchPkgs = useCallback(async (q: string, mode: "npm" | "pip") => {
    if (!q.trim() || q.length < 2) { setPkgResults([]); return; }
    setPkgSearching(true);
    try {
      if (mode === "npm") {
        const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=8`);
        const data = await res.json();
        setPkgResults((data.objects ?? []).map((o: any) => ({ name: o.package.name, description: o.package.description ?? "", version: o.package.version ?? "" })));
      } else {
        const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(q)}/json`).catch(() => null);
        if (res?.ok) { const { info } = await res.json(); setPkgResults([{ name: info.name, description: info.summary ?? "", version: info.version ?? "" }]); }
        else setPkgResults([]);
      }
    } catch { setPkgResults([]); }
    finally { setPkgSearching(false); }
  }, []);

  const onPkgQuery = (q: string) => {
    setPkgQuery(q);
    if (searchDebRef.current) clearTimeout(searchDebRef.current);
    searchDebRef.current = setTimeout(() => searchPkgs(q, pkgMode), 400);
  };

  const installPkg = (name: string) => {
    const cmd = pkgMode === "npm" ? `npm install ${name}` : `pip install ${name}`;
    runCommand(cmd);
    setShowPkgSearch(false); setPkgQuery(""); setPkgResults([]);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d0d] overflow-hidden font-mono text-xs">

      {/* ── Barra de status ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-[#141414] border-b border-gray-700/30 shrink-0 min-h-[28px]">
        <div className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? "bg-yellow-400 animate-pulse" : "bg-green-400"}`} />
        <span className="text-[11px] text-gray-500">{isRunning ? "executando…" : "pronto"}</span>

        {isRunning && (
          <div className="flex items-center gap-1 ml-1">
            <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
            <span className="text-[10px] text-yellow-300">Ctrl+C para cancelar</span>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => { setShowPkgSearch(v => !v); setPkgQuery(""); setPkgResults([]); }}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
            showPkgSearch ? "bg-gray-800/30 text-green-300 border-green-600/50" : "text-gray-500 border-gray-700/30 hover:border-green-700/40 hover:text-green-400"
          }`}
        >
          📦 Pacotes
        </button>
        <button
          onClick={() => setEntries([])}
          className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-all"
          title="Limpar (Ctrl+L)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Painel de busca de pacotes ── */}
      {showPkgSearch && (
        <div className="shrink-0 bg-[#111a0a] border-b border-green-700/30 px-2 py-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            {(["npm", "pip"] as const).map(m => (
              <button key={m} onClick={() => { setPkgMode(m); setPkgResults([]); if (pkgQuery.length >= 2) searchPkgs(pkgQuery, m); }}
                className={`px-3 py-0.5 rounded-md text-[11px] font-bold transition-all ${pkgMode === m ? "bg-green-700/50 text-green-200 border border-green-600/50" : "text-gray-500 hover:text-gray-300"}`}>
                {m === "npm" ? "📦 npm" : "🐍 pip"}
              </button>
            ))}
          </div>
          <div className="relative">
            <input autoFocus type="text" value={pkgQuery} onChange={e => onPkgQuery(e.target.value)}
              placeholder={pkgMode === "npm" ? "axios, lodash, react-query…" : "requests, numpy, flask…"}
              className="w-full bg-[#141414] border border-gray-700/40 rounded-lg px-3 py-1.5 text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-600/60" />
            {pkgSearching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-400 animate-spin" />}
          </div>
          {pkgResults.length > 0 && (
            <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
              {pkgResults.map(pkg => (
                <button key={pkg.name} onClick={() => installPkg(pkg.name)}
                  className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-[#141414] hover:bg-green-900/20 border border-gray-700/30 hover:border-green-600/40 text-left transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-green-300 font-mono">{pkg.name}</span>
                      {pkg.version && <span className="text-[9px] text-gray-600">v{pkg.version}</span>}
                    </div>
                    {pkg.description && <p className="text-[10px] text-gray-500 truncate mt-0.5">{pkg.description}</p>}
                  </div>
                  <span className="text-[10px] text-green-600 font-bold shrink-0 mt-0.5">instalar</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Comandos rápidos ── */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#111a0a] border-b border-gray-700/20 overflow-x-auto shrink-0">
        {QUICK.map(q => (
          <button key={q.cmd} onClick={() => runCommand(q.cmd)} disabled={isRunning}
            className="text-[10px] px-2 py-0.5 rounded bg-[#141414] text-gray-500 border border-gray-700/30 hover:border-green-700/40 hover:text-green-400 whitespace-nowrap transition-all disabled:opacity-40 shrink-0">
            {q.label}
          </button>
        ))}
      </div>

      {/* ── Output ── */}
      <div ref={outputRef} className="flex-1 overflow-auto p-2 space-y-3">
        {entries.length === 0 && (
          <div className="text-gray-600 text-[11px] space-y-1 pt-1">
            <p className="text-green-700">📂 Pasta de trabalho: ~/sk-projetos</p>
            <p>Terminal pronto. Digite um comando ou clique nos botões acima.</p>
            <p className="text-[10px] opacity-60">↑ ↓ histórico · Ctrl+C cancelar · Ctrl+L limpar</p>
          </div>
        )}

        {entries.map(entry => {
          const allText = entry.chunks.map(c => c.text).join("");
          const exitOk = entry.exitCode === 0;

          return (
            <div key={entry.id} className="space-y-1">
              {/* Linha do comando */}
              <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                <span className="text-green-500 shrink-0">$</span>
                <span className="text-gray-200 flex-1 break-all">{entry.command}</span>
                <button onClick={() => copyOutput(entry)} className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors" title="Copiar saída">
                  {copiedId === entry.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
                {entry.running ? (
                  <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />rodando
                  </span>
                ) : (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${exitOk ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {exitOk ? "✓ OK" : `✗ exit ${entry.exitCode}`}
                  </span>
                )}
                {!entry.running && entry.durationMs > 0 && (
                  <span className="text-gray-600 text-[9px] shrink-0">{fmtDur(entry.durationMs)}</span>
                )}
              </div>

              {/* Output streamed */}
              {entry.chunks.length > 0 && (
                <pre className="text-[11px] whitespace-pre-wrap break-words pl-3 leading-relaxed border-l border-gray-700/40">
                  {entry.chunks.map((chunk, i) => (
                    <span key={i} className={
                      chunk.type === "stdout"
                        ? "text-gray-200"
                        : /npm warn/i.test(chunk.text)
                          ? "text-yellow-400/80"
                          : (!entry.running && entry.exitCode !== 0) || /npm err!/i.test(chunk.text)
                            ? "text-red-400"
                            : "text-gray-500"
                    }>{chunk.text}</span>
                  ))}
                  {entry.running && <span className="inline-block w-2 h-3 bg-green-400 animate-pulse ml-0.5 align-middle" />}
                </pre>
              )}

              {/* ── Barra de resultado clara (aparece quando termina) ── */}
              {!entry.running && entry.exitCode !== null && (() => {
                const ok = entry.exitCode === 0;
                const text = allText;
                // Extrai resumo do npm/pip
                const npmAdded   = text.match(/added\s+(\d+)\s+packages?\s+in\s+([\d.]+[smh])/i);
                const npmChanged = text.match(/([\d]+)\s+packages?\s+are\s+looking/i);
                const pipOk      = /Successfully installed/i.test(text);
                const pipInstalled = text.match(/Successfully installed\s+(.+)/i);
                const isInstall  = /npm install|pip install|yarn add|pnpm add/i.test(entry.command);

                let summary = "";
                if (ok && npmAdded) {
                  summary = `${npmAdded[1]} pacote${+npmAdded[1] !== 1 ? "s" : ""} instalado${+npmAdded[1] !== 1 ? "s" : ""} em ${npmAdded[2]}`;
                  if (npmChanged) summary += ` · ${npmChanged[1]} com atualizações pendentes`;
                } else if (ok && pipOk && pipInstalled) {
                  summary = `Instalado: ${pipInstalled[1].trim().slice(0, 80)}`;
                } else if (ok && isInstall) {
                  summary = "Instalação concluída";
                } else if (!ok) {
                  const errLine = text.split("\n").find(l => /npm err!|error|falhou|failed/i.test(l))?.trim();
                  summary = errLine ? errLine.slice(0, 100) : `Código de saída: ${entry.exitCode}`;
                }

                return (
                  <div className={`mt-1 mx-0 flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px] font-semibold ${ok
                    ? "bg-green-900/25 border-green-700/40 text-green-300"
                    : "bg-red-900/25 border-red-700/40 text-red-300"}`}>
                    <span className="text-base shrink-0">{ok ? "✅" : "❌"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold">{ok ? "Concluído com sucesso" : "Falhou"}</span>
                      {summary && <span className="ml-2 font-normal text-[10px] opacity-80 truncate">{summary}</span>}
                    </div>
                    {entry.durationMs > 0 && (
                      <span className="text-[10px] opacity-60 shrink-0">{fmtDur(entry.durationMs)}</span>
                    )}
                  </div>
                );
              })()}

              {/* Sugestão de pacote faltando */}
              {!entry.running && entry.missingPackage && (
                entry.missingPackage === "__deps__" ? (
                  <div className="flex items-center gap-2 ml-3 p-2 rounded bg-yellow-400/10 border border-yellow-400/30">
                    <Download className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span className="text-[11px] text-yellow-300 flex-1">Dependências não instaladas.</span>
                    <button onClick={() => runCommand("npm install")}
                      className="text-[10px] font-semibold px-2 py-1 rounded bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/30 shrink-0">
                      npm install
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 ml-3 p-2 rounded bg-yellow-400/10 border border-yellow-400/30">
                    <Download className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span className="text-[11px] text-yellow-300 flex-1">Pacote <code className="font-bold">{entry.missingPackage}</code> não encontrado.</span>
                    <button onClick={() => runCommand(`npm install ${entry.missingPackage}`)}
                      className="text-[10px] font-semibold px-2 py-1 rounded bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/30 shrink-0">
                      instalar
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* ── Stdin: campo de entrada interativa quando processo está rodando ── */}
      {isRunning && sessionId && (
        <div className="shrink-0 border-t border-cyan-700/40 bg-[#0a1a1a] flex items-center px-3 py-2 gap-2">
          <span className="text-cyan-500 shrink-0 text-[11px] font-semibold font-mono">entrada&gt;</span>
          <input
            ref={stdinRef}
            type="text"
            value={stdinInput}
            onChange={e => setStdinInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") sendStdin(stdinInput);
              if (e.key === "c" && e.ctrlKey) { abortRef.current?.abort(); }
            }}
            placeholder="Digite a resposta e pressione Enter…"
            className="flex-1 bg-transparent outline-none text-sm text-cyan-200 placeholder:text-cyan-800 font-mono"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          />
          <button
            onClick={() => sendStdin(stdinInput)}
            className="text-[10px] px-2 py-1 bg-cyan-700/30 border border-cyan-600/30 rounded text-cyan-400 font-semibold"
          >Enter</button>
        </div>
      )}

      {/* ── Input de comandos ── */}
      <div className="shrink-0 border-t border-gray-700/30 bg-[#0f1a09] flex items-center px-3 py-2.5 gap-2">
        <span className="text-green-500 shrink-0 text-[13px]">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? "rodando… (Ctrl+C para cancelar)" : "npm install, git status, node server.js…"}
          className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 font-mono"
          disabled={isRunning}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={toggleVoice}
          disabled={isRunning}
          className={`shrink-0 p-1.5 rounded transition-colors ${listening ? "text-red-400 bg-red-400/20 animate-pulse" : "text-gray-600 hover:text-gray-300"} disabled:opacity-30`}
          title={listening ? "Parar gravação" : "Falar comando"}
        >
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
