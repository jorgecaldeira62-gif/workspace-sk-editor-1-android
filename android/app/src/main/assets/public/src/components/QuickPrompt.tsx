import { useState, useRef, useCallback, useEffect } from "react";
import { Wand2, X, Send, Loader2, CheckCheck, Mic, ChevronUp, ChevronDown } from "lucide-react";
import { getActiveSlot, loadAISlots, sendAIMessage, parseAIResponse, ParsedBlock } from "@/lib/ai-service";
import { loadTTSConfig, startSpeechRecognition } from "@/lib/tts-service";
import { VirtualFileSystem } from "@/lib/virtual-fs";

interface QuickPromptProps {
  vfs: VirtualFileSystem;
  activeFile: string | null;
  onApplyCode: (path: string, content: string) => void;
  onOpenTerminal: (cmd: string) => void;
}

interface QuickResult {
  type: "success" | "error" | "info";
  text: string;
  blocks: ParsedBlock[];
}

const QUICK_SUGGESTIONS = [
  "Corrija os erros neste arquivo",
  "Adicione comentarios ao codigo",
  "Crie um README para o projeto",
  "Otimize o desempenho deste codigo",
  "Adicione validacao de formulario",
  "Crie um .gitignore completo",
  "Transforme em TypeScript",
  "Adicione tratamento de erros",
];

