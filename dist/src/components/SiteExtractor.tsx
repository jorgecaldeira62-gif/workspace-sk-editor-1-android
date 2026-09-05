import { useState, useCallback, useRef } from "react";
import {
  Globe, Search, Download, X, Loader2, CheckCircle2,
  AlertCircle, FileCode2, Image, Link2, RefreshCw, Bot,
  ChevronDown, ChevronRight, Copy, Check, FolderDown,
} from "lucide-react";

interface ExtractedFile {
  path: string;
  content: string;
  type: "html" | "css" | "js" | "image" | "other";
  size: number;
}

interface SiteExtractorProps {
  onSaveToVFS: (files: Record<string, string>) => void;
  onAnalyzeWithAI?: (content: string) => void;
  onClose: () => void;
}

type ScanMode = "main" | "subpages" | "full";
type ProxyOption = "allorigins" | "corsproxy" | "codetabs";

const PROXY_FNS: Record<ProxyOption, (u: string) => string> = {
  allorigins: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  corsproxy:  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  codetabs:   (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
};

const PROXY_LABELS: Record<ProxyOption, string> = {
  allorigins: "AllOrigins (padrão)",
  corsproxy:  "CORSProxy.io",
  codetabs:   "CodeTabs",
};

async function fetchWithProxy(url: string, proxy: ProxyOption, timeout = 20000): Promise<string> {
  const proxies: ProxyOption[] = [proxy, ...((Object.keys(PROXY_FNS) as ProxyOption[]).filter(p => p !== proxy))];
  let lastErr = "";
  for (const p of proxies) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(PROXY_FNS[p](url), { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return await res.text();
      lastErr = `HTTP ${res.status}`;
    } catch (e: any) {
      lastErr = e.message || "Erro";
    }
  }
  throw new Error(`Todos os proxies falharam: ${lastErr}`);
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  const base = new URL(baseUrl);
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1];
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const full = new URL(href, base).toString();
      if (new URL(full).hostname === base.hostname) {
        links.push(full);
      }
    } catch {}
  }
  return [...new Set(links)].slice(0, 20);
}

function extractAssets(html: string, baseUrl: string): { css: string[]; js: string[]; images: string[] } {
  const base = new URL(baseUrl);
  const resolve = (u: string) => { try { return new URL(u, base).toString(); } catch { return ""; } };

  const css: string[] = [];
  const js: string[] = [];
  const images: string[] = [];

  const cssRe = /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
  const jsRe  = /<script[^>]+src=["']([^"']+\.(?:js|mjs)[^"']*)["'][^>]*>/gi;
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

  let m: RegExpExecArray | null;
  while ((m = cssRe.exec(html)) !== null) { const u = resolve(m[1]); if (u) css.push(u); }
  while ((m = jsRe.exec(html))  !== null) { const u = resolve(m[1]); if (u) js.push(u); }
  while ((m = imgRe.exec(html)) !== null) { const u = resolve(m[1]); if (u) images.push(u); }

  return { css: [...new Set(css)], js: [...new Set(js)], images: [...new Set(images)] };
}

function urlToPath(url: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const u = new URL(url);
    let path = u.pathname;
    if (path === "/" || path === "") return "index.html";
    path = path.replace(/^\//, "");
    if (!path.includes(".")) path = path.replace(/\/$/, "") + "/index.html";
    return "site/" + path;
  } catch {
    return "site/arquivo.html";
  }
}

