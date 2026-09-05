import { useState, useRef, useCallback } from "react";
import { X, Play, Trash2, Copy, Check, Download, ExternalLink, Upload, Code2, Maximize2 } from "lucide-react";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playground HTML</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d1117;
      color: #e6edf3;
      padding: 2rem;
      min-height: 100vh;
    }
    h1 { color: #58a6ff; margin-bottom: 1rem; font-size: 1.8rem; }
    p { color: #8b949e; line-height: 1.6; margin-bottom: 1rem; }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 1.5rem;
      margin: 1rem 0;
    }
    button {
      background: #238636;
      color: white;
      border: none;
      padding: 0.6rem 1.4rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-top: 0.5rem;
      transition: background 0.2s;
    }
    button:hover { background: #2ea043; }
    .badge {
      display: inline-block;
      background: #1f6feb;
      color: white;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 20px;
      margin-right: 4px;
    }
  </style>
</head>
<body>
  <h1>🚀 Playground HTML</h1>
  <p>
    <span class="badge">Cole</span>
    <span class="badge">Edite</span>
    <span class="badge">Visualize</span>
  </p>
  <p>Edite o código ao lado e clique em <strong>Executar</strong> para ver o resultado aqui em tempo real.</p>
  <div class="card">
    <p>Este é um card de exemplo. Modifique o HTML, CSS e JavaScript como quiser!</p>
    <button onclick="alert('Funcionou! ✅')">Clique para testar</button>
  </div>
  <script>
    console.log('Playground HTML iniciado! 🎯');
  </script>
</body>
</html>`;

interface HTMLPlaygroundProps {
  onClose: () => void;
  initialHtml?: string;
}

export default function HTMLPlayground({ onClose, initialHtml }: HTMLPlaygroundProps) {
  const [code, setCode] = useState(initialHtml || DEFAULT_HTML);
  const [preview, setPreview] = useState(initialHtml || DEFAULT_HTML);
  const [copied, setCopied] = useState(false);
  const [fullPreview, setFullPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(() => setPreview(code), [code]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const download = useCallback(() => {
    const blob = new Blob([code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [code]);

  const openInTab = useCallback(() => {
    const blob = new Blob([preview], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [preview]);

  const importFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCode(text);
      setPreview(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = code.substring(0, start) + "  " + code.substring(end);
      setCode(newVal);
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2; }, 0);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      run();
    }
  }, [code, run]);

  return (
    <div className="fixed inset-0 z-[9995] flex flex-col bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60 bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <Code2 size={18} className="text-orange-400" />
          <span className="text-[15px] font-bold text-white">Playground HTML</span>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full hidden sm:block">
            Cole · Edite · Execute · Baixe · Abra
          </span>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-700/30 bg-[#111622] shrink-0 overflow-x-auto">
        <button
          onClick={run}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-500/40 rounded-lg text-green-300 text-[12px] font-bold hover:bg-green-600/30 transition-colors whitespace-nowrap"
          title="Ctrl+Enter"
        >
          <Play size={12} /> Executar
        </button>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 rounded-lg text-blue-300 text-[12px] font-semibold hover:bg-blue-600/30 transition-colors whitespace-nowrap"
        >
          {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar</>}
        </button>
        <button
          onClick={download}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/40 rounded-lg text-purple-300 text-[12px] font-semibold hover:bg-purple-600/30 transition-colors whitespace-nowrap"
        >
          <Download size={12} /> Baixar .html
        </button>
        <button
          onClick={openInTab}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 border border-yellow-500/40 rounded-lg text-yellow-300 text-[12px] font-semibold hover:bg-yellow-600/30 transition-colors whitespace-nowrap"
        >
          <ExternalLink size={12} /> Nova aba
        </button>
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/40 border border-gray-600/40 rounded-lg text-gray-300 text-[12px] font-semibold hover:bg-gray-700/60 transition-colors cursor-pointer whitespace-nowrap">
          <Upload size={12} /> Importar
          <input ref={fileInputRef} type="file" accept=".html,.htm,.txt" onChange={importFile} className="hidden" />
        </label>
        <button
          onClick={() => setFullPreview(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/40 border border-gray-600/40 rounded-lg text-gray-300 text-[12px] font-semibold hover:bg-gray-700/60 transition-colors whitespace-nowrap"
        >
          <Maximize2 size={12} /> {fullPreview ? "Editor" : "Preview"}
        </button>
        <button
          onClick={() => { setCode(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 text-[12px] font-semibold hover:bg-red-900/30 transition-colors whitespace-nowrap ml-auto"
        >
          <Trash2 size={12} /> Limpar
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!fullPreview && (
          <div className="flex flex-col border-r border-gray-700/40" style={{ width: fullPreview ? "0" : "50%" }}>
            <div className="px-3 py-1.5 bg-[#161b22] border-b border-gray-700/30 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-gray-500 font-mono">HTML · CSS · JavaScript</span>
              <span className="text-[10px] text-gray-600">{code.split("\n").length} linhas · Ctrl+Enter para executar</span>
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="flex-1 bg-[#0d1117] text-[#e6edf3] font-mono text-[12px] p-3 resize-none outline-none leading-relaxed"
              placeholder="Cole seu HTML aqui e clique em Executar (ou Ctrl+Enter)..."
            />
          </div>
        )}

        <div className="flex flex-col" style={{ width: fullPreview ? "100%" : "50%" }}>
          <div className="px-3 py-1.5 bg-[#161b22] border-b border-gray-700/30 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-gray-500 font-mono">preview</span>
            <span className="text-[10px] text-gray-600">resultado ao vivo · scripts habilitados</span>
          </div>
          <iframe
            srcDoc={preview}
            className="flex-1 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="HTML Preview"
          />
        </div>
      </div>
    </div>
  );
}
