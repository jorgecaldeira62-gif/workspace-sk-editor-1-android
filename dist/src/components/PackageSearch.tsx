import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Package, Download, X, Loader2, ExternalLink,
  Star, CheckCircle2, AlertCircle, Terminal, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface NpmPackage {
  name: string;
  description: string;
  version: string;
  date: string;
  links?: { npm?: string; homepage?: string };
  score?: { final: number };
}

interface InstallState {
  pkg: string;
  status: "installing" | "ok" | "error";
  output: string;
  showOutput: boolean;
}

interface PackageSearchProps {
  onInstall?: (cmd: string) => void;
  onClose: () => void;
}

// ─── Categorias ───────────────────────────────────────────────────────────────
const CATEGORIES: { label: string; emoji: string; packages: string[]; pip?: boolean }[] = [
  { label: "Servidor Web",      emoji: "🌐", packages: ["express", "fastify", "koa", "hapi", "polka", "h3", "hono"] },
  { label: "Banco de Dados",    emoji: "🗄️", packages: ["mongoose", "prisma", "pg", "mysql2", "sqlite3", "redis", "ioredis", "drizzle-orm", "@neondatabase/serverless"] },
  { label: "Utilitários",       emoji: "🔧", packages: ["lodash", "moment", "dayjs", "uuid", "nanoid", "dotenv", "zod", "date-fns", "ramda"] },
  { label: "HTTP / APIs",       emoji: "📡", packages: ["axios", "node-fetch", "got", "openai", "stripe", "undici", "@anthropic-ai/sdk", "@google/generative-ai"] },
  { label: "Autenticação",      emoji: "🔐", packages: ["jsonwebtoken", "bcryptjs", "passport", "express-session", "helmet", "cors", "express-rate-limit", "cookie-parser"] },
  { label: "Dev Tools",         emoji: "⚙️", packages: ["typescript", "nodemon", "ts-node", "tsx", "eslint", "prettier", "jest", "vitest", "dotenv-cli"] },
  { label: "Frontend React",    emoji: "⚛️", packages: ["react", "react-dom", "react-router-dom", "vite", "@vitejs/plugin-react", "tailwindcss", "framer-motion", "zustand"] },
  { label: "UI / Estilo",       emoji: "🎨", packages: ["tailwindcss", "lucide-react", "react-icons", "clsx", "class-variance-authority", "@radix-ui/react-dialog"] },
  { label: "PDF / Documentos",  emoji: "📄", packages: ["pdfkit", "pdf-lib", "puppeteer", "html-pdf-node", "docx", "exceljs", "xlsx", "mammoth"] },
  { label: "Email / SMS",       emoji: "📧", packages: ["nodemailer", "@sendgrid/mail", "resend", "twilio"] },
  { label: "IA / ML",           emoji: "🤖", packages: ["openai", "@anthropic-ai/sdk", "@google/generative-ai", "langchain", "@langchain/core"] },
  { label: "Upload / Storage",  emoji: "☁️", packages: ["multer", "@aws-sdk/client-s3", "cloudinary", "firebase-admin", "@supabase/supabase-js"] },
  { label: "WebSocket / RT",    emoji: "⚡", packages: ["socket.io", "socket.io-client", "ws", "ably", "pusher-js"] },
  { label: "CLI / Terminal",    emoji: "🖥️", packages: ["commander", "yargs", "chalk", "ora", "inquirer", "figlet", "boxen"] },
  { label: "Segurança",         emoji: "🛡️", packages: ["helmet", "bcryptjs", "argon2", "crypto-js", "jsonwebtoken", "zod", "validator"] },
  { label: "Scraping",          emoji: "🕷️", packages: ["puppeteer", "playwright", "cheerio", "jsdom", "node-html-parser"] },
  { label: "Pagamentos",        emoji: "💳", packages: ["stripe", "mercadopago", "@mercadopago/sdk-js"] },
  { label: "Dados / Planilhas", emoji: "📊", packages: ["csv-parse", "papaparse", "xlsx", "d3", "recharts", "chart.js"] },
  { label: "Python (pip)",      emoji: "🐍", pip: true, packages: ["flask", "fastapi", "django", "requests", "pandas", "numpy", "sqlalchemy", "pydantic", "uvicorn", "httpx"] },
  { label: "Testes",            emoji: "🧪", packages: ["jest", "vitest", "mocha", "chai", "@testing-library/react", "supertest"] },
];

// ─── Descrições Python ────────────────────────────────────────────────────────
const PY_DESCS: Record<string, string> = {
  flask: "Microframework web leve e flexível",
  fastapi: "Framework web moderno, rápido, baseado em type hints",
  django: "Framework web completo, baterias incluídas",
  requests: "Biblioteca HTTP simples e elegante",
  pandas: "Análise e manipulação de dados",
  numpy: "Computação numérica e arrays multidimensionais",
  sqlalchemy: "ORM e toolkit SQL",
  pydantic: "Validação de dados via type hints",
  uvicorn: "Servidor ASGI ultra-rápido",
  httpx: "Cliente HTTP moderno com suporte async",
};