export default function SiteExtractor({ onSaveToVFS, onAnalyzeWithAI, onClose }: SiteExtractorProps) {
  const [url, setUrl] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>("main");
  const [proxy, setProxy] = useState<ProxyOption>("allorigins");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [extracted, setExtracted] = useState<ExtractedFile[]>([]);
  const [error, setError] = useState("");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const abortRef = useRef(false);

  const addProgress = useCallback((msg: string) => {
    setProgress(p => [...p, msg]);
  }, []);

  const extractSite = useCallback(async () => {
    const target = url.trim();
    if (!target) return;
    const targetUrl = target.startsWith("http") ? target : "https://" + target;

    setLoading(true);
    setError("");
    setExtracted([]);
    setProgress([]);
    abortRef.current = false;

    const files: ExtractedFile[] = [];
    const visited = new Set<string>();

    async function fetchPage(pageUrl: string, depth = 0) {
      if (abortRef.current) return;
      if (visited.has(pageUrl)) return;
      visited.add(pageUrl);

      addProgress(`🌐 Buscando: ${pageUrl.length > 60 ? "..." + pageUrl.slice(-57) : pageUrl}`);

      try {
        const html = await fetchWithProxy(pageUrl, proxy);

        const path = urlToPath(pageUrl, targetUrl);
        files.push({ path, content: html, type: "html", size: html.length });
        addProgress(`✅ HTML salvo: ${path} (${(html.length / 1024).toFixed(1)} KB)`);

        if (abortRef.current) return;

        const assets = extractAssets(html, pageUrl);

        // Fetch CSS
        for (const cssUrl of assets.css.slice(0, 5)) {
          if (abortRef.current) break;
          try {
            const cssContent = await fetchWithProxy(cssUrl, proxy, 10000);
            const cssPath = urlToPath(cssUrl, targetUrl);
            files.push({ path: cssPath, content: cssContent, type: "css", size: cssContent.length });
            addProgress(`🎨 CSS: ${cssPath}`);
          } catch { addProgress(`⚠️ CSS ignorado: ${cssUrl.slice(-50)}`); }
        }

        // Fetch JS
        for (const jsUrl of assets.js.slice(0, 5)) {
          if (abortRef.current) break;
          try {
            const jsContent = await fetchWithProxy(jsUrl, proxy, 10000);
            const jsPath = urlToPath(jsUrl, targetUrl);
            files.push({ path: jsPath, content: jsContent, type: "js", size: jsContent.length });
            addProgress(`⚡ JS: ${jsPath}`);
          } catch { addProgress(`⚠️ JS ignorado: ${jsUrl.slice(-50)}`); }
        }

        // Sub-pages
        if (depth === 0 && (scanMode === "subpages" || scanMode === "full")) {
          const links = extractLinks(html, pageUrl);
          addProgress(`🔗 ${links.length} links encontrados para varredura`);
          const limit = scanMode === "full" ? links.length : Math.min(links.length, 5);
          for (const link of links.slice(0, limit)) {
            if (abortRef.current) break;
            await fetchPage(link, depth + 1);
          }
        }
      } catch (e: any) {
        addProgress(`❌ Erro em ${pageUrl.slice(-50)}: ${e.message}`);
      }
    }

    try {
      await fetchPage(targetUrl);
      setExtracted(files);
      addProgress(`\n🎉 Extração concluída: ${files.length} arquivo(s)`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url, scanMode, proxy, addProgress]);

  const saveAll = useCallback(() => {
    if (!extracted.length) return;
    const record: Record<string, string> = {};
    extracted.forEach(f => { record[f.path] = f.content; });
    onSaveToVFS(record);
  }, [extracted, onSaveToVFS]);

  const copyFile = (content: string, path: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(path);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const analyzeFile = (f: ExtractedFile) => {
    onAnalyzeWithAI?.(`Analise este arquivo extraído do site:\n\n**Arquivo:** ${f.path}\n**Tipo:** ${f.type}\n**Tamanho:** ${(f.size / 1024).toFixed(1)} KB\n\n\`\`\`${f.type === "html" ? "html" : f.type}\n${f.content.slice(0, 8000)}\n\`\`\`\n\nExplique o que esse arquivo faz, identifique a tecnologia usada, e diga como reproduzir funcionalidades semelhantes.`);
    onClose();
  };

  const totalSize = extracted.reduce((s, f) => s + f.size, 0);

  return (
    <div className="h-full flex flex-col bg-[#0d0d0d] text-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#141414] border-b border-gray-700/40 shrink-0">
        <Globe size={16} className="text-cyan-400" />
        <span className="text-sm font-bold flex-1">Extrator de Site</span>
        <span className="text-[10px] text-gray-600">Proxies CORS gratuitos</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-gray-500">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* URL input */}
        <div>
          <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">URL do Site</label>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && extractSite()}
              placeholder="https://exemplo.com"
              className="flex-1 px-3 py-2.5 bg-[#0e1a0a] border border-gray-700/50 rounded-xl text-[13px] font-mono text-gray-200 placeholder-gray-700 outline-none focus:border-cyan-500/60"
            />
            <button
              onClick={loading ? () => { abortRef.current = true; } : extractSite}
              disabled={!url.trim() && !loading}
              className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all ${loading ? "bg-red-600/20 border border-red-500/40 text-red-400" : "bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/40"}`}
            >
              {loading ? <><Loader2 size={13} className="inline animate-spin mr-1" />Parar</> : <><Search size={13} className="inline mr-1" />Extrair</>}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">Modo de Varredura</label>
            <div className="space-y-1.5">
              {([
                ["main",      "🏠 Página principal apenas"],
                ["subpages",  "📄 + Subpáginas (até 5)"],
                ["full",      "🌐 Varredura completa"],
              ] as [ScanMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setScanMode(mode)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[12px] border transition-all ${scanMode === mode ? "bg-cyan-900/30 border-cyan-500/50 text-cyan-300 font-bold" : "bg-[#0e1a0a] border-gray-700/40 text-gray-400 hover:border-gray-600/60"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">Proxy CORS</label>
            <div className="space-y-1.5">
              {(Object.entries(PROXY_LABELS) as [ProxyOption, string][]).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => setProxy(p)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[12px] border transition-all ${proxy === p ? "bg-blue-900/30 border-blue-500/50 text-blue-300 font-bold" : "bg-[#0e1a0a] border-gray-700/40 text-gray-400 hover:border-gray-600/60"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-700/40 rounded-xl">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-300">{error}</p>
          </div>
        )}

        {/* Progress */}
        {progress.length > 0 && (
          <div>
            <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">
              Log de Extração {loading && <Loader2 size={10} className="inline animate-spin ml-1" />}
            </label>
            <div className="bg-[#0d1117] border border-gray-800/50 rounded-xl p-3 max-h-36 overflow-y-auto font-mono">
              {progress.map((p, i) => (
                <div key={i} className="text-[11px] text-gray-400 leading-5">{p}</div>
              ))}
            </div>
          </div>
        )}

        {/* Extracted files */}
        {extracted.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                {extracted.length} Arquivo(s) Extraído(s) — {(totalSize / 1024).toFixed(1)} KB
              </label>
              <button
                onClick={saveAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/30 border border-green-500/40 rounded-xl text-[11px] text-green-300 font-bold hover:bg-green-600/40"
              >
                <FolderDown size={12} /> Salvar Todos no Projeto
              </button>
            </div>

            <div className="space-y-2">
              {extracted.map((f) => {
                const icon = f.type === "html" ? <Globe size={12} className="text-orange-400" />
                  : f.type === "css" ? <FileCode2 size={12} className="text-blue-400" />
                  : f.type === "js"  ? <FileCode2 size={12} className="text-yellow-400" />
                  : <Image size={12} className="text-purple-400" />;

                return (
                  <div key={f.path} className="bg-[#0e1a0a] border border-gray-700/40 rounded-xl overflow-hidden">
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
                      onClick={() => setExpandedFile(expandedFile === f.path ? null : f.path)}
                    >
                      {icon}
                      <span className="flex-1 text-[12px] font-mono text-gray-300 truncate">{f.path}</span>
                      <span className="text-[10px] text-gray-600 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); copyFile(f.content, f.path); }}
                          className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-gray-300"
                          title="Copiar conteúdo"
                        >
                          {copiedFile === f.path ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                        </button>
                        {onAnalyzeWithAI && (
                          <button
                            onClick={e => { e.stopPropagation(); analyzeFile(f); }}
                            className="p-1 rounded hover:bg-purple-900/30 text-gray-600 hover:text-purple-400"
                            title="Analisar com IA"
                          >
                            <Bot size={11} />
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); const record: Record<string, string> = {}; record[f.path] = f.content; onSaveToVFS(record); }}
                          className="p-1 rounded hover:bg-green-900/20 text-gray-600 hover:text-green-400"
                          title="Salvar este arquivo"
                        >
                          <Download size={11} />
                        </button>
                        {expandedFile === f.path ? <ChevronDown size={11} className="text-gray-500" /> : <ChevronRight size={11} className="text-gray-500" />}
                      </div>
                    </div>
                    {expandedFile === f.path && (
                      <div className="border-t border-gray-700/30 max-h-48 overflow-y-auto">
                        <pre className="p-3 text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-all">
                          {f.content.slice(0, 3000)}
                          {f.content.length > 3000 && "\n...(truncado)"}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tips */}
        {!loading && extracted.length === 0 && !error && (
          <div className="p-4 bg-[#0e1a0a] border border-gray-700/30 rounded-xl space-y-2">
            <p className="text-[12px] text-gray-400 font-bold">💡 Como funciona</p>
            <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
              <li>Cole a URL de qualquer site público</li>
              <li>O extrator usa proxies gratuitos para contornar bloqueios CORS</li>
              <li>HTML, CSS e JS são salvos no seu projeto</li>
              <li>Use a IA para analisar e entender cada arquivo extraído</li>
              <li>Modo <b className="text-gray-400">Completo</b> extrai todas as subpáginas encontradas</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
