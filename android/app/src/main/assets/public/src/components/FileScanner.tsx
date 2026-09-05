import { useState, useRef, useCallback } from "react";
import {
  Search, X, FileCode2, Globe, Brain, FolderSearch, Upload,
  Copy, Check, ChevronDown, ChevronRight, AlertCircle, Loader2,
  Package, File,
} from "lucide-react";
import JSZip from "jszip";

interface FileScannerProps {
  vfs: {
    listFiles: () => string[];
    readFile: (p: string) => string | null;
  };
  onClose: () => void;
  aiConfig?: { apiKey: string; apiUrl: string; apiModel: string };
}

interface SearchResult { file: string; line: number; text: string; }
interface ApkEntry { path: string; isDir: boolean; }

const PROXIES = [
  (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function FileScanner({ vfs, onClose, aiConfig }: FileScannerProps) {
  const [tab, setTab] = useState<"vfs" | "apk" | "web" | "ai">("vfs");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [apkEntries, setApkEntries] = useState<ApkEntry[]>([]);
  const [apkLoading, setApkLoading] = useState(false);
  const [apkError, setApkError] = useState("");
  const [apkName, setApkName] = useState("");
  const [apkFilter, setApkFilter] = useState("");
  const [apkSelected, setApkSelected] = useState<string | null>(null);
  const [apkContent, setApkContent] = useState<string | null>(null);
  const [webUrl, setWebUrl] = useState("");
  const [webResults, setWebResults] = useState("");
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const apkFileRef = useRef<File | null>(null);
  const apkInputRef = useRef<HTMLInputElement>(null);

  const copy = (t: string, id: string) => { navigator.clipboard.writeText(t); setCopied(id); setTimeout(() => setCopied(null), 2000); };

  const doVfsSearch = useCallback(() => {
    if (!query.trim()) return;
    setSearching(true);
    const q = query.toLowerCase();
    const res: SearchResult[] = [];
    for (const f of vfs.listFiles()) {
      const lines = (vfs.readFile(f) || "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) res.push({ file: f, line: i + 1, text: lines[i].trim() });
      }
    }
    setResults(res); setSearching(false);
  }, [query, vfs]);

  const handleApk = async (file: File) => {
    apkFileRef.current = file;
    setApkLoading(true); setApkError(""); setApkEntries([]); setApkSelected(null); setApkContent(null); setApkName(file.name);
    try {
      const zip = await JSZip.loadAsync(file);
      const entries: ApkEntry[] = [];
      zip.forEach((path, entry) => entries.push({ path, isDir: entry.dir }));
      entries.sort((a, b) => (a.isDir === b.isDir ? a.path.localeCompare(b.path) : a.isDir ? -1 : 1));
      setApkEntries(entries);
    } catch (e: any) { setApkError("Erro: " + e.message); }
    finally { setApkLoading(false); }
  };

  const readEntry = async (entryPath: string) => {
    if (!apkFileRef.current) return;
    setApkSelected(entryPath); setApkContent(null);
    try {
      const zip = await JSZip.loadAsync(apkFileRef.current);
      const entry = zip.file(entryPath);
      if (!entry) return;
      const text = await entry.async("text").catch(() => null);
      setApkContent(text ? text.slice(0, 50000) : "(binário)");
    } catch (e: any) { setApkContent("Erro: " + e.message); }
  };

  const doWebFetch = async () => {
    if (!webUrl.trim()) return;
    setWebLoading(true); setWebError(""); setWebResults("");
    let url = webUrl.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    for (const mk of PROXIES) {
      try {
        const r = await fetch(mk(url), { signal: AbortSignal.timeout(12000) });
        if (!r.ok) continue;
        const j = await r.json();
        const html: string = j.contents || j.body || "";
        setWebResults(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000) || "(sem conteúdo)");
        setWebLoading(false); return;
      } catch {}
    }
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(webUrl)}`, "_blank");
    setWebError("Não foi possível buscar via proxy. Abrindo DuckDuckGo..."); setWebLoading(false);
  };

  const doAI = async () => {
    if (!aiInput.trim() || !aiConfig?.apiKey) return;
    setAiLoading(true); setAiError(""); setAiResult("");
    try {
      const key = aiConfig.apiKey.trim();
      let url = aiConfig.apiUrl || "", model = aiConfig.apiModel || "";
      const A = [["gsk_","https://api.groq.com/openai/v1","llama-3.3-70b-versatile"],["AIza","https://generativelanguage.googleapis.com/v1beta/openai","gemini-2.0-flash"],["sk-","https://api.openai.com/v1","gpt-4o-mini"]];
      if (!url) for (const [p, u, m] of A) { if (key.startsWith(p)) { url = u; model = model || m; break; } }
      const res = await fetch(`${url}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: model || "gpt-4o-mini", messages: [{ role: "system", content: "Analise o conteúdo com clareza e estrutura." }, { role: "user", content: aiInput }], max_tokens: 8192, temperature: 0.5 }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
      const d: any = await res.json();
      setAiResult(d.choices?.[0]?.message?.content || "Sem resposta");
    } catch (e: any) { setAiError(e.message); }
    finally { setAiLoading(false); }
  };

  const grouped = results.reduce((acc, r) => { (acc[r.file] = acc[r.file] || []).push(r); return acc; }, {} as Record<string, SearchResult[]>);
  const filtered = apkEntries.filter(e => !apkFilter || e.path.toLowerCase().includes(apkFilter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[9995] flex flex-col bg-[#111a0a]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60 bg-[#1a2410] shrink-0">
        <div className="flex items-center gap-2"><FolderSearch size={18} className="text-green-400" /><span className="text-[15px] font-bold text-white">Scanner</span></div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400"><X size={18} /></button>
      </div>
      <div className="flex border-b border-gray-700/40 bg-[#141e0c] shrink-0">
        {(["vfs","apk","web","ai"] as const).map((t, i) => {
          const labels = ["🔍 Projeto","📦 APK/ZIP","🌐 Web","🧠 IA"];
          return <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors ${tab === t ? "text-green-300 border-b-2 border-green-400 bg-green-900/10" : "text-gray-500 hover:text-gray-300"}`}>{labels[i]}</button>;
        })}
      </div>
      <div className="flex-1 overflow-y-auto">

        {tab === "vfs" && (
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doVfsSearch()}
                placeholder="Buscar em todos os arquivos do projeto..." className="flex-1 px-3 py-2.5 bg-[#0d1409] border border-gray-700/50 rounded-xl text-[13px] text-gray-200 placeholder-gray-600 outline-none focus:border-green-500/60" />
              <button onClick={doVfsSearch} disabled={searching} className="px-4 py-2.5 bg-green-600/20 border border-green-500/40 rounded-xl text-green-300 font-bold hover:bg-green-600/30">
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>
            {results.length === 0 && query && !searching && <div className="text-center py-8 text-gray-600 text-[13px]">Nenhum resultado</div>}
            {Object.entries(grouped).map(([file, matches]) => (
              <div key={file} className="bg-[#0d1409] border border-gray-700/30 rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(expanded === file ? null : file)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5">
                  <FileCode2 size={13} className="text-blue-400 shrink-0" />
                  <span className="flex-1 text-[12px] text-gray-300 text-left font-mono truncate">{file}</span>
                  <span className="text-[11px] text-gray-600 shrink-0">{matches.length}×</span>
                  {expanded === file ? <ChevronDown size={12} className="text-gray-600" /> : <ChevronRight size={12} className="text-gray-600" />}
                </button>
                {expanded === file && (
                  <div className="border-t border-gray-700/30 divide-y divide-gray-700/20">
                    {matches.slice(0, 30).map((m, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 hover:bg-white/5">
                        <span className="text-[10px] text-gray-600 font-mono shrink-0 pt-0.5 w-8 text-right">{m.line}</span>
                        <span className="flex-1 text-[11px] text-gray-400 font-mono break-all leading-relaxed"><Highlight text={m.text} q={query} /></span>
                        <button onClick={() => copy(m.text, `${file}-${i}`)} className="shrink-0 p-1 text-gray-700 hover:text-gray-300">
                          {copied === `${file}-${i}` ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="text-[11px] text-gray-700 pt-1">{vfs.listFiles().length} arquivo(s) no projeto</div>
          </div>
        )}

        {tab === "apk" && (
          <div className="p-4 space-y-3">
            <button onClick={() => apkInputRef.current?.click()} className="w-full py-8 border-2 border-dashed border-gray-700/50 rounded-2xl flex flex-col items-center gap-2 hover:border-green-600/40 hover:bg-green-900/5 transition-colors">
              <Upload size={24} className="text-gray-600" />
              <span className="text-[13px] text-gray-500">Clique ou arraste um APK, ZIP, AAB, IPA</span>
              <span className="text-[11px] text-gray-700">Inspeciona o conteúdo sem extrair</span>
            </button>
            <input ref={apkInputRef} type="file" accept=".apk,.zip,.aab,.ipa,.jar" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleApk(f); }} />
            {apkLoading && <div className="flex items-center gap-2 text-[13px] text-gray-400 py-4 justify-center"><Loader2 size={16} className="animate-spin text-green-400" /> Lendo...</div>}
            {apkError && <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-900/10 border border-red-800/30 rounded-xl px-3 py-2"><AlertCircle size={13} /> {apkError}</div>}
            {apkEntries.length > 0 && (
              <>
                <div className="text-[12px] text-gray-400 font-medium">{apkName} — {apkEntries.length} entradas</div>
                <input value={apkFilter} onChange={e => setApkFilter(e.target.value)} placeholder="Filtrar..." className="w-full px-3 py-2 bg-[#0d1409] border border-gray-700/40 rounded-xl text-[12px] text-gray-300 placeholder-gray-700 outline-none" />
                <div className="space-y-0.5 max-h-[35vh] overflow-y-auto">
                  {filtered.map((e, i) => (
                    <button key={i} onClick={() => !e.isDir && readEntry(e.path)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-white/5 ${apkSelected === e.path ? "bg-green-900/20" : ""}`}>
                      {e.isDir ? <Package size={12} className="text-yellow-500 shrink-0" /> : <File size={12} className="text-gray-500 shrink-0" />}
                      <span className={`text-[11px] font-mono truncate ${e.isDir ? "text-yellow-300" : "text-gray-400"}`}>{e.path}</span>
                    </button>
                  ))}
                </div>
                {apkContent && (
                  <div className="bg-[#0d1409] border border-gray-700/30 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/20">
                      <span className="text-[11px] text-gray-500 font-mono truncate">{apkSelected}</span>
                      <button onClick={() => copy(apkContent, "apk")} className="text-gray-600 hover:text-gray-300">{copied === "apk" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}</button>
                    </div>
                    <pre className="px-3 py-2.5 text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all max-h-[25vh] overflow-y-auto">{apkContent}</pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "web" && (
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input value={webUrl} onChange={e => setWebUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && doWebFetch()}
                placeholder="URL ou termo de busca..." className="flex-1 px-3 py-2.5 bg-[#0d1409] border border-gray-700/50 rounded-xl text-[13px] text-gray-200 placeholder-gray-600 outline-none focus:border-green-500/60" />
              <button onClick={doWebFetch} disabled={webLoading} className="px-4 py-2.5 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-300 font-bold hover:bg-blue-600/30">
                {webLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[["🦆 DuckDuckGo","https://duckduckgo.com/?q="],["🔵 Google","https://www.google.com/search?q="],["🐙 GitHub","https://github.com/search?q="]].map(([label, base]) => (
                <button key={label} onClick={() => { if (webUrl.trim()) window.open(base + encodeURIComponent(webUrl), "_blank"); }} className="py-2 bg-gray-800/30 border border-gray-700/30 rounded-xl text-[11px] text-gray-400 font-semibold hover:bg-gray-700/30">{label}</button>
              ))}
            </div>
            {webError && <div className="text-[12px] text-yellow-400 bg-yellow-900/10 border border-yellow-800/30 rounded-xl px-3 py-2">{webError}</div>}
            {webResults && (
              <div className="bg-[#0d1409] border border-gray-700/30 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/20">
                  <span className="text-[11px] text-gray-500 truncate">{webUrl}</span>
                  <button onClick={() => copy(webResults, "web")} className="text-gray-600 hover:text-gray-300">{copied === "web" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}</button>
                </div>
                <pre className="px-3 py-2.5 text-[11px] text-gray-300 whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">{webResults}</pre>
              </div>
            )}
          </div>
        )}

        {tab === "ai" && (
          <div className="p-4 space-y-3">
            {!aiConfig?.apiKey && <div className="flex items-start gap-2 text-[12px] text-yellow-400 bg-yellow-900/10 border border-yellow-700/30 rounded-xl px-3 py-2.5"><AlertCircle size={13} className="shrink-0 mt-0.5" />Configure uma chave de API no editor principal primeiro.</div>}
            <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder={"Cole o conteúdo do arquivo ou descreva o que deseja analisar...\n\nEx: 'Analise este AndroidManifest.xml e liste as permissões'"} rows={6} className="w-full px-3 py-2.5 bg-[#0d1409] border border-gray-700/50 rounded-xl text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-green-500/60 font-mono resize-none" />
            <div className="flex gap-2">
              <button onClick={() => { const fs = vfs.listFiles().slice(0, 5).map(f => `=== ${f} ===\n${(vfs.readFile(f)||"").slice(0,2000)}`).join("\n\n"); setAiInput(`Analise o projeto:\n\n${fs}`); }} className="flex-1 py-2 bg-gray-800/40 border border-gray-700/30 rounded-xl text-[11px] text-gray-400 hover:bg-gray-700/30">📋 Carregar projeto</button>
              {apkContent && <button onClick={() => setAiInput(`Analise (${apkSelected}):\n\n${apkContent.slice(0,5000)}`)} className="flex-1 py-2 bg-gray-800/40 border border-gray-700/30 rounded-xl text-[11px] text-gray-400 hover:bg-gray-700/30">📦 Usar APK</button>}
            </div>
            <button onClick={doAI} disabled={aiLoading || !aiConfig?.apiKey} className="w-full py-3 bg-purple-600/20 border border-purple-500/40 rounded-xl text-[13px] text-purple-300 font-bold hover:bg-purple-600/30 disabled:opacity-50">
              {aiLoading ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Analisando...</span> : <span className="flex items-center justify-center gap-2"><Brain size={14} />Analisar com IA</span>}
            </button>
            {aiError && <div className="text-[12px] text-red-400 bg-red-900/10 border border-red-800/30 rounded-xl px-3 py-2">{aiError}</div>}
            {aiResult && (
              <div className="bg-[#0d1409] border border-gray-700/30 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/20">
                  <span className="text-[11px] text-gray-500">Análise IA</span>
                  <button onClick={() => copy(aiResult, "ai")} className="text-gray-600 hover:text-gray-300">{copied === "ai" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}</button>
                </div>
                <pre className="px-3 py-2.5 text-[12px] text-gray-300 whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">{aiResult}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