export default function PackageSearch({ onInstall, onClose }: PackageSearchProps) {
  const [query,          setQuery]          = useState("");
  const [results,        setResults]        = useState<NpmPackage[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [searchErr,      setSearchErr]      = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isPython,       setIsPython]       = useState(false);
  const [installs,       setInstalls]       = useState<Record<string, InstallState>>({});
  const searchRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRefs   = useRef<Record<string, AbortController>>({});

  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 100); }, []);

  // ─── Busca npm ────────────────────────────────────────────────────────────
  const searchNpm = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearchErr(""); return; }
    setSearching(true); setSearchErr(""); setActiveCategory(null);
    try {
      const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=20`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.objects?.map((o: any) => ({
        name: o.package.name,
        description: o.package.description,
        version: o.package.version,
        date: o.package.date,
        links: o.package.links,
        score: o.score,
      })) ?? []);
    } catch {
      setSearchErr("Não foi possível buscar. Verifique a conexão.");
      setResults([]);
    } finally { setSearching(false); }
  }, []);

  const searchCategory = useCallback(async (pkgs: string[], label: string, pip = false) => {
    setIsPython(pip); setActiveCategory(label); setQuery("");
    setSearching(true); setSearchErr("");
    if (pip) {
      setResults(pkgs.map(name => ({ name, description: PY_DESCS[name] || `Pacote Python: ${name}`, version: "latest", date: "", links: { npm: `https://pypi.org/project/${name}/` } })));
      setSearching(false);
      return;
    }
    try {
      const fetched = await Promise.all(pkgs.slice(0, 12).map(async name => {
        try {
          const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
          if (!r.ok) return null;
          const d = await r.json();
          return { name: d.name, description: d.description, version: d.version, date: d.date, links: d.links } as NpmPackage;
        } catch { return null; }
      }));
      setResults(fetched.filter(Boolean) as NpmPackage[]);
    } catch { setSearchErr("Erro ao carregar categoria."); }
    finally { setSearching(false); }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val); setActiveCategory(null); setIsPython(false);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(() => searchNpm(val), 500);
  };

  // ─── Instalação REAL via /api/workspace/install ───────────────────────────
  const handleInstall = useCallback(async (name: string, dev = false) => {
    if (installs[name]?.status === "installing") return;

    // Cancela qualquer install anterior do mesmo pacote
    abortRefs.current[name]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[name] = ctrl;

    const pkgSpec = dev ? `${name} -D` : name;
    const packages = dev ? [`${name}`] : [name];

    setInstalls(prev => ({
      ...prev,
      [name]: { pkg: name, status: "installing", output: "", showOutput: true },
    }));

    // Também envia para o terminal (fallback visual, mas a instalação real é via API)
    onInstall?.(isPython ? `pip3 install ${name}` : dev ? `npm install -D ${name}` : `npm install ${name}`);

    try {
      const resp = await fetch("/api/workspace/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages, dev: dev && !isPython, pip: isPython }),
        signal: ctrl.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let allOutput = "";
      let finalOk = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.out) {
              allOutput += ev.out;
              setInstalls(prev => ({
                ...prev,
                [name]: { ...prev[name], output: allOutput },
              }));
            }
            if (ev.done) {
              finalOk = ev.ok === true;
            }
          } catch { /* ignora JSON inválido */ }
        }
      }

      setInstalls(prev => ({
        ...prev,
        [name]: {
          pkg: name,
          status: finalOk ? "ok" : "error",
          output: allOutput,
          showOutput: !finalOk, // só mantém aberto em caso de erro
        },
      }));

    } catch (err: any) {
      if (err.name === "AbortError") return;
      setInstalls(prev => ({
        ...prev,
        [name]: {
          pkg: name,
          status: "error",
          output: `Erro: ${err.message}`,
          showOutput: true,
        },
      }));
    }
  }, [installs, isPython, onInstall]);

  const toggleOutput = (name: string) => {
    setInstalls(prev => ({
      ...prev,
      [name]: { ...prev[name], showOutput: !prev[name].showOutput },
    }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
        <div className="bg-[#1a2413] border-t border-gray-700/60 rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">

          {/* Handle */}
          <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/40 shrink-0">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-yellow-400" />
              <span className="text-[15px] font-bold text-white">Biblioteca de Pacotes</span>
              <span className="text-[10px] text-green-400 bg-gray-800/30 border border-green-700/30 px-2 py-0.5 rounded-full">instalação real</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
              <X size={17} />
            </button>
          </div>

          {/* Info banner */}
          <div className="px-4 pt-2.5 pb-0 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-700/30 rounded-xl text-[11px] text-blue-300">
              <Terminal size={12} className="shrink-0" />
              Instala no servidor em <code className="font-mono text-blue-200 mx-1">~/sk-user-workspace/</code> — use <strong>Sync</strong> + <strong>Rodar</strong> para executar
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pt-2.5 pb-2 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0d1409] border border-gray-700/50 rounded-2xl focus-within:border-yellow-600/60 transition-colors">
              <Search size={15} className="text-gray-600 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") searchNpm(query); }}
                placeholder="Buscar pacote npm ou biblioteca..."
                className="flex-1 bg-transparent outline-none text-[13px] text-gray-200 placeholder-gray-700"
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); setActiveCategory(null); setIsPython(false); }} className="text-gray-700 hover:text-gray-400">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Categories */}
          {!query && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.label}
                    onClick={() => searchCategory(cat.packages, cat.label, cat.pip)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                      activeCategory === cat.label
                        ? "bg-yellow-600/20 border-yellow-500/60 text-yellow-300"
                        : "bg-[#0d0d0d] border-gray-700/40 text-gray-400 hover:border-gray-600/60 hover:text-gray-200"
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span className="whitespace-nowrap">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">

            {searching && (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-[13px]">Buscando...</span>
              </div>
            )}

            {searchErr && (
              <div className="py-6 text-center">
                <p className="text-[13px] text-red-400">{searchErr}</p>
              </div>
            )}

            {!searching && !searchErr && results.length === 0 && !query && !activeCategory && (
              <div className="py-6 text-center">
                <Package size={28} className="text-gray-700 mx-auto mb-2" />
                <p className="text-[13px] text-gray-500">Busque por nome ou escolha uma categoria</p>
                <p className="text-[11px] text-gray-700 mt-1">Ex: "express", "axios", "mongoose", "flask"</p>
              </div>
            )}

            {!searching && results.map(pkg => {
              const inst = installs[pkg.name];
              return (
                <div key={pkg.name} className="py-3 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-bold text-gray-100 font-mono">{pkg.name}</span>
                        {pkg.version !== "latest" && (
                          <span className="text-[10px] text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded font-mono">v{pkg.version}</span>
                        )}
                        {pkg.score && pkg.score.final > 0.7 && (
                          <span className="text-[9px] text-yellow-500 flex items-center gap-0.5">
                            <Star size={9} fill="currentColor" /> popular
                          </span>
                        )}
                        {isPython && <span className="text-[9px] text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-700/30">pip</span>}
                      </div>
                      {pkg.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{pkg.description}</p>
                      )}
                    </div>
                    {pkg.links?.npm && (
                      <a href={pkg.links.npm} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-700 hover:text-blue-400 mt-0.5">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  {/* Botões de instalação */}
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleInstall(pkg.name)}
                      disabled={inst?.status === "installing"}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-60 ${
                        inst?.status === "ok"
                          ? "bg-green-700/30 border border-green-600/40 text-green-400"
                          : inst?.status === "error"
                          ? "bg-red-700/20 border border-red-600/30 text-red-400"
                          : inst?.status === "installing"
                          ? "bg-yellow-700/20 border border-yellow-600/30 text-yellow-400"
                          : "bg-yellow-600/15 border border-yellow-600/30 text-yellow-300 hover:bg-yellow-600/25 active:scale-95"
                      }`}
                    >
                      {inst?.status === "installing" ? (
                        <><Loader2 size={11} className="animate-spin" /> Instalando...</>
                      ) : inst?.status === "ok" ? (
                        <><CheckCircle2 size={11} /> Instalado!</>
                      ) : inst?.status === "error" ? (
                        <><AlertCircle size={11} /> Erro — Tentar de novo</>
                      ) : (
                        <><Download size={11} /> {isPython ? "pip install" : "npm install"}</>
                      )}
                    </button>

                    {!isPython && (
                      <button
                        onClick={() => handleInstall(pkg.name, true)}
                        disabled={inst?.status === "installing"}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold border border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600/60 active:scale-95 disabled:opacity-40"
                      >
                        -D (dev)
                      </button>
                    )}
                  </div>

                  {/* Output real da instalação */}
                  {inst && inst.output && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleOutput(pkg.name)}
                        className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        <Terminal size={10} />
                        {inst.showOutput ? "Ocultar saída" : "Ver saída"}
                        {inst.showOutput ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                      {inst.showOutput && (
                        <pre className="mt-1.5 p-2.5 bg-black/60 border border-gray-800/60 rounded-xl text-[10px] text-green-300/80 font-mono overflow-x-auto max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap break-words">
                          {inst.output}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