export default function QuickPrompt({ vfs, activeFile, onApplyCode, onOpenTerminal }: QuickPromptProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [appliedCount, setAppliedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setResult(null);
    }
  }, [open]);

  const buildContext = useCallback(() => {
    const fileList = vfs.listFiles().join("\n");
    const currentContent = activeFile ? vfs.readFile(activeFile) || "" : "";
    const allContent = vfs.listFiles().slice(0, 15).map(f => {
      const c = vfs.readFile(f) || "";
      return `\n=== ${f} ===\n${c.slice(0, 2000)}`;
    }).join("");

    return `Voce e um assistente de programacao ultra-rapido integrado ao SK Code Editor.

PROJETO ATUAL:
${fileList || "(vazio)"}

${activeFile ? `ARQUIVO ATIVO: ${activeFile}\n${currentContent.slice(0, 5000)}` : "Nenhum arquivo ativo."}

TODOS OS ARQUIVOS:
${allContent.slice(0, 10000)}

INSTRUCOES:
- Responda em portugues brasileiro
- Para criar/editar arquivos use: \`\`\`filepath:caminho/arquivo.ext\ncontent\`\`\`
- Para comandos de terminal use: \`\`\`bash\ncomando\`\`\`
- Seja CONCISO mas COMPLETO - gere arquivos inteiros, nao parciais
- Aplique a mudanca solicitada imediatamente
- Voce tem acesso a: internet (via seu conhecimento), todos os arquivos do projeto, terminal`;
  }, [vfs, activeFile]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const slots = loadAISlots();
    const slot = getActiveSlot(slots);

    setHistory(prev => [msg, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setInput("");
    setLoading(true);
    setResult(null);
    setShowSuggestions(false);

    if (!slot) {
      setResult({ type: "error", text: "Configure uma chave de IA no painel de IA (barra inferior)", blocks: [] });
      setLoading(false);
      return;
    }

    try {
      const response = await sendAIMessage(
        [{ role: "user", content: msg }],
        slot,
        buildContext()
      );

      const blocks = parseAIResponse(response);
      let applied = 0;

      for (const block of blocks) {
        if (block.type === "file" && block.filePath && block.content) {
          onApplyCode(block.filePath, block.content);
          applied++;
        }
      }

      const textContent = blocks.filter(b => b.type === "text").map(b => b.content).join(" ").trim();
      setAppliedCount(prev => prev + applied);
      setResult({
        type: applied > 0 ? "success" : "info",
        text: applied > 0
          ? `✓ ${applied} arquivo(s) criado(s)/atualizado(s)${textContent ? ". " + textContent.slice(0, 200) : ""}`
          : textContent.slice(0, 400) || "Concluido",
        blocks,
      });
    } catch (err: any) {
      setResult({ type: "error", text: `Erro: ${err.message}`, blocks: [] });
    } finally {
      setLoading(false);
    }
  }, [input, loading, buildContext, onApplyCode]);

  const toggleVoice = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const config = loadTTSConfig();
    const rec = startSpeechRecognition(config.lang, (text) => {
      setInput(text);
    }, async () => {
      setIsRecording(false);
    });
    if (rec) { recognitionRef.current = rec; setIsRecording(true); }
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(idx);
      setInput(history[idx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setInput(history[historyIndex - 1] || ""); }
      else { setHistoryIndex(-1); setInput(""); }
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-16 right-3 z-40 w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/40 flex items-center justify-center hover:scale-110 transition-transform"
        title="Prompt rapido de IA"
      >
        <Wand2 size={18} className="text-white" />
        {appliedCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
            {appliedCount > 9 ? "9+" : appliedCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-14 right-2 left-2 sm:left-auto sm:w-[420px] z-50">
      <div className="bg-[#222e18] border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/40 bg-[#141414]">
          <Wand2 size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-gray-300 flex-1">Prompt Rapido de IA</span>
          {activeFile && <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{activeFile.split("/").pop()}</span>}
          <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-white/10 text-gray-500">
            <X size={13} />
          </button>
        </div>

        {/* Input */}
        <div className="p-2">
          <div className="flex items-center gap-2 bg-[#0d0d0d] rounded-xl px-3 py-2 border border-gray-700/40 focus-within:border-purple-500/50">
            <button onClick={toggleVoice}
              className={`p-1 rounded-lg shrink-0 ${isRecording ? "bg-red-500/20 text-red-400 animate-pulse" : "text-gray-600 hover:text-gray-400"}`}>
              <Mic size={14} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); setShowSuggestions(false); }}
              onKeyDown={handleKeyDown}
              placeholder="O que voce quer fazer? (Ex: crie uma API REST...)"
              className="flex-1 bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600"
            />
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="p-1 rounded hover:bg-white/10 text-gray-600"
              title="Sugestoes"
            >
              {showSuggestions ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg bg-purple-600 text-white disabled:opacity-30 hover:bg-purple-500"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </div>

          {/* Suggestions */}
          {showSuggestions && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {QUICK_SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); setShowSuggestions(false); inputRef.current?.focus(); }}
                  className="text-left px-2 py-1.5 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-[10px] text-gray-400 hover:text-gray-300 border border-gray-700/20">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result */}
        {loading && (
          <div className="px-3 py-2 border-t border-gray-700/30 flex items-center gap-2">
            <Loader2 size={13} className="animate-spin text-purple-400 shrink-0" />
            <span className="text-xs text-gray-400">Processando com IA...</span>
          </div>
        )}

        {result && !loading && (
          <div className={`px-3 py-2 border-t text-xs leading-relaxed ${
            result.type === "success" ? "border-green-500/20 bg-green-500/5 text-green-300" :
            result.type === "error" ? "border-red-500/20 bg-red-500/5 text-red-300" :
            "border-blue-500/20 bg-blue-500/5 text-blue-300"
          }`}>
            <div className="flex items-start gap-1.5">
              {result.type === "success" && <CheckCheck size={12} className="mt-0.5 shrink-0" />}
              <p className="break-words">{result.text}</p>
            </div>

            {/* Commands to run */}
            {result.blocks.filter(b => b.type === "command").map((block, i) => (
              <button key={i} onClick={() => onOpenTerminal(block.content)}
                className="mt-1.5 w-full text-left px-2 py-1 bg-green-600/20 border border-green-500/30 rounded-lg text-[10px] text-green-400 font-mono hover:bg-green-600/30">
                ▶ {block.content.slice(0, 80)}
              </button>
            ))}
          </div>
        )}

        {/* History hint */}
        {history.length > 0 && !loading && !result && (
          <div className="px-3 pb-2 text-[9px] text-gray-700">
            ↑↓ historico · Enter para enviar · Esc para fechar
          </div>
        )}
      </div>
    </div>
  );
}
