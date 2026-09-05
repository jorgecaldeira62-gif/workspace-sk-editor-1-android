import { useState, useEffect, useRef, useMemo } from "react";
import { VirtualFileSystem } from "@/lib/virtual-fs";
import { RefreshCw, Smartphone, Monitor, Tablet, FileJson, FileCode2, FileText, Globe, Maximize2, X } from "lucide-react";

interface PreviewProps {
  vfs: VirtualFileSystem;
  activeFile?: string | null;
  openFullscreen?: boolean;
  onFullscreenOpened?: () => void;
  serverUrl?: string;
  serverPort?: number;
}

type ViewportSize = "mobile" | "tablet" | "desktop";

// ─── Markdown → HTML (sem dependências externas) ──────────────────────────
function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre><code>${code.trim()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headings
    .replace(/^#{6}\s(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s(.+)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s(.+)$/gm, "<h4>$1</h4>")
    .replace(/^#{3}\s(.+)$/gm, "<h3>$1</h3>")
    .replace(/^#{2}\s(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#{1}\s(.+)$/gm, "<h1>$1</h1>")
    // HR
    .replace(/^---+$/gm, "<hr>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Links & images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Blockquote
    .replace(/^&gt;\s(.+)$/gm, "<blockquote>$1</blockquote>")
    // Unordered lists
    .replace(/^[\*\-]\s(.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>")
    // Paragraphs (double newline)
    .replace(/\n\n(?!<[hbulp])/g, "</p><p>")
    // Line breaks
    .replace(/\n(?!<)/g, "<br>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>)(\s*<br>\s*)*(<li>|$)/gs, (m) =>
    "<ul>" + m.replace(/<br>\s*/g, "") + "</ul>");

  return `<p>${html}</p>`;
}

// ─── JSON → HTML colorido ──────────────────────────────────────────────────
function jsonToHtml(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    const highlighted = pretty
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"(.*?)":/g, '<span class="jk">"$1"</span>:')
      .replace(/:\s*"(.*?)"/g, ': <span class="js">"$1"</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="jn">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="jb">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="jnull">$1</span>');
    return `<pre class="json-pre">${highlighted}</pre>`;
  } catch {
    return `<div class="error">JSON inválido</div><pre>${raw.replace(/</g, "&lt;")}</pre>`;
  }
}

// ─── Monta HTML completo inlining CSS/JS referenciados ────────────────────
function buildHtml(vfs: VirtualFileSystem, htmlFile: string): string {
  let html = vfs.readFile(htmlFile) || "";

  // Inline CSS <link> tags
  const cssLinks = [...html.matchAll(/<link[^>]*href=["']([^"']+\.css)["'][^>]*\/?>/gi)];
  for (const [tag, href] of cssLinks) {
    const content = vfs.readFile(href) || vfs.readFile(href.replace(/^\.\//, ""));
    if (content) html = html.replace(tag, `<style>${content}</style>`);
  }

  // Inline JS <script src> tags
  const scriptTags = [...html.matchAll(/<script[^>]+src=["']([^"']+\.(?:js|mjs))["'][^>]*>\s*<\/script>/gi)];
  for (const [tag, src] of scriptTags) {
    const content = vfs.readFile(src) || vfs.readFile(src.replace(/^\.\//, ""));
    if (content) html = html.replace(tag, `<script>${content}</script>`);
  }

  return html;
}

// ─── CSS Preview ───────────────────────────────────────────────────────────
function buildCssPreview(css: string): string {
  return `<!DOCTYPE html><html><head><style>
  body{margin:0;padding:24px;background:#111;color:#eee;font-family:system-ui}
  ${css}
  </style></head><body>
  <div class="container">
    <h1>Prévia CSS</h1>
    <p>Este é um parágrafo de exemplo para visualizar seus estilos.</p>
    <button class="btn">Botão de exemplo</button>
    <a href="#" class="link">Link de exemplo</a>
    <div class="card"><p>Card de conteúdo</p></div>
    <ul><li>Item um</li><li>Item dois</li><li>Item três</li></ul>
    <input placeholder="Campo de texto" class="input" />
    <div class="badge">Badge</div>
  </div>
  </body></html>`;
}

// ─── JS/TS execution preview ──────────────────────────────────────────────
function buildJsRunner(code: string): string {
  const safe = code.replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><head><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#161e0f;color:#d4d8c8;font-family:'JetBrains Mono',monospace;font-size:13px;padding:16px}
  .line{padding:2px 0;display:flex;gap:8px}
  .log .pfx{color:#6a9a50}
  .err .pfx{color:#f87171}
  .warn .pfx{color:#fbbf24}
  .pfx{font-size:11px;padding-top:1px;user-select:none;white-space:nowrap}
  .val{white-space:pre-wrap;word-break:break-all;flex:1}
  .string{color:#c9d982} .number{color:#e0c97a} .boolean{color:#7dbda8}
  .null{color:#888} .obj{color:#b8d4a0}
  #empty{color:#5a7a45;margin-top:24px;text-align:center;font-size:12px}
  </style></head><body>
  <div id="out"></div><div id="empty"></div>
  <script>
  const out = document.getElementById('out');
  const empty = document.getElementById('empty');
  let count = 0;
  function fmt(v){
    if(v===null) return '<span class="null">null</span>';
    if(v===undefined) return '<span class="null">undefined</span>';
    if(typeof v==='string') return '<span class="string">"'+String(v).replace(/</g,'&lt;')+'&quot;</span>';
    if(typeof v==='number') return '<span class="number">'+v+'</span>';
    if(typeof v==='boolean') return '<span class="boolean">'+v+'</span>';
    if(typeof v==='object'){
      try{return '<span class="obj">'+JSON.stringify(v,null,2).replace(/</g,'&lt;')+'</span>'}catch{return '<span class="obj">[objeto]</span>'}
    }
    return String(v).replace(/</g,'&lt;');
  }
  function addLine(type,args){
    count++;
    const d=document.createElement('div');
    d.className='line '+type;
    d.innerHTML='<span class="pfx">'+{log:'▶',error:'✖',warn:'⚠'}[type]+'</span><span class="val">'+args.map(fmt).join(' ')+'</span>';
    out.appendChild(d);
  }
  const _log=console.log,_err=console.error,_warn=console.warn;
  console.log=(...a)=>{_log(...a);addLine('log',a)};
  console.error=(...a)=>{_err(...a);addLine('err',a)};
  console.warn=(...a)=>{_warn(...a);addLine('warn',a)};
  window.onerror=(msg,_,l,c)=>{addLine('err',['Erro na linha '+l+':'+c+' — '+msg]);return true};
  try{
    ${safe}
  }catch(e){addLine('err',[e.toString()])}
  if(count===0) empty.textContent='Nenhuma saída. Use console.log() para ver resultados aqui.';
  </script></body></html>`;
}

export default function Preview({ vfs, activeFile, openFullscreen, onFullscreenOpened, serverUrl, serverPort }: PreviewProps) {
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const iframeFullRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>("mobile");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  useEffect(() => {
    if (openFullscreen) {
      setShowFullscreen(true);
      onFullscreenOpened?.();
    }
  }, [openFullscreen]);

  const ext = activeFile?.split(".").pop()?.toLowerCase() ?? "";

  type RenderMode = "server" | "html" | "json" | "markdown" | "css" | "js" | "none";

  const mode: RenderMode = useMemo(() => {
    // Servidor rodando — prioridade máxima
    if (serverUrl) return "server";
    if (["html", "htm", "svg"].includes(ext)) return "html";
    if (ext === "json") return "json";
    if (["md", "markdown"].includes(ext)) return "markdown";
    if (["css", "scss", "sass"].includes(ext)) return "css";
    if (["js", "ts", "mjs", "cjs"].includes(ext)) return "js";
    // fallback: if project has index.html, show it
    if (vfs.readFile("index.html")) return "html";
    return "none";
  }, [ext, activeFile, refreshKey, serverUrl]);

  const iframeContent = useMemo((): string | null => {
    const content = activeFile ? vfs.readFile(activeFile) ?? "" : "";

    if (mode === "html") {
      const htmlFile = (activeFile && ["html","htm","svg"].includes(ext))
        ? activeFile
        : "index.html";
      const raw = vfs.readFile(htmlFile);
      if (!raw) return null;
      return buildHtml(vfs, htmlFile);
    }
    if (mode === "css") return buildCssPreview(content);
    if (mode === "js") return buildJsRunner(content);
    return null; // JSON/Markdown handled separately
  }, [vfs, activeFile, mode, refreshKey]);

  const richContent = useMemo((): string | null => {
    if (mode === "json") {
      const content = activeFile ? vfs.readFile(activeFile) ?? "" : "";
      return jsonToHtml(content);
    }
    if (mode === "markdown") {
      const content = activeFile ? vfs.readFile(activeFile) ?? "" : "";
      return markdownToHtml(content);
    }
    return null;
  }, [vfs, activeFile, mode, refreshKey]);

  useEffect(() => {
    if (iframeContent === null) return;
    for (const ref of [iframeRef, iframeFullRef]) {
      const iframe = ref.current;
      if (!iframe) continue;
      const doc = iframe.contentDocument;
      if (doc) { doc.open(); doc.write(iframeContent); doc.close(); }
    }
  }, [iframeContent, showFullscreen]);

  const viewportClass = viewport === "mobile" ? "max-w-[375px]"
    : viewport === "tablet" ? "max-w-[768px]" : "max-w-full";

  const modeLabel: Record<RenderMode, { icon: React.ReactNode; label: string }> = {
    server:   { icon: <Globe size={12} className="text-green-400" />, label: `Servidor :${serverPort}` },
    html:     { icon: <Globe size={12} />,      label: "HTML" },
    json:     { icon: <FileJson size={12} />,   label: "JSON" },
    markdown: { icon: <FileText size={12} />,   label: "Markdown" },
    css:      { icon: <FileCode2 size={12} />,  label: "CSS Preview" },
    js:       { icon: <FileCode2 size={12} />,  label: "JS Runner" },
    none:     { icon: <FileCode2 size={12} />,  label: "Preview" },
  };

  const hasContent = mode === "server" || (mode !== "none" && (iframeContent || richContent));

  return (
    <>
    {/* ── Modal Tela Cheia ─────────────────────────────────────────── */}
    {showFullscreen && (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
        {/* Barra superior do fullscreen */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-gray-700/50 shrink-0">
          <div className="flex items-center gap-2 text-gray-300">
            {modeLabel[mode].icon}
            <span className="text-[13px] font-semibold">
              {modeLabel[mode].label}
              {activeFile && <span className="text-gray-600 ml-2 font-normal">{activeFile.split("/").pop()}</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Seletores de viewport */}
            {(mode === "html" || mode === "css") && (
              <div className="flex items-center gap-1 bg-[#0d0d0d] border border-gray-700/40 rounded-xl p-0.5">
                <button onClick={() => setViewport("mobile")} title="Mobile (375px)"
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${viewport === "mobile" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  <Smartphone size={13} /> 375px
                </button>
                <button onClick={() => setViewport("tablet")} title="Tablet (768px)"
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${viewport === "tablet" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  <Tablet size={13} /> 768px
                </button>
                <button onClick={() => setViewport("desktop")} title="Desktop"
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${viewport === "desktop" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  <Monitor size={13} /> Completo
                </button>
              </div>
            )}
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="p-2 rounded-xl bg-[#0d0d0d] border border-gray-700/40 text-gray-500 hover:text-gray-300" title="Recarregar">
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30" title="Fechar tela cheia">
              <X size={15} />
            </button>
          </div>
        </div>
        {/* Conteúdo fullscreen */}
        <div className="flex-1 overflow-auto flex justify-center bg-white">
          {/* Servidor Node.js fullscreen */}
          {mode === "server" && serverUrl && (
            <iframe
              key={refreshKey}
              src={serverUrl}
              className="w-full h-full"
              title="Node.js Server Preview Fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            />
          )}
          {(mode === "html" || mode === "css" || mode === "js") && iframeContent && (
            <div className={`w-full h-full ${(mode === "html" || mode === "css") ? viewportClass : "max-w-full"}`}>
              <iframe
                ref={iframeFullRef}
                className="w-full h-full"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                title="Preview Tela Cheia"
              />
            </div>
          )}
          {mode === "json" && richContent && (
            <div className="w-full h-full overflow-auto p-6 bg-[#161e0f]">
              <style>{`.json-pre{background:#161e0f;padding:16px;border-radius:10px;font-family:monospace;font-size:14px;line-height:1.7}.jk{color:#7dbda8}.js{color:#c9d982}.jn{color:#e0c97a}.jb{color:#8fc87c}.jnull{color:#888}`}</style>
              <div dangerouslySetInnerHTML={{ __html: richContent }} />
            </div>
          )}
          {mode === "markdown" && richContent && (
            <div className="w-full overflow-auto p-8 bg-[#161e0f]">
              <style>{`.md-body{max-width:780px;margin:0 auto;color:#d4d8c8;font-family:system-ui;line-height:1.8;font-size:16px}.md-body h1{font-size:2.2em;border-bottom:2px solid #2d3e20;padding-bottom:.3em;margin-bottom:.5em}.md-body h2{font-size:1.6em;border-bottom:1px solid #2d3e20;padding-bottom:.2em}.md-body code{background:#141414;color:#c9d982;padding:2px 8px;border-radius:4px;font-family:monospace}.md-body pre{background:#141414;border:1px solid #2d3e20;border-radius:10px;padding:20px;overflow:auto}.md-body a{color:#8fc87c}.md-body blockquote{border-left:4px solid #3a5228;margin:1em 0;padding:.8em 1.2em;background:#1a2410;border-radius:0 8px 8px 0}`}</style>
              <div className="md-body" dangerouslySetInnerHTML={{ __html: richContent }} />
            </div>
          )}
          {!hasContent && (
            <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#0d0d0d]">
              <FileCode2 size={48} className="text-gray-700" />
              <p className="text-gray-500 text-base">Sem conteúdo para visualizar</p>
              <p className="text-gray-700 text-sm">Crie um arquivo <code className="text-gray-500">index.html</code> ou abra um arquivo HTML</p>
            </div>
          )}
        </div>
      </div>
    )}

    <div className="h-full flex flex-col bg-[#0d0d0d]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700/50 bg-[#141414] shrink-0">
        <div className="flex items-center gap-1.5 text-gray-400">
          {modeLabel[mode].icon}
          <span className="text-[11px] font-medium">{modeLabel[mode].label}</span>
          {activeFile && (
            <span className="text-[10px] text-gray-600 ml-1 truncate max-w-[120px]">
              {activeFile.split("/").pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(mode === "html" || mode === "css") && (
            <>
              <button onClick={() => setViewport("mobile")}
                className={`p-1 rounded ${viewport === "mobile" ? "bg-blue-500/20 text-blue-400" : "text-gray-600 hover:text-gray-300"}`}
                title="Mobile (375px)">
                <Smartphone size={13} />
              </button>
              <button onClick={() => setViewport("tablet")}
                className={`p-1 rounded ${viewport === "tablet" ? "bg-blue-500/20 text-blue-400" : "text-gray-600 hover:text-gray-300"}`}
                title="Tablet (768px)">
                <Tablet size={13} />
              </button>
              <button onClick={() => setViewport("desktop")}
                className={`p-1 rounded ${viewport === "desktop" ? "bg-blue-500/20 text-blue-400" : "text-gray-600 hover:text-gray-300"}`}
                title="Desktop">
                <Monitor size={13} />
              </button>
              <div className="w-px h-3.5 bg-gray-700 mx-0.5" />
            </>
          )}
          <button onClick={() => setRefreshKey(k => k + 1)}
            className="p-1 text-gray-600 hover:text-gray-300 rounded" title="Recarregar">
            <RefreshCw size={13} />
          </button>
          {hasContent && (
            <button
              onClick={() => setShowFullscreen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 text-[10px] font-bold transition-colors"
              title="Abrir em tela cheia">
              <Maximize2 size={11} /> Tela Cheia
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">

        {/* Modo Servidor Node.js — iframe proxy */}
        {mode === "server" && serverUrl && (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 border-b border-green-700/30 shrink-0">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
              <span className="text-green-400 text-[11px] font-bold">Servidor Node.js rodando na porta {serverPort}</span>
              <button onClick={() => setRefreshKey(k => k + 1)} className="ml-auto p-1 text-green-700 hover:text-green-400 rounded" title="Recarregar"><RefreshCw size={12} /></button>
            </div>
            <iframe
              key={refreshKey}
              src={serverUrl}
              className="flex-1 w-full bg-white"
              title="Node.js Server Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            />
          </div>
        )}

        {/* Iframe modes: HTML, CSS, JS */}
        {(mode === "html" || mode === "css" || mode === "js") && iframeContent && (
          <div className="h-full flex justify-center overflow-auto p-0">
            <div className={`w-full ${mode === "html" || mode === "css" ? viewportClass : "max-w-full"} h-full`}>
              <iframe
                ref={iframeRef}
                className="w-full h-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                title="Preview"
              />
            </div>
          </div>
        )}

        {/* No index.html found */}
        {mode === "html" && !iframeContent && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3">
            <Globe size={36} className="text-gray-700" />
            <p className="text-sm font-medium text-gray-500">Nenhum arquivo HTML encontrado</p>
            <p className="text-xs text-gray-700">Crie um arquivo <code className="text-gray-500">index.html</code> ou abra um arquivo <code className="text-gray-500">.html</code></p>
          </div>
        )}

        {/* JSON viewer */}
        {mode === "json" && richContent && (
          <div className="h-full overflow-auto p-4">
            <style>{`
              .json-pre { background: #161e0f; padding: 16px; border-radius: 10px; font-family: 'JetBrains Mono',monospace; font-size: 12px; line-height: 1.7; overflow: auto; border: 1px solid #2d3e20; }
              .jk { color: #7dbda8; }
              .js { color: #c9d982; }
              .jn { color: #e0c97a; }
              .jb { color: #8fc87c; }
              .jnull { color: #888; }
              .error { color: #f87171; padding: 8px 0; font-size: 12px; }
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: richContent }} />
          </div>
        )}

        {/* Markdown viewer */}
        {mode === "markdown" && richContent && (
          <div className="h-full overflow-auto p-5">
            <style>{`
              .md-body { max-width: 680px; margin: 0 auto; color: #d4d8c8; font-family: -apple-system,system-ui,sans-serif; line-height: 1.7; }
              .md-body h1,.md-body h2,.md-body h3,.md-body h4,.md-body h5,.md-body h6 { color: #e8ecdc; font-weight: 700; margin: 1.5em 0 0.5em; line-height: 1.3; }
              .md-body h1 { font-size: 2em; border-bottom: 2px solid #2d3e20; padding-bottom: 0.3em; }
              .md-body h2 { font-size: 1.5em; border-bottom: 1px solid #2d3e20; padding-bottom: 0.2em; }
              .md-body h3 { font-size: 1.25em; }
              .md-body p { margin: 0.8em 0; }
              .md-body a { color: #8fc87c; }
              .md-body code { background: #141414; color: #c9d982; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
              .md-body pre { background: #141414; border: 1px solid #2d3e20; border-radius: 10px; padding: 16px; overflow: auto; margin: 1em 0; }
              .md-body pre code { background: none; padding: 0; }
              .md-body blockquote { border-left: 3px solid #3a5228; margin: 1em 0; padding: 0.5em 1em; color: #7a8a6a; background: #1a2410; border-radius: 0 8px 8px 0; }
              .md-body ul,.md-body ol { margin: 0.8em 0; padding-left: 1.8em; }
              .md-body li { margin: 0.3em 0; }
              .md-body hr { border: none; border-top: 1px solid #2d3e20; margin: 1.5em 0; }
              .md-body img { max-width: 100%; border-radius: 8px; }
              .md-body strong { color: #e8ecdc; }
            `}</style>
            <div className="md-body" dangerouslySetInnerHTML={{ __html: richContent }} />
          </div>
        )}

        {/* No preview available */}
        {mode === "none" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-3">
            <FileCode2 size={36} className="text-gray-700" />
            <p className="text-sm font-medium text-gray-500">Preview não disponível</p>
            <p className="text-xs text-gray-700 leading-relaxed">
              Tipos suportados: <span className="text-gray-500">HTML · JSON · Markdown · CSS · JS/TS</span>
            </p>
            <div className="mt-2 px-4 py-3 bg-green-900/20 border border-green-700/30 rounded-xl max-w-xs text-left">
              <p className="text-[11px] text-green-400 font-bold mb-1">💡 Para ver apps Node.js aqui:</p>
              <p className="text-[11px] text-green-700 leading-relaxed">
                Abra o terminal e rode <code className="text-green-500">node app.js</code> ou <code className="text-green-500">npm start</code>.<br />
                O preview abrirá automaticamente quando o servidor iniciar.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
