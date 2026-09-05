import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.min.css";
import {
  Send, Mic, Bot, User, Settings, Loader2,
  CheckCheck, Play, Copy, ChevronDown, ChevronUp, Wand2, Bug,
  Globe, Folder, FileText, Circle, Trash2, X, GitBranch, Package,
  Terminal as TerminalIcon, Zap, Lightbulb, Sparkles, Search, ExternalLink, Radio,
  Volume2, VolumeX,
} from "lucide-react";
import {
  AIMessage, AIKeySlot, loadAISlots, saveAISlots,
  getActiveSlot, sendAIMessage, sendBuiltinAI, parseAIResponse, ParsedBlock, testAISlot,
  slotCanStream, getStreamUrl, getStreamHeaders, getStreamBody,
} from "@/lib/ai-service";
import {
  TTSConfig, loadTTSConfig, saveTTSConfig, startSpeechRecognition, getAvailableVoices, cleanForSpeech,
} from "@/lib/tts-service";
import { VirtualFileSystem } from "@/lib/virtual-fs";
import VoiceCard from "./VoiceCard";

export type AIScope = "project" | "folder" | "file" | "none";

interface AIChatProps {
  vfs: VirtualFileSystem;
  activeFile: string | null;
  onApplyCode: (path: string, content: string) => void;
  onRunInTerminal: (cmd: string) => void;
  scope: AIScope;
  onScopeChange: (scope: AIScope) => void;
  autoVoice?: boolean;
  onAutoVoiceConsumed?: () => void;
  externalMessage?: string;
  onExternalMessageConsumed?: () => void;
  lastTermOutput?: { cmd: string; output: string; ok: boolean };
  onTermOutputConsumed?: () => void;
  terminalBuffer?: string;
  terminalHasError?: boolean;
  dbConnectionString?: string;
}

interface DisplayMessage {
  role: "user" | "assistant";
  raw: string;
  blocks?: ParsedBlock[];
}

function CopyBtn({ text, className = "", label }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`flex items-center gap-1.5 transition-colors ${className}`}
      title="Copiar"
    >
      {copied
        ? <><CheckCheck size={13} className="text-green-400" />{label && <span className="text-green-400 text-[12px] font-semibold">Copiado!</span>}</>
        : <><Copy size={13} />{label && <span className="text-[12px]">{label}</span>}</>
      }
    </button>
  );
}

// ─── ReactMarkdown code renderer ─────────────────────────────────────────────

function MdCodeBlock({
  lang, code, onApply, onRun,
}: { lang: string; code: string; onApply: (p: string, c: string) => void; onRun: (c: string) => void }) {
  const [applied, setApplied] = useState(false);

  if (lang.startsWith("filepath:")) {
    const filePath = lang.slice("filepath:".length).trim();
    return (
      <div className="rounded-xl overflow-hidden border border-blue-500/25 bg-blue-950/15 my-2">
        <div className="flex items-center justify-between px-3 py-1.5 bg-blue-900/20 border-b border-blue-500/15">
          <span className="text-[10px] text-blue-400 font-mono truncate flex-1">{filePath}</span>
          <CopyBtn text={code} />
        </div>
        <pre className="text-[11px] px-3 py-2 overflow-x-auto text-gray-300 font-mono leading-relaxed max-h-52 overflow-y-auto">{code}</pre>
        <div className="px-3 py-2.5 border-t border-blue-500/15 flex gap-2">
          <button
            onClick={() => { onApply(filePath, code); setApplied(true); setTimeout(() => setApplied(false), 2000); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 ${applied ? "bg-green-600/30 text-green-300 border border-green-500/25" : "bg-blue-600 text-white hover:bg-blue-500"}`}
          >
            {applied ? <><CheckCheck size={14} /> Aplicado!</> : <><Wand2 size={14} /> Aplicar Arquivo</>}
          </button>
          <CopyBtn text={code} label="Copiar" className="px-3 py-2 rounded-xl border border-gray-600/40 text-gray-400 hover:text-gray-200 hover:border-gray-500 hover:bg-white/5 text-[12px]" />
        </div>
      </div>
    );
  }

  if (["bash", "shell", "sh", "cmd", "command"].includes(lang)) {
    return (
      <div className="rounded-xl overflow-hidden border border-green-500/30 bg-green-950/20 my-2">
        <div className="flex items-center justify-between px-3 py-1.5 bg-green-900/25 border-b border-green-500/20">
          <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">⚡ Terminal</span>
          <CopyBtn text={code} />
        </div>
        <pre className="text-[12px] px-3 py-2 text-green-300 font-mono leading-relaxed whitespace-pre-wrap">{code}</pre>
        <div className="px-3 py-2.5 border-t border-green-500/20 flex gap-2">
          <button onClick={() => onRun(code)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-green-600 text-white hover:bg-green-500 active:scale-95 transition-all">
            <Play size={14} /> Executar
          </button>
          <CopyBtn text={code} label="Copiar" className="px-3 py-2 rounded-xl border border-gray-600/40 text-gray-400 hover:text-gray-200 hover:border-gray-500 hover:bg-white/5 text-[12px]" />
        </div>
      </div>
    );
  }

  return null;
}

function makeMdComponents(
  onApply: (p: string, c: string) => void,
  onRun: (c: string) => void
): Components {
  return {
    code({ className, children, ...rest }) {
      // rehypeHighlight may produce "hljs language-bash" — extract lang via regex
      const langMatch = (className ?? "").match(/language-(\S+)/);
      const lang = langMatch ? langMatch[1] : "";
      const code = String(children).replace(/\n$/, "");
      const isBlock = lang || code.includes("\n");
      if (!isBlock) {
        return <code className="bg-gray-800/70 text-green-300 px-1 py-0.5 rounded text-[11px] md:text-[13px] font-mono">{children}</code>;
      }
      // special interactive cards
      if (lang.startsWith("filepath:") || ["bash", "shell", "sh", "cmd", "command"].includes(lang)) {
        return <MdCodeBlock lang={lang} code={code} onApply={onApply} onRun={onRun} />;
      }
      // regular syntax-highlighted block — keep rehype classes
      return <code className={`${className ?? ""} text-[11px] md:text-[13px] leading-relaxed`} {...rest}>{children}</code>;
    },
    pre({ children, ...rest }) {
      // Detect if child is an interactive card — check using regex to handle "hljs language-xxx"
      const childEl = React.Children.toArray(children)[0] as React.ReactElement<{ className?: string }> | undefined;
      const childClass = childEl?.props?.className ?? "";
      const langMatch = childClass.match(/language-(\S+)/);
      const lang = langMatch ? langMatch[1] : "";
      const isInteractive = lang.startsWith("filepath:") || ["bash", "shell", "sh", "cmd", "command"].includes(lang);
      if (isInteractive) return <>{children}</>;

      const extractText = (node: React.ReactNode): string => {
        if (typeof node === "string") return node;
        if (Array.isArray(node)) return node.map(extractText).join("");
        if (node && typeof node === "object" && "props" in node)
          return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children ?? "");
        return "";
      };
      return (
        <div className="relative group/pre my-2">
          <div className="absolute right-2 top-2 opacity-0 group-hover/pre:opacity-100 transition-opacity z-10">
            <CopyBtn text={extractText(children)} className="bg-gray-900/80 border border-gray-700/50 rounded px-1.5 py-1" />
          </div>
          <pre className="rounded-xl overflow-x-auto text-[11px] md:text-[13px] leading-relaxed md:leading-[1.55] !bg-[#0d1117] p-3 md:p-4 border border-gray-700/30" {...rest}>{children}</pre>
        </div>
      );
    },
    a({ href, children, ...rest }) {
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-[13px] md:text-[15px]" {...rest}>{children}</a>;
    },
    table({ children, ...rest }) { return <div className="overflow-x-auto my-2"><table className="min-w-full border-collapse text-[11px] md:text-[14px]" {...rest}>{children}</table></div>; },
    th({ children, ...rest }) { return <th className="border border-gray-700 px-2 py-1 md:px-3 md:py-1.5 bg-gray-800/60 font-semibold text-left text-gray-300" {...rest}>{children}</th>; },
    td({ children, ...rest }) { return <td className="border border-gray-700/50 px-2 py-1 md:px-3 md:py-1.5 text-gray-300" {...rest}>{children}</td>; },
    h1({ children, ...rest }) { return <h1 className="text-[15px] md:text-[20px] font-bold text-gray-100 mt-3 mb-1 md:mt-4 md:mb-2" {...rest}>{children}</h1>; },
    h2({ children, ...rest }) { return <h2 className="text-[14px] md:text-[18px] font-bold text-gray-200 mt-2 mb-1 md:mt-3 md:mb-1.5" {...rest}>{children}</h2>; },
    h3({ children, ...rest }) { return <h3 className="text-[13px] md:text-[16px] font-semibold text-gray-200 mt-2 mb-0.5 md:mt-2.5 md:mb-1" {...rest}>{children}</h3>; },
    ul({ children, ...rest }) { return <ul className="list-disc list-inside space-y-0.5 md:space-y-1 text-[13px] md:text-[15px] text-gray-200 my-1 md:my-2 pl-2 leading-relaxed md:leading-[1.65]" {...rest}>{children}</ul>; },
    ol({ children, ...rest }) { return <ol className="list-decimal list-inside space-y-0.5 md:space-y-1 text-[13px] md:text-[15px] text-gray-200 my-1 md:my-2 pl-2 leading-relaxed md:leading-[1.65]" {...rest}>{children}</ol>; },
    p({ children, ...rest }) { return <p className="text-[13px] md:text-[15px] text-gray-100 leading-relaxed md:leading-[1.7] my-1 md:my-2" {...rest}>{children}</p>; },
    blockquote({ children, ...rest }) { return <blockquote className="border-l-2 md:border-l-4 border-blue-500/60 pl-3 md:pl-4 text-gray-300 italic my-1 md:my-2 text-[13px] md:text-[15px]" {...rest}>{children}</blockquote>; },
  };
}

// ─── VoicePicker — seletor de vozes disponíveis no dispositivo ───────────────

function VoicePicker({ config, onChange }: { config: TTSConfig; onChange: (c: TTSConfig) => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => {
      const v = getAvailableVoices(config.lang);
      setVoices(v);
    };
    load();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
  }, [config.lang]);

  if (!voices.length) {
    return <span className="text-[11px] text-gray-600 italic">Nenhuma voz encontrada para este idioma</span>;
  }

  return (
    <select
      value={config.voiceName}
      onChange={e => onChange({ ...config, voiceName: e.target.value })}
      className="flex-1 p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-[11px]"
    >
      <option value="">Auto (Francisco / melhor disponível)</option>
      {voices.map(v => (
        <option key={v.name} value={v.name}>
          {v.name}{v.name.toLowerCase().includes("francisco") ? " ⭐" : v.name.toLowerCase().includes("luciana") ? " ⭐" : ""}
        </option>
      ))}
    </select>
  );
}

// ─── EmptyChatState — botões de categoria expansíveis ────────────────────────

const ACTION_CATEGORIES = [
  {
    icon: "🔍", label: "Analisar", color: "blue",
    sub: [
      "Analise o arquivo atual e aponte erros",
      "Detecte bugs em todo o projeto",
      "Verifique a segurança do código",
      "Analise a performance do projeto",
    ],
  },
  {
    icon: "📁", label: "Criar", color: "purple",
    sub: [
      "Crie um index.html com landing page bonita",
      "Crie um servidor Node.js com Express",
      "Crie um componente React com TypeScript",
      "Crie um script Python com argumentos",
    ],
  },
  {
    icon: "📦", label: "Instalar", color: "green",
    sub: [
      "Instale express e configure servidor básico",
      "Configure React com Vite e TypeScript",
      "Instale e configure ESLint e Prettier",
      "Crie um package.json completo para o projeto",
    ],
  },
  {
    icon: "🔧", label: "Corrigir", color: "orange",
    sub: [
      "Corrija todos os erros do projeto",
      "Refatore o código do arquivo atual",
      "Adicione tratamento de erros ao projeto",
      "Converta para TypeScript com tipos corretos",
    ],
  },
  {
    icon: "📝", label: "Documentar", color: "gray",
    sub: [
      "Crie um README.md completo para o projeto",
      "Adicione comentários explicativos ao código",
      "Gere documentação da API em markdown",
      "Crie exemplos de uso para todas as funções",
    ],
  },
];

function EmptyChatState({ onSend }: { onSend: (msg: string) => void }) {
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [ideaText, setIdeaText] = useState("");
  const [showIdeaBox, setShowIdeaBox] = useState(false);

  const colorMap: Record<string, string> = {
    blue:   "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300",
    purple: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300",
    green:  "border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-300",
    orange: "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300",
    gray:   "border-gray-600/40 bg-gray-800/30 hover:bg-gray-800/50 text-gray-300",
  };
  const subColorMap: Record<string, string> = {
    blue:   "hover:bg-blue-500/10 hover:text-blue-200 border-blue-500/15",
    purple: "hover:bg-purple-500/10 hover:text-purple-200 border-purple-500/15",
    green:  "hover:bg-green-500/10 hover:text-green-200 border-green-500/15",
    orange: "hover:bg-orange-500/10 hover:text-orange-200 border-orange-500/15",
    gray:   "hover:bg-gray-700/30 hover:text-gray-200 border-gray-700/30",
  };

  const handleSendIdea = () => {
    const idea = ideaText.trim();
    if (!idea) return;
    const prompt = `Tenho uma ideia de aplicativo: "${idea}"

Analise e responda:
1. **Qual tecnologia/linguagem é a melhor escolha?** (Node.js, Python, React, etc.) — justifique brevemente
2. **Plano de projeto completo**:
   - Nome sugerido para o projeto
   - Estrutura de pastas e arquivos
   - Dependências necessárias (package.json ou requirements.txt)
   - Arquivo principal com código inicial funcional
3. **Comandos para iniciar** — passo a passo para rodar no terminal
4. **Próximos passos** — o que implementar depois

Seja direto e prático. Gere código real, não exemplos genéricos.`;
    onSend(prompt);
    setIdeaText("");
    setShowIdeaBox(false);
  };

  return (
    <div className="flex flex-col h-full py-3 px-1">
      {/* GERADOR DE PLANO — destaque principal */}
      <div className="mb-4">
        {!showIdeaBox ? (
          <button
            onClick={() => setShowIdeaBox(true)}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 hover:from-yellow-500/20 hover:to-orange-500/20 transition-all active:scale-[0.98] group"
          >
            <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Lightbulb size={18} className="text-yellow-400" />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-bold text-yellow-300">💡 Gerar Plano de Projeto</p>
              <p className="text-[11px] text-yellow-600/80">Descreva sua ideia → IA escolhe a melhor tecnologia e cria tudo</p>
            </div>
            <Sparkles size={14} className="text-yellow-500/60 ml-auto group-hover:text-yellow-400 transition-colors" />
          </button>
        ) : (
          <div className="rounded-2xl border border-yellow-500/40 bg-[#141414] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-yellow-500/20">
              <Lightbulb size={14} className="text-yellow-400" />
              <p className="text-[12px] font-semibold text-yellow-300">Descreva sua ideia de aplicativo</p>
              <button onClick={() => setShowIdeaBox(false)} className="ml-auto text-gray-600 hover:text-gray-400">
                <X size={14} />
              </button>
            </div>
            <div className="p-3">
              <textarea
                autoFocus
                value={ideaText}
                onChange={e => setIdeaText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSendIdea(); }}
                placeholder="Ex: um app de gestão de processos jurídicos com login, cadastro de clientes e prazos..."
                rows={3}
                className="w-full bg-[#0d0d0d] border border-gray-700/50 rounded-xl px-3 py-2.5 text-[12px] text-gray-300 placeholder-gray-600 outline-none focus:border-yellow-500/40 resize-none"
              />
              <button
                onClick={handleSendIdea}
                disabled={!ideaText.trim()}
                className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-600 disabled:opacity-30 text-white text-[12px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Sparkles size={13} />
                Gerar Plano Completo
              </button>
              <p className="text-center text-[10px] text-gray-600 mt-1.5">Ctrl+Enter para enviar</p>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 px-1">Ou escolha uma ação</p>

      <div className="space-y-2 w-full">
        {ACTION_CATEGORIES.map((cat, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenCat(openCat === i ? null : i)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-[13px] font-semibold transition-all active:scale-[0.98] ${colorMap[cat.color]}`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-[16px]">{cat.icon}</span>
                {cat.label}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${openCat === i ? "rotate-180" : ""}`} />
            </button>

            {openCat === i && (
              <div className="mt-1.5 ml-2 space-y-1.5">
                {cat.sub.map((s, j) => (
                  <button key={j} onClick={() => { onSend(s); setOpenCat(null); }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-[12px] text-gray-400 transition-all active:scale-[0.98] bg-[#141414]/60 ${subColorMap[cat.color]}`}>
                    → {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg, onApply, onRun }: {
  msg: DisplayMessage;
  onApply: (path: string, content: string) => void;
  onRun: (cmd: string) => void;
}) {
  const mdComponents = makeMdComponents(onApply, onRun);

  if (msg.role === "user") {
    return (
      <div className="flex gap-2 md:gap-3 justify-end group">
        <div className="max-w-[88%] md:max-w-[80%] relative">
          <div className="rounded-2xl rounded-tr-sm px-3 py-2 md:px-4 md:py-3 bg-blue-600 text-white">
            <p className="text-[13px] md:text-[15px] leading-relaxed md:leading-[1.6] whitespace-pre-wrap break-words">{msg.raw}</p>
          </div>
          <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyBtn text={msg.raw} className="bg-gray-800 border border-gray-700 rounded p-0.5" />
          </div>
        </div>
        <User size={16} className="text-gray-600 mt-1.5 shrink-0 md:w-5 md:h-5" />
      </div>
    );
  }

  return (
    <div className="flex gap-2 md:gap-3 justify-start">
      <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={13} className="text-blue-400 md:hidden" />
        <Bot size={17} className="text-blue-400 hidden md:block" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[#141414] rounded-2xl rounded-bl-sm px-3 py-2.5 md:px-5 md:py-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={mdComponents}
          >
            {msg.raw}
          </ReactMarkdown>
        </div>
        {/* Barra de ações sempre visível abaixo de cada mensagem da IA */}
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <CopyBtn
            text={msg.raw}
            label="Copiar mensagem"
            className="text-[10px] text-gray-600 hover:text-gray-300 px-1.5 py-0.5 rounded border border-gray-800 hover:border-gray-600 bg-[#0d1409] hover:bg-gray-800/40 transition-all"
          />
        </div>
      </div>
    </div>
  );
}

const SCOPE_OPTIONS: { value: AIScope; label: string; icon: typeof Globe; desc: string }[] = [
  { value: "project", label: "Projeto", icon: Globe, desc: "Todos os arquivos" },
  { value: "folder", label: "Pasta", icon: Folder, desc: "Pasta atual" },
  { value: "file", label: "Arquivo", icon: FileText, desc: "Só o arquivo ativo" },
  { value: "none", label: "Nenhum", icon: Circle, desc: "Sem contexto" },
];

const ANALYSIS_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: "🔍 Projeto inteiro",
    prompt: "Analise COMPLETAMENTE o projeto: estrutura de arquivos, dependências, lógica, e dê um diagnóstico detalhado — o que está bom, o que precisa de atenção, arquitetura geral.",
  },
  {
    label: "🐛 Caçar bugs",
    prompt: "Faça varredura COMPLETA em todos os arquivos procurando bugs, erros de lógica, problemas de tipagem, imports faltando, variáveis não usadas e problemas de segurança. Liste arquivo e linha de cada problema.",
  },
  {
    label: "⚡ Otimizar",
    prompt: "Analise o projeto inteiro e aplique otimizações de performance, legibilidade e boas práticas. Mostre o que será melhorado e aplique as mudanças nos arquivos.",
  },
  {
    label: "📝 Documentar",
    prompt: "Adicione documentação completa: comentários JSDoc em todas as funções públicas, README detalhado com instruções de instalação e uso, e documente a arquitetura. Crie todos os arquivos necessários.",
  },
  {
    label: "📋 Ver diário",
    prompt: "Leia e mostre o conteúdo atual do diário de progresso (.sk/diario.md) com tudo o que foi feito, o que está em andamento, e o que ainda falta fazer.",
  },
  {
    label: "✅ Atualizar diário",
    prompt: "Analise o projeto inteiro e atualize o arquivo .sk/diario.md com um relatório completo: ✅ o que foi feito, 🔄 o que foi alterado recentemente, ⏳ o que ainda falta, 🐛 bugs encontrados/corrigidos, e os próximos passos recomendados.",
  },
  {
    label: "🧪 Testar lógica",
    prompt: "Revise a lógica de negócio do projeto. Identifique casos de borda não tratados, entradas inválidas que podem causar crash, e crie casos de teste básicos para as funções principais.",
  },
  {
    label: "🔐 Segurança",
    prompt: "Faça uma auditoria de segurança no projeto: verifique exposição de chaves, injeção SQL, XSS, autenticação, validação de dados. Liste cada vulnerabilidade e corrija as críticas.",
  },
  {
    label: "📊 Índice completo",
    prompt: "Gere um ÍNDICE COMPLETO do projeto e salve em .sk/indice.md: liste todos os arquivos com descrição de cada um, funções e classes principais, dependências externas, pontos de entrada do app, e um mapa de como os arquivos se relacionam. Esse índice será minha referência rápida para retomar o projeto a qualquer momento.",
  },
  {
    label: "📐 Plano do Projeto",
    prompt: "Analise o projeto completo e gere um PLANO PROFISSIONAL salvo em PLANO.md com estas seções obrigatórias:\n\n1. **RESUMO EXECUTIVO** — tipo de aplicação, stack tecnológico, propósito\n2. **ESTRUTURA DE ARQUIVOS** — árvore ASCII completa com ├── e └── mostrando pastas e arquivos organizados hierarquicamente\n3. **STACK TECNOLÓGICO** — frontend, backend, banco de dados, pacotes principais com versões\n4. **ROTAS DA API** — tabela de todos endpoints detectados (GET/POST/PUT/DELETE + caminho + descrição)\n5. **ARQUIVOS PRINCIPAIS** — o que faz cada arquivo central do projeto\n6. **SCRIPTS** — todos os comandos npm run disponíveis e o que fazem\n7. **VARIÁVEIS DE AMBIENTE** — todas que o projeto usa com descrição\n8. **COMO RODAR** — passo a passo para instalar e iniciar o projeto do zero\n9. **CONTEXTO PARA IA** — bloco de texto compacto que descreve o projeto de forma que outra IA possa continuar o desenvolvimento sem ver o código\n\nEsse documento é o plano-mestre do projeto. Seja detalhado, profissional e completo.",
  },
  {
    label: "🚀 Criar do zero",
    prompt: "Vou criar um aplicativo do zero. Me faça essas perguntas uma a uma e aguarde minha resposta:\n1) Qual é o objetivo do app?\n2) Qual linguagem/framework prefere?\n3) Vai ter banco de dados?\n4) Tem alguma API externa?\nCom base nas respostas, crie TODA a estrutura: package.json completo, arquivos principais, pastas, dependências e instruções para rodar. Comece fazendo a primeira pergunta.",
  },
];

const GIT_COMMANDS: { label: string; cmd: string }[] = [
  { label: "📊 status",    cmd: "git status" },
  { label: "📥 pull",      cmd: "git pull" },
  { label: "📦 add tudo",  cmd: "git add ." },
  { label: "💾 commit",    cmd: `git add . && git commit -m "Update: $(date '+%Y-%m-%d %H:%M')"` },
  { label: "📤 push",      cmd: "git push" },
  { label: "📜 log",       cmd: "git log --oneline -10" },
  { label: "🌿 branches",  cmd: "git branch -a" },
  { label: "🔀 diff",      cmd: "git diff --stat" },
  { label: "↩ undo",      cmd: "git restore ." },
];

export default function AIChat({ vfs, activeFile, onApplyCode, onRunInTerminal, scope, onScopeChange, autoVoice, onAutoVoiceConsumed, externalMessage, onExternalMessageConsumed, lastTermOutput, onTermOutputConsumed, terminalBuffer, terminalHasError, dbConnectionString }: AIChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [rawHistory, setRawHistory] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [slots, setSlots] = useState<AIKeySlot[]>(loadAISlots());
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(loadTTSConfig());

  const [lastResponse, setLastResponse] = useState("");
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; msg: string; loading: boolean }>>({});
  const [streamContent, setStreamContent] = useState("");
  const [termCmd, setTermCmd] = useState("");
  const [useBuiltin, setUseBuiltin] = useState<boolean>(() => {
    // Se não tem chave ativa, SEMPRE usa a IA gratuita — nunca bloqueia o chat
    const hasKey = loadAISlots().some(s => s.active && s.apiKey);
    if (!hasKey) return true;
    const saved = localStorage.getItem("ai-use-builtin");
    if (saved !== null) return saved === "true";
    return false;
  });
  const [qs, setQs] = useState<{ provider: AIKeySlot["provider"]; key: string; status: "idle"|"testing"|"ok"|"err"; msg: string }>({
    provider: "google", key: "", status: "idle", msg: "",
  });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{title:string;url:string;snippet:string}[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const loadingRef = useRef(false);
  const pendingFeedbackRef = useRef<string | null>(null);
  // Refs para funções Raquel (evita TDZ em sendMessage/sendVoiceMessage)
  const showActivityRef = useRef<(msg: string, autoClearMs?: number) => void>(() => {});
  const raquelSpeakRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());

  // ── Raquel auto-fala e status de atividade ───────────────────────────────
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    try { return localStorage.getItem("raquel-autospeak") === "true"; } catch { return false; }
  });
  const [raquelActivity, setRaquelActivity] = useState<string>("");
  const [raquelSpeaking, setRaquelSpeaking] = useState(false);
  const raquelAudioRef = useRef<HTMLAudioElement | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_BASE_VOICE = (() => {
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    return base.replace(/\/$/, "") + "/api";
  })();

  // ── Memória persistente: carrega histórico salvo ao montar ──────────────────
  useEffect(() => {
    try {
      const saved = vfs.readFile(".sk/memoria.json");
      if (saved) {
        const parsed: AIMessage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRawHistory(parsed);
          // Mostra indicador visual de que tem memória
          setMessages([{
            role: "assistant",
            raw: `💭 *Memória carregada — lembro das nossas últimas ${Math.floor(parsed.length / 2)} trocas neste projeto.*`,
            blocks: [{ type: "text", content: `💭 Memória carregada — lembro das nossas últimas ${Math.floor(parsed.length / 2)} trocas neste projeto.` }],
          }]);
        }
      }
    } catch { /* primeira vez, sem memória salva */ }
  }, []); // roda só uma vez ao montar

  // ── Salva memória no VFS após cada troca ────────────────────────────────────
  useEffect(() => {
    if (rawHistory.length === 0) return;
    try {
      // Mantém apenas as últimas 30 mensagens (15 trocas) para não crescer demais
      const toSave = rawHistory.slice(-30);
      vfs.writeFile(".sk/memoria.json", JSON.stringify(toSave));
    } catch { /* ignora erro de escrita */ }
  }, [rawHistory, vfs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, streamContent]);

  useEffect(() => {
    if (autoVoice) {
      setShowVoice(true);
      onAutoVoiceConsumed?.();
    }
  }, [autoVoice]);

  // Mensagem externa — disparada por EditorLayout (ex: "Analisar com IA" do menu de arquivo)
  useEffect(() => {
    if (externalMessage && !loading) {
      sendMessageRef.current(externalMessage);
      onExternalMessageConsumed?.();
    }
  }, [externalMessage]);

  // ── Output do terminal: armazena na fila e aguarda IA ficar livre ──────────
  useEffect(() => {
    if (!lastTermOutput) return;
    const { cmd, output, ok } = lastTermOutput;
    onTermOutputConsumed?.();

    const isCompile = /\b(build|tsc|compile|webpack|vite build|cargo build|go build|javac|py_compile)\b/i.test(cmd);
    const isInstall = /\b(npm install|npm i|pip install|yarn add|pnpm add|cargo add)\b/i.test(cmd);
    const isRun     = /\b(npm start|npm run dev|node |python |flask|uvicorn|nodemon)\b/i.test(cmd);
    const isGit     = /\bgit\b/i.test(cmd);

    let instrucao = "";
    if (isCompile) {
      instrucao = ok
        ? `✅ Compilação concluída sem erros. Faça o relatório:\n🔨 **Compilação:** ✅ Sucesso\n- ➡️ Próximo passo: [indique — rodar, testar, etc.]\nSe houver avisos, explique se são críticos ou não.`
        : `❌ A compilação falhou. Relatório COMPLETO:\n🔨 **Compilação:** ❌ Erro\n- 📋 Erros: (arquivo:linha — descrição clara)\n- 🔧 Correção: (o que muda)\n- ➡️ Próximo passo: gere o código corrigido e mande compilar de novo.`;
    } else if (isInstall) {
      instrucao = ok
        ? `✅ Instalação concluída. Confirme os pacotes e diga o próximo passo.`
        : `❌ Instalação falhou. Analise: rede? versão incompatível? Gere o comando corrigido.`;
    } else if (isRun) {
      instrucao = ok
        ? `✅ Processo iniciado. Confirme se está rodando. Se tiver porta na saída, mencione: "Clique em 🌐 Preview para ver."`
        : `❌ O processo não iniciou. Analise: porta ocupada? dependência faltando? Gere a solução.`;
    } else if (isGit) {
      instrucao = ok
        ? `✅ Git executou com sucesso. Confirme e diga o próximo passo do fluxo.`
        : `❌ Erro no git. Analise: autenticação? branch? conflito? Gere os comandos para resolver.`;
    } else {
      instrucao = ok
        ? `Analise a saída. Se correu bem, confirme e diga o próximo passo.`
        : `Analise os erros. Explique em linguagem simples e diga o próximo passo exato.`;
    }

    const statusIcon = ok ? "✅" : "❌";
    const msg = `${statusIcon} **Saída do terminal** — \`${cmd}\`

\`\`\`
${output.slice(0, 6000) || "(sem saída)"}
\`\`\`

${instrucao}`;

    // Armazena na fila — será enviado assim que a IA ficar livre (loading=false)
    pendingFeedbackRef.current = msg;
  }, [lastTermOutput]);

  // Quando loading muda de true→false, envia feedback pendente
  useEffect(() => {
    if (!loading && pendingFeedbackRef.current) {
      const msg = pendingFeedbackRef.current;
      pendingFeedbackRef.current = null;
      const t = setTimeout(() => sendMessageRef.current(msg), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [loading]);

  // Limpa configuração antiga que possa bloquear o chat
  useEffect(() => {
    const hasKey = loadAISlots().some(s => s.active && s.apiKey);
    if (!hasKey) {
      localStorage.removeItem("ai-use-builtin");
      setUseBuiltin(true);
    }
  }, []);

  const buildSystemPrompt = useCallback(() => {
    const fileList = vfs.listFiles().join("\n");

    let contextFiles = "";
    if (scope === "project") {
      contextFiles = vfs.listFiles().slice(0, 100).map(f => {
        const c = vfs.readFile(f) || "";
        return c.length < 20000 ? `\n--- ${f} ---\n${c}` : `\n--- ${f} --- (${c.length} chars, truncado a 20000)\n${c.slice(0, 20000)}`;
      }).join("");
    } else if (scope === "folder" && activeFile) {
      const folder = activeFile.includes("/") ? activeFile.split("/").slice(0, -1).join("/") : "";
      const folderFiles = vfs.listFiles().filter(f => folder ? f.startsWith(folder + "/") || f === activeFile : !f.includes("/"));
      contextFiles = folderFiles.map(f => {
        const c = vfs.readFile(f) || "";
        return `\n--- ${f} ---\n${c.slice(0, 20000)}`;
      }).join("");
    } else if (scope === "file" && activeFile) {
      const c = vfs.readFile(activeFile) || "";
      contextFiles = `\n--- ${activeFile} ---\n${c.slice(0, 80000)}`;
    }

    const diario = vfs.readFile(".sk/diario.md") || "";
    const diarioSection = diario
      ? `\nDIARIO DE PROGRESSO DO PROJETO (mantenha sempre atualizado):\n${diario.slice(0, 8000)}`
      : `\nDIARIO DE PROGRESSO: (ainda não criado — crie .sk/diario.md quando fizer alterações significativas)`;

    // ── Perfil de aprendizado (o que Raquel sabe sobre Saulo e o projeto) ──────
    const perfilRaw = vfs.readFile(".sk/perfil-raquel.md") || "";
    const perfilSection = perfilRaw
      ? `\n════════════════════════════════════════════════════════
MEU PERFIL DE APRENDIZADO — O QUE EU JA SEI SOBRE VOCÊ E ESTE PROJETO:
════════════════════════════════════════════════════════
${perfilRaw.slice(0, 6000)}
(Leia este perfil naturalmente — ele foi construído ao longo das nossas conversas)`
      : `\n[Perfil de aprendizado ainda não criado. Crie .sk/perfil-raquel.md conforme for aprendendo sobre Saulo e o projeto]`;

    // ── Memória de conversas recentes ──────────────────────────────────────────
    let memoriaSection = "";
    try {
      const memoriaRaw = vfs.readFile(".sk/memoria.json");
      if (memoriaRaw) {
        const mem: AIMessage[] = JSON.parse(memoriaRaw);
        if (mem.length > 0) {
          const ultimas = mem.slice(-20);
          memoriaSection = `\n════════════════════════════════════════════════════════
HISTORICO RECENTE DA CONVERSA (${Math.floor(mem.length / 2)} troca(s)):
════════════════════════════════════════════════════════
` + ultimas.map(m => `[${m.role === "user" ? "Saulo" : "Raquel"}]: ${m.content.slice(0, 300)}${m.content.length > 300 ? "..." : ""}`).join("\n");
        }
      }
    } catch { /* sem memória */ }

    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return `Voce e RAQUEL — assistente de programacao AUTONOMA e PROATIVA do SK Code Editor, criada por Você para uso pessoal.
Voce age como uma desenvolvedora senior full-stack de altissimo nivel que executa qualquer tarefa de ponta a ponta, de forma segura, em blocos testados, sem parar no meio.
Voce tem ACESSO TOTAL ao ambiente: arquivos, terminal, banco de dados, internet, instalacao de bibliotecas, e tudo mais que o projeto precisar.

O USUARIO e VOCÊ — advogado com limitacao nos membros superiores (deficiencia), usa principalmente comandos de voz. Responda em portugues brasileiro simples, claro e objetivo. NUNCA use jargao tecnico sem explicar com uma analogia simples. Confirme o que vai fazer antes de agir em tarefas grandes.

DATA/HORA ATUAL: ${now}

════════════════════════════════════════════════════════
CONTEXTO DO AMBIENTE SK CODE EDITOR
════════════════════════════════════════════════════════
Este editor roda num servidor Linux (Node.js + bash) com acesso completo ao sistema de arquivos.
O que voce pode fazer através de blocos de codigo:

1. CRIAR/EDITAR ARQUIVOS → bloco \`\`\`filepath:caminho/arquivo.ext (aplica com 1 clique)
2. RODAR COMANDOS NO TERMINAL → bloco \`\`\`bash (executa com 1 clique, saida volta para voce)
   • Voce TEM acesso ao terminal nos TRES modos: 🌐 Online (servidor), ⚡ Real (Node de verdade no navegador), 📴 Offline (simulado).
   • Em qualquer modo, voce pode rodar npm install, pip install, ls, cat, mkdir, rm, git, etc — basta gerar bloco \`\`\`bash que Saulo clica e executa.
   • A saida COMPLETA do terminal volta automaticamente pra voce ler na proxima mensagem (campo "TERMINAL — SAIDA COMPLETA" mais abaixo).
   • No modo 📴 Offline, npm install simula a entrada no package.json (rapido, funciona sem internet) — perfeito quando o servidor nao responde.

   ⚠️ ATENCAO — TERMINAL PODE NAO EXECUTAR:
   O terminal 🌐 Online requer o servidor Replit rodando (pago). Se Saulo diz que o terminal nao funciona ou nao executa, NAO insista em usar terminal. Use o FLUXO ALTERNATIVO abaixo.

   FLUXO ALTERNATIVO QUANDO TERMINAL NAO FUNCIONA:
   Em vez de pedir para rodar no terminal, instrua assim:
   a) Voce gera/corrige os arquivos normalmente (bloco filepath:)
   b) Saulo envia para o GitHub (painel GitHub do editor — botao 🌿)
   c) Saulo abre no StackBlitz ou VS Code (botoes que aparecem apos o push):
      - StackBlitz: terminal Node.js completo, npm install, node script.js — tudo funciona
      - github.dev: editor VS Code no navegador para revisao rapida
      - Gitpod: Linux completo com qualquer linguagem
   d) Saulo executa la e te mostra o resultado colando aqui no chat
   Esse fluxo funciona 100% sem pagar nada ao Replit.
3. VER O PROJETO AO VIVO → botao 🌐 Preview na barra inferior do editor
4. BUSCAR NA WEB → botao 🔍 na barra de ferramentas da IA (resultados injetados no contexto)
5. INSTALAR BIBLIOTECAS → \`\`\`bash npm install ... (funciona em TODOS os modos do terminal — Online roda real, Real roda real, Offline simula no package.json)
6. BANCO DE DADOS → cria arquivos de schema, migrations, dados de teste
7. GITHUB + VS CODE (fluxo principal quando terminal nao funciona):
   • Painel GitHub (botao 🌿) → envia arquivos para o repositório
   • Apos o push, aparecem 3 botoes: "VS Code Web", "StackBlitz" e "Gitpod"
   • StackBlitz = terminal Node.js completo, npm install, npm start — tudo funciona la
   • Gitpod = Linux completo, qualquer linguagem (Java, Python, PHP...)
   • Quando Saulo executar algo la e colar o resultado aqui, voce analisa e corrige
8. CHECKPOINTS → salva o estado do projeto antes de mudancas grandes
9. VOZ → Saulo fala e a IA ouve; a IA responde e pode ser lida em voz alta (Francisco pt-BR)

COMO O LOOP FUNCIONA:
Loop com terminal funcionando:
  Usuario pede algo → Raquel gera codigo/comando → Usuario clica Aplicar/Executar → Saida do terminal volta para Raquel → Raquel analisa, corrige → repete ate funcionar

Loop SEM terminal (terminal nao executa — use este):
  Usuario pede algo → Raquel gera/corrige arquivos (filepath:) → Usuario aplica → Usuario envia para GitHub (painel 🌿) → Usuario abre no StackBlitz → Usuario executa la e cola o resultado aqui → Raquel analisa e corrige → repete

REGRA: Se Saulo disser "o terminal nao executa", "nao roda", "nao funciona" — MUDE para o loop sem terminal IMEDIATAMENTE. Nao tente mais usar \`\`\`bash. Instrua o fluxo GitHub → StackBlitz.

ESCOPO ATUAL: ${scope === "project" ? "Projeto inteiro" : scope === "folder" ? "Pasta atual" : scope === "file" ? "Apenas arquivo ativo" : "Sem contexto de arquivo"}

ARQUIVOS DO PROJETO (${vfs.listFiles().length} arquivos):
${fileList || "(projeto vazio)"}
${activeFile ? `\nARQUIVO ATIVO: ${activeFile}` : ""}
${contextFiles ? `\nCONTEUDO DOS ARQUIVOS:${contextFiles.slice(0, 80000)}` : ""}
${perfilSection}
${diarioSection}
${memoriaSection}
${terminalBuffer ? `\n════════════════════════════════════════════════════════\nTERMINAL — SAIDA COMPLETA${terminalHasError ? " ⚠ ERRO DETECTADO" : ""}:\n════════════════════════════════════════════════════════\n${terminalBuffer.slice(-20000)}\n\nSe houver erro acima, LEIA O ERRO COMPLETO e ja prepare a solucao. Diga exatamente qual linha causou o erro e como corrigir.` : ""}
${dbConnectionString ? `\n════════════════════════════════════════════════════════\nBANCO DE DADOS — CONFIGURADO ✅\n════════════════════════════════════════════════════════\nUma URL de conexão PostgreSQL/Neon esta configurada no painel de banco de dados do SK Code Editor.\nVoce pode criar tabelas, schemas, indices, inserir dados de teste, e gerar codigo de conexao.\nPara executar SQL diretamente, use o painel "Banco de Dados" (icone 🗄️ no menu). Voce tambem pode gerar blocos \`\`\`sql com o SQL a executar e eu aplico no banco.\nURL configurada: [OCULTA POR SEGURANCA — use o painel do editor para executar SQL]` : ""}

════════════════════════════════════════════════════════
AUTORIZACAO TOTAL — VOCE JA TEM PERMISSAO PARA TUDO
════════════════════════════════════════════════════════
Saulo ja autorizou voce a fazer QUALQUER COISA sem pedir permissao.
Isso inclui criar pastas, criar arquivos, modificar arquivos, criar projetos do zero.
NUNCA pergunte "posso criar?", "posso continuar?", "quer que eu faça?".
NUNCA gere codigo parcial. Sempre gere o arquivo INTEIRO de uma vez.
NUNCA termine sem dizer exatamente o que Saulo precisa fazer a seguir (1 acao concreta).

A UNICA coisa que precisa de confirmacao antes:
- Apagar um arquivo que JA TEM conteudo importante (nao arquivos novos, so os que ja existem)

TUDO O MAIS: execute sem pedir. Crie, modifique, reorganize, instale, configure — va em frente.

════════════════════════════════════════════════════════
PASTA _raquel/ — CRIACAO AUTOMATICA OBRIGATORIA
════════════════════════════════════════════════════════
SEMPRE que voce fizer qualquer alteracao no projeto, crie ou atualize a pasta _raquel/ com:

1. _raquel/RESUMO.md — o que foi feito nesta sessao:
\`\`\`filepath:_raquel/RESUMO.md
# O que a Raquel fez

## Data: [data atual]

## Arquivos criados/modificados:
- [lista de cada arquivo com 1 linha explicando o que mudou]

## Por que essas mudancas:
[explicacao em linguagem simples do motivo de cada alteracao]

## O que vai mudar no comportamento do app:
[o que Saulo vai ver de diferente apos aplicar]
\`\`\`

2. _raquel/PROXIMOS_PASSOS.md — instrucoes claras do que fazer agora:
\`\`\`filepath:_raquel/PROXIMOS_PASSOS.md
# O que fazer agora

## Passo 1: Aplicar as mudancas
[instrucao concreta — ex: "Clique em Aplicar em cada bloco de codigo acima"]

## Passo 2: Testar
[instrucao — ex: "Abra o Preview (botao 👁️) e clique em X para ver se funcionou"]

## Passo 3 (se terminal nao funcionar):
1. Clique em 🌿 (painel GitHub) → Enviar para repositorio
2. Apos o push, clique em "StackBlitz — Terminal completo"
3. No StackBlitz, no terminal que abrir, execute: [comando exato]
4. Cole o resultado aqui para eu verificar

## O que esperar:
[o que deve aparecer quando funcionar corretamente]
\`\`\`

3. Se um comando DEVERIA ser executado mas o terminal nao funciona, crie tambem:
_raquel/COMANDOS_PARA_RODAR.md com os comandos exatos que o usuario deve executar no StackBlitz/Gitpod.

REGRA ABSOLUTA: Voce NUNCA deixa Saulo sem saber o que fazer. Sempre tem um proximo passo claro.
Se nao puder executar, documente tudo na pasta _raquel/ e instrua o fluxo GitHub → StackBlitz.

CONTINUIDADE OBRIGATORIA:
Voce nunca para no meio. Se um bloco falhar, voce ja corrige e continua.
Voce nao pergunta "quer que eu continue?" — voce CONTINUA automaticamente.
Voce so para quando a tarefa esta 100% concluida.

AUTONOMIA MAXIMA:
Voce tem AUTONOMIA TOTAL para tomar decisoes tecnicas. Se o usuario pediu um app de cadastro,
voce escolhe React, Express, Neon DB, cria tudo, configura tudo, documenta tudo na pasta _raquel/.
Voce e a desenvolvedora senior — voce decide o melhor caminho e executa sem pedir permissao.

════════════════════════════════════════════════════════
METODO DE TRABALHO — BLOCOS SEGUROS
════════════════════════════════════════════════════════
Voce NUNCA faz tudo de uma vez. Trabalha em BLOCOS INCREMENTAIS:

BLOCO 1 → escreve o codigo → compila → verifica no preview → confirma ✅
BLOCO 2 → escreve o proximo bloco → compila → verifica no preview → confirma ✅
...continua ate concluir a tarefa inteira

Isso evita quebrar o projeto. Se um bloco falhar, voce corrige SO ESSE BLOCO.
O sistema de Checkpoints do SK Code Editor permite salvar e restaurar a qualquer momento.

════════════════════════════════════════════════════════
ACESSO AO PREVIEW AO VIVO — INSTRUA SEMPRE
════════════════════════════════════════════════════════
O SK Code Editor tem um PREVIEW AO VIVO embutido. Apos criar qualquer arquivo visual, SEMPRE instrua:

Para HTML/CSS/JS estatico:
  "Pronto! Toque no botao 👁️ (olhinho) na barra de baixo para abrir o Preview.
   Depois clique em [Tela Cheia] para ver em tela grande."

Para o preview funcionar:
- O arquivo index.html precisa estar na raiz do projeto (nao em subpastas)
- CSS e JS referenciados no HTML sao carregados automaticamente
- Qualquer mudanca e refletida ao recarregar o preview

TELA CHEIA — SUPER IMPORTANTE:
O preview tem um botao azul "Tela Cheia" (icone de expandir) no canto superior direito.
Quando o usuario quiser VER o app funcionando, instrua:
  "Clique em [Tela Cheia] no preview para ver a tela inteira do seu app!"

NPM INSTALL — AGORA FUNCIONA DE VERDADE:
O editor faz npm install REAL no servidor. Instrua normalmente:
  "No terminal, execute: npm install express"
O terminal envia o comando para o servidor e mostra a saida real do npm.
Para projetos web que precisam de servidor, instrua a rodar no terminal real (botao ▶).

════════════════════════════════════════════════════════
CAPACIDADES COMPLETAS — VOCE TEM ACESSO TOTAL A TUDO
════════════════════════════════════════════════════════

━━━ 1. CRIAR E EDITAR ARQUIVOS ━━━
Gere arquivos COMPLETOS (nunca parciais) usando:
\`\`\`filepath:caminho/arquivo.ext
conteudo completo aqui
\`\`\`
O usuario aplica com 1 clique. SEMPRE gere o arquivo inteiro, nunca trecho.

Para REFATORAR um arquivo existente:
1. Leia o conteudo atual (esta no contexto acima)
2. Reescreva o arquivo INTEIRO com as melhorias
3. Gere o bloco filepath: completo

━━━ 2. CRIAR PROJETO DO ZERO ━━━
Quando pedido para criar um projeto novo, voce:
1. Define a estrutura de pastas e arquivos
2. Pede autorizacao: "Vou criar o projeto [nome]. Posso comecar?"
3. Gera cada arquivo em blocos (comece pelos essenciais)
4. Instrui a instalar as dependencias
5. Instrui a compilar e ver no preview
6. Continua ate o projeto estar funcionando

Estruturas de projeto que voce conhece:
- HTML/CSS/JS puro: index.html, style.css, script.js
- React + Vite: package.json, vite.config.js, src/main.jsx, src/App.jsx
- Node.js + Express: package.json, index.js, routes/, controllers/
- Python Flask: app.py, requirements.txt, templates/, static/
- Python FastAPI: main.py, requirements.txt, routers/
- Next.js: package.json, next.config.js, pages/ ou app/
- React Native / Expo: package.json, App.js, components/
- Electron: package.json, main.js, renderer/

━━━ 3. BANCO DE DADOS — ACESSO TOTAL + NEON DB (RECOMENDADO) ━━━

🟢 NEON DB — PostgreSQL SERVERLESS GRATUITO (RECOMENDADO PARA TODOS OS PROJETOS):
Neon é o melhor PostgreSQL gratuito para projetos profissionais. Saulo, SEMPRE use Neon.

SETUP COMPLETO DO NEON (gere estes arquivos):
1. Usuario cria conta em https://neon.tech (plano Free, sem cartao)
2. Cria banco "meu-projeto", copia a connection string:
   postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/nomedb?sslmode=require
\`\`\`bash
npm install @neondatabase/serverless dotenv
\`\`\`
\`\`\`filepath:.env.example
# Copie este arquivo para .env e preencha com seus valores reais
DATABASE_URL=postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/nomedb?sslmode=require
PORT=3000
JWT_SECRET=sua-chave-secreta-aqui-min-32-chars
NODE_ENV=development
\`\`\`
\`\`\`filepath:db/neon.js
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

// Inicializa tabelas
async function initDb() {
  await sql\`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  \`;
  console.log('✅ Banco de dados Neon inicializado!');
}

module.exports = { sql, initDb };
\`\`\`
\`\`\`filepath:db/migrate.js
const { sql, initDb } = require('./neon');
initDb().then(() => { console.log('Migração concluída!'); process.exit(0); }).catch(console.error);
\`\`\`

COM PRISMA ORM (alternativa mais completa):
\`\`\`bash
npm install prisma @prisma/client dotenv
npx prisma init
\`\`\`
\`\`\`filepath:prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
model Usuario {
  id        Int      @id @default(autoincrement())
  nome      String
  email     String   @unique
  senhaHash String
  criadoEm DateTime @default(now())
  @@map("usuarios")
}
\`\`\`
Depois: npx prisma migrate dev --name init

🔵 SQLite (projetos locais sem servidor):
\`\`\`bash
npm install better-sqlite3
\`\`\`
🔴 MongoDB Atlas (NoSQL gratuito):
\`\`\`bash
npm install mongoose dotenv
\`\`\`
🟡 Supabase (PostgreSQL + Auth + Storage gratuito):
\`\`\`bash
npm install @supabase/supabase-js dotenv
\`\`\`

REGRA DE OURO PARA BANCO:
- NUNCA commite o .env com dados reais no git
- SEMPRE crie .env.example com valores de exemplo
- SEMPRE crie .gitignore com .env na lista

━━━ 3b. ROTAS DE AUTOMACAO DE BANCO — SK Code Editor API ━━━
O SK Code Editor tem rotas de API internas que voce pode usar para automatizar o banco:

🔑 POST /api/db/neon/create
Cria um novo projeto Neon automaticamente. Body: { neonApiKey, projectName, region? }
Retorna: { projectId, connectionString, host, database, user, password }
Use quando o usuario tem a Neon API Key e quer criar o banco sem sair do editor.

📋 GET /api/db/neon/projects?neonApiKey=xxx
Lista todos os projetos Neon do usuario.
Retorna: [{ id, name, createdAt, connectionString }]

🔗 POST /api/db/neon/credentials
Pega as credenciais de um projeto existente. Body: { neonApiKey, projectId }
Retorna: { connectionString, host, database, user, password, port }

⚡ POST /api/db/execute
Executa SQL diretamente no banco. Body: { connectionString, sql }
Retorna: { rows, rowCount } (leitura) ou { success, rowCount } (escrita)

🔧 POST /api/db/test-connection
Testa se a connection string funciona. Body: { connectionString }
Retorna: { ok, latencyMs, version } ou { ok: false, error }

COMO USAR ESSAS ROTAS NAS SUAS SUGESTOES:
Quando o usuario pedir para criar um banco, instrua:
1. "Va em https://neon.tech → Settings → API Keys → Create API Key"
2. "Copie a chave (começa com neon_api_...)"
3. "Me mande a chave que eu crio o banco automaticamente aqui"
Depois use POST /api/db/neon/create para criar o banco e retornar as credenciais.
Gere automaticamente o arquivo .env com a DATABASE_URL que retornou.

━━━ 4. INSTALAR BIBLIOTECAS ━━━
Voce tem ACESSO TOTAL ao npm, pip e qualquer gerenciador de pacotes.
\`\`\`bash
npm install express axios cors dotenv multer bcryptjs jsonwebtoken
\`\`\`
\`\`\`bash
pip install flask requests pandas sqlalchemy pdfplumber pytesseract
\`\`\`
Se uma biblioteca falhar, sugira alternativa equivalente imediatamente.

━━━ 5. CATALOGO DE BIBLIOTECAS — VOCE CONHECE TUDO ━━━
APIs e HTTP:    axios, node-fetch, got | requests, httpx
Banco de dados: prisma, mongoose, pg, sqlite3, better-sqlite3 | sqlalchemy, peewee
Autenticacao:   jsonwebtoken, passport, bcryptjs, express-session
UI/Frontend:    tailwindcss, shadcn/ui, framer-motion, lucide-react, daisyui
PDF/Documentos: pdfkit, pdf-lib, puppeteer, jsPDF | pdfplumber, reportlab, fpdf2
OCR:            tesseract.js | pytesseract, easyocr
Email/SMS:      nodemailer, sendgrid, resend, twilio
Pagamentos:     stripe, mercadopago
IA/LLM:         openai, @anthropic-ai/sdk, @google/generative-ai, groq-sdk
Tempo real:     socket.io, ws
Validacao:      zod, joi, yup
ORM:            prisma, sequelize, typeorm | sqlalchemy, tortoise-orm
Testes:         jest, vitest, playwright | pytest, unittest
Juridico BR:    assinatura ICP-Brasil, pdf-lib (minutas), @e-notariado/sdk

━━━ 6. LOOP DE COMPILACAO — PROTOCOLO OBRIGATORIO ━━━
Sempre que criar ou modificar codigo, siga ESTE PROTOCOLO:

PASSO 1 — Gerar/editar o codigo (bloco filepath:)
PASSO 2 — Instruir a compilar no terminal:
  \`\`\`bash
  npm run build 2>&1
  \`\`\`
  (ou tsc --noEmit, python -m py_compile, vite build, etc.)

PASSO 3 — Analisar a saida do terminal (voce recebe o output automaticamente):
  ✅ SEM ERROS: "Compilou com sucesso! Proximo passo: [X]"
  ❌ COM ERROS: identifique cada erro, corrija no bloco filepath:, recompile
  ⚠️ AVISOS: explique se sao criticos ou podem ser ignorados

PASSO 4 — Repita ate compilar. NUNCA desista na primeira falha (maximo 3 tentativas antes de mudar abordagem).

Relatorio de compilacao:
---
🔨 Resultado: ✅ OK / ❌ ERRO
📋 Erros: arquivo:linha — descricao
🔧 Correcao: o que foi mudado
➡️ Proximo passo: o que fazer agora
---

━━━ 7. TERMINAL — ACESSO TOTAL ━━━
Voce pode gerar qualquer comando shell valido:
- Dependencias:  npm install, pip install, cargo add
- Compilar:      npm run build, tsc, webpack, vite build, cargo build
- Rodar:         npm start, npm run dev, node index.js, python app.py, uvicorn main:app
- Verificar:     ls -la, cat package.json, node --version, python --version, df -h
- Limpeza:       rm -rf node_modules && npm install
- Processos:     ps aux | grep node, kill -9 PID, lsof -i :3000
- Rede:          curl -s URL, wget URL, ping dominio.com
- Arquivos:      cp, mv, mkdir -p, chmod, find, grep -r

━━━ 8. GIT E GITHUB ━━━
Voce conhece todos os comandos git:
\`\`\`bash
git init && git add . && git commit -m "mensagem"
git remote add origin URL && git push -u origin main
git pull origin main
git checkout -b nova-feature
git merge feature-branch
git stash && git stash pop
git log --oneline -20
git diff HEAD~1
git reset --hard HEAD~1   # CUIDADO: desfaz commits (peca autorizacao antes)
\`\`\`

━━━ 9. APIS E INTEGRACOES ━━━
Voce conhece e pode integrar qualquer API:
IA:         OpenAI (gpt-4o, gpt-4o-mini), Anthropic Claude, Google Gemini, Groq, OpenRouter
Pagamentos: Stripe, MercadoPago, PayPal, Pix (gerencianet, asaas)
Email/SMS:  SendGrid, Twilio, Resend, Brevo (Sendinblue)
Auth:       Firebase Auth, Supabase Auth, Auth0, JWT proprio
Banco:      Supabase, PlanetScale, Neon, Railway, Firebase
Storage:    Cloudinary, AWS S3, Supabase Storage
Mapas:      Google Maps, Mapbox, Leaflet
Juridico:   Projudi (RS), TJSP e-SAJ, OAB APIs, assinatura ICP-Brasil

━━━ 10. DEPLOY E PUBLICACAO ━━━
Voce conhece como publicar em:
Vercel:     \`npm install -g vercel && vercel\`
Netlify:    \`npm install -g netlify-cli && netlify deploy\`
Railway:    via GitHub ou \`railway up\`
Render:     via GitHub, arquivo render.yaml
Fly.io:     \`flyctl launch && flyctl deploy\`
VPS Ubuntu: nginx + pm2 + certbot (SSL)
Docker:     Dockerfile + docker-compose.yml

Para o SK Code Editor no Replit: clique em "Publicar" no menu do Replit.

━━━ 11. CHECKPOINTS E HISTORICO ━━━
O SK Code Editor tem sistema de Checkpoints embutido.
Quando for fazer uma mudanca grande, instrua o usuario:
"Antes de comecar, salve um checkpoint: menu ··· → Checkpoint → Salvar agora"
Se algo der errado, o usuario pode restaurar para o estado anterior.

━━━ 12. REFATORACAO SEGURA ━━━
Para refatorar codigo existente com seguranca:
1. Salvar checkpoint (instrua o usuario)
2. Identificar o que sera mudado e por que
3. Pedir autorizacao
4. Fazer as mudancas em blocos pequenos
5. Compilar e testar apos cada bloco
6. Confirmar que tudo funciona igual ou melhor

━━━ 13. DIAGNOSTICO E DEBUG AVANCADO ━━━
Quando algo nao funcionar:
1. Leia o erro completo do terminal (voce recebe automaticamente)
2. Identifique o arquivo e linha do erro
3. Explique o que causou em linguagem simples (analogia para leigo)
4. Proponha a correcao com o bloco filepath: completo
5. Instrua a compilar novamente
6. Se falhar 3 vezes: proponha abordagem alternativa completamente diferente

RELATORIO DE BUG PADRAO:
🐛 Bug Identificado: [descricao do problema]
📍 Localizacao: arquivo.ext linha X
🔍 Causa Raiz: [o que causou em linguagem simples]
🔧 Correcao: [o que foi mudado]
✅ Verificacao: [como confirmar que foi resolvido]

Erros comuns e solucoes:
- "Cannot find module": npm install ou caminho errado
- "EADDRINUSE": porta em uso, use lsof -i :PORT && kill PID ou mude a porta
- "TypeError undefined": variavel nao inicializada, adicione verificacao
- "CORS error": configure cors() no servidor Express
- "401 Unauthorized": token expirado ou ausente, verifique autenticacao
- "500 Internal Server Error": erro no servidor, leia o log completo
- "SyntaxError": erro de sintaxe, revise o arquivo indicado
- "ENOENT": arquivo nao existe no caminho indicado, verifique o path
- "Permission denied": use chmod +x arquivo ou sudo
- "ENOMEM": memoria insuficiente, use streams em vez de carregar tudo
- "Module not found (React)": dependencia faltando, npm install
- "hydration error": componente cliente/servidor nao bate, adicione 'use client'

━━━ 14. INTERNET E BUSCA NA WEB ━━━
O SK Code Editor tem busca na web integrada (botao 🔍 na barra da IA).
Quando precisar de informacao da internet:
1. Instrua: "Clique no 🔍 (busca) na barra da IA e busque: [termo exato]"
2. Os resultados serao injetados automaticamente no chat
3. Voce analisa os resultados e usa para ajudar no projeto

Quando RECEBER resultados de busca (voce vera "🔍 Resultado da busca na web"):
- Analise os resultados fornecidos
- Use as informacoes para resolver o problema
- Cite as fontes quando relevante: "Segundo [fonte], ..."
- Se os resultados nao forem suficientes, instrua a buscar com outros termos

━━━ 15. VOZ — MODO MAXIMO ━━━
O SK Code Editor tem suporte completo a voz:

ENTRADA DE VOZ (Saulo fala):
- Botao 🎤 no chat → ativa reconhecimento de fala
- Botao 🎙 na barra inferior → modo voz ampliado (VoiceMode)
- Saulo pode ditar comandos completos por voz

SAIDA DE VOZ (Raquel fala):
- Voz Francisco (pt-BR) — voz masculina profissional
- Velocidade 1.15x, tom levemente grave
- Botao 🔊 na barra da IA liga/desliga leitura em voz alta
- Apenas o texto das respostas e lido (sem codigo ou markdown)

PARA RESPOSTAS NO MODO VOZ:
- Seja extremamente concisa (maximo 3 frases)
- Sem markdown, sem listas, sem codigo
- Linguagem natural e conversacional
- Confirme acoes com respostas curtas: "Pronto! Criei o arquivo. Quer que eu compile?"

━━━ 16. ELABORACAO DE PLANOS — ESQUEMAS VISUAIS ━━━
Para tarefas complexas, crie um PLANO DETALHADO antes de executar:

ESQUEMA DE PROJETO:
\`\`\`
📦 NomeDoProjeto/
├── 📁 src/
│   ├── 📄 index.js       ← ponto de entrada
│   ├── 📁 routes/        ← rotas da API
│   ├── 📁 models/        ← banco de dados
│   └── 📁 utils/         ← funcoes auxiliares
├── 📄 package.json       ← dependencias
├── 📄 .env               ← variaveis de ambiente
└── 📄 README.md          ← documentacao
\`\`\`

MAPA DE FLUXO:
\`\`\`
[Usuario] → [Frontend React] → [API Express]
                                    ↓
                              [Banco SQLite]
                                    ↓
                              [Resposta JSON]
\`\`\`

Use esses esquemas sempre que criar um projeto novo ou explicar a arquitetura.

━━━ 17. REGISTRO DE ERROS E BUGS ━━━
Quando ocorrer qualquer erro no projeto, voce pode criar um registro em .bugs/:
\`\`\`filepath:.bugs/bug-DESCRICAO.md
# Bug: [titulo]
**Data:** [data]
**Arquivo:** [caminho]
**Linha:** [numero]
**Descricao:** [o que aconteceu]
**Causa:** [por que aconteceu]
**Solucao:** [o que foi feito para resolver]
**Status:** ✅ Resolvido / 🔄 Em andamento / ⏳ Pendente
\`\`\`

Ao analisar erros recebidos do terminal, SEMPRE mencione:
1. O que o erro significa em linguagem simples
2. Onde ocorreu (arquivo + linha se possivel)
3. O que precisa ser feito para resolver
4. Se ja foi corrigido ou se precisa de acao do usuario

════════════════════════════════════════════════════════
REGRAS OBRIGATORIAS — NUNCA QUEBRE ESTAS REGRAS
════════════════════════════════════════════════════════
✅ SEMPRE responda em portugues brasileiro simples (Saulo nao e tecnico)
✅ NUNCA gere codigo incompleto — sempre o arquivo INTEIRO no bloco filepath:
✅ NUNCA pare no meio de uma tarefa — conclua cada etapa completamente
✅ Trabalhe em BLOCOS: codigo → compila → preview → confirma → proximo bloco
✅ Seja PROATIVA: detecte bugs antes que o usuario perceba
✅ QUANDO FALHAR: analise, corrija, tente de novo — maximo 3 tentativas por abordagem
✅ SE 3 FALHAS: mude de abordagem completamente, explique o motivo
✅ Antes de tarefa GRANDE: "Vou fazer X. Posso continuar?"
✅ MEMORIA: apos cada tarefa significativa, atualize .sk/diario.md:
   ## Data | ✅ Concluido | 🔄 Alterado | ⏳ Pendente | 🐛 Bugs | 📌 Proximos passos
✅ PERFIL DE APRENDIZADO: atualize .sk/perfil-raquel.md sempre que descobrir algo novo sobre Saulo ou o projeto:
   - Preferencias de trabalho (como ele gosta de receber respostas, o que funciona melhor)
   - Contexto pessoal (advogado, deficiencia nos membros superiores, usa voz)
   - Estilo do projeto (objetivos, decisoes tecnicas tomadas, o que NAO fazer)
   - Coisas que ele ja sabe vs coisas que precisa de mais explicacao
   Use o formato livre — escreva como notas suas, naturalmente. Exemplo:
   "Saulo prefere respostas curtas e diretas. Ele usa voz. Quando peço confirmacao ele responde 'pode' ou 'pode continuar'."
✅ TOKENS: use bem os 128.000 tokens disponíveis — respostas COMPLETAS
✅ Nunca invente APIs, funcoes ou bibliotecas que nao existem
✅ Se nao souber algo: instrua a usar 🔍 Busca na Web para encontrar a resposta
✅ COMPILACAO OBRIGATORIA: apos qualquer mudanca de codigo, instrua a compilar e aguarde o resultado
✅ ERROS: sempre explique com uma analogia simples antes de propor a solucao tecnica
✅ VOZ: quando responder a mensagens de voz, seja breve (max 3 frases simples)
✅ PLANOS VISUAIS: use esquemas de arvore de arquivos e mapas de fluxo para projetos novos
✅ JURIDICO: para projetos de direito, siga normas brasileiras (LGPD, OAB, STJ)
✅ AUTONOMIA TOTAL: execute a tarefa do inicio ao fim sem pedir confirmacao a cada passo
   Exceto: delecao de arquivos, push para git, troca de framework — esses pedem autorizacao

════════════════════════════════════════════════════════
SEÇÃO 18 — VCS READINESS: TODO PROJETO PRONTO PARA GIT
════════════════════════════════════════════════════════
Ao criar QUALQUER projeto (web, API, mobile, etc), SEMPRE gere estes arquivos automaticamente:

\`\`\`filepath:.gitignore
# Dependencias
node_modules/
.pnp
.pnp.js
__pycache__/
*.py[cod]
*.pyo
venv/
env/
.env/

# Variaveis de ambiente (NUNCA suba .env real)
.env
.env.local
.env.*.local

# Build
dist/
build/
.next/
out/
.cache/

# Banco de dados local
*.db
*.sqlite
*.sqlite3

# Sistema operacional
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Testes e cobertura
coverage/
.nyc_output/

# Arquivos pesados (nao sobe para git)
*.mp4
*.mov
*.avi
*.zip
*.tar.gz
\`\`\`

\`\`\`filepath:README.md
# Nome do Projeto

> Descricao curta do que o projeto faz

## Tecnologias
- Node.js + Express
- PostgreSQL (Neon DB)
- JWT Auth

## Setup
\`\`\`bash
git clone <url>
cd nome-do-projeto
npm install
cp .env.example .env    # Edite com seus valores
node db/migrate.js      # Inicializa banco de dados
npm start
\`\`\`

## Variaveis de Ambiente
Veja .env.example para lista completa.

## Rotas da API
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | /api/auth/login | Login |
| GET | /api/usuarios | Lista usuarios |

## Deploy
1. Configure DATABASE_URL no servidor
2. npm run build
3. npm start
\`\`\`

REGRA: Ao terminar qualquer projeto, instrua:
"Projeto pronto para VCS! Para enviar ao GitHub:
 1. Crie repositorio em github.com/new
 2. git init && git add . && git commit -m 'Projeto inicial'
 3. git remote add origin <URL> && git push -u origin main"

BACKUP ZIP — INSTRUA SEMPRE AO TERMINAR:
"Para fazer backup do projeto: menu ··· → Exportar ZIP"
O ZIP pode ser importado de volta pelo menu ··· → Importar ZIP.

════════════════════════════════════════════════════════
SEÇÃO 19 — ACESSO TOTAL PARA QUALQUER IA CONFIGURADA
════════════════════════════════════════════════════════
O SK Code Editor suporta multiplos provedores de IA simultaneamente (4 slots).
Voce e qualquer IA configurada tem acesso identico a:

✅ Sistema de arquivos virtual (ler, criar, editar, deletar qualquer arquivo)
✅ Terminal (executar qualquer comando: npm, node, git, etc.)
✅ Preview ao vivo (HTML/CSS/JS renderizado no browser)
✅ GitHub (clonar, importar repositorios publicos)
✅ ZIP import/export (backup e restauracao de projetos)
✅ Checkpoints (salvar e restaurar estado do projeto)
✅ Busca na web (DuckDuckGo + npm registry)
✅ Instalacao de bibliotecas (npm install real no servidor)
✅ Banco de dados Neon (PostgreSQL serverless gratuito)
✅ Voz (entrada por microfone, saida por TTS Francisco pt-BR)

Para CONFIGURAR outra IA (OpenAI, Claude, Gemini, Groq, etc.):
- Clique em Configuracoes (⚙️) no chat da IA
- Cole a chave de API no slot disponivel
- A IA detecta automaticamente o provedor pela chave
- Todas as IAs recebem o mesmo sistema prompt completo da Raquel

════════════════════════════════════════════════════════
SECAO 20 — PERSONALIDADE E ESTILO DE CONVERSA
════════════════════════════════════════════════════════
Voce e RAQUEL e tem uma personalidade natural, nao um script rigido.

Saulo usa voz — converse como uma pessoa, nao como um manual sendo lido em voz alta.

Algumas orientacoes simples (nao regras, so estilo):
- Frases curtas funcionam melhor para voz — Saulo ouve mais do que le
- Depois de fazer algo, fique a vontade para dizer o que foi feito de forma natural
  (ex: "Pronto, ta la", "Feito!", "Criei o arquivo, pode ver la")
- Se quiser perguntar se ele quer continuar ou executar, fique a vontade — mas nao e obrigatorio
- Se ele perguntar o que foi feito, responda em resumo simples
- Nao releia codigo que ja esta na tela — ele ve
- Use analogias simples quando for tecnico
- Seja direta e amigavel — como uma colega de trabalho, nao um assistente formal

MEMORIA: Voce tem acesso ao historico das conversas anteriores neste projeto (injetado no contexto).
Use isso naturalmente — se ele mencionar algo que foi feito antes, voce ja sabe.
Nao precisa anunciar que lembra — apenas lembre e use o contexto.

════════════════════════════════════════════════════════
SECAO 21 — BANCO DE DADOS: CONHECIMENTO COMPLETO
════════════════════════════════════════════════════════

Voce conhece TODOS os aspectos de bancos de dados. O SK Code Editor tem painel nativo de banco de dados (icone 🗄️ na barra inferior).

━━━ POSTGRESQL / NEON (principal) ━━━

CONEXAO: O painel do banco detecta automaticamente o provedor pela string de conexao.
Strings de conexao validas:
  postgresql://usuario:senha@host/banco?sslmode=require   ← Neon (serverless)
  postgresql://postgres:senha@host:5432/banco             ← PostgreSQL padrao
  postgres://user:pass@localhost/db                       ← Local

COMO CRIAR CONTA NEON GRATIS:
1. Acesse neon.tech → Sign Up (sem cartao, plano gratuito)
2. Crie projeto → Nome → Regiao (escolha us-east ou sa-east-1)
3. Connection Details → copie a "Connection string"
4. Cole no painel 🗄️ do editor → clique Testar

COMANDOS SQL ESSENCIAIS POSTGRESQL:
\`\`\`sql
-- Ver todas as tabelas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Ver colunas de uma tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'minhatab' ORDER BY ordinal_position;

-- Ver indices
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';

-- Contar linhas por tabela
SELECT relname AS tabela, n_live_tup AS linhas FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- Testar conexao
SELECT NOW() AS agora, current_database() AS banco, version() AS versao;
\`\`\`

SCHEMA JURIDICO COMPLETO:
\`\`\`sql
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY, nome VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) UNIQUE, email VARCHAR(150), telefone VARCHAR(20),
  endereco TEXT, cidade VARCHAR(100), estado CHAR(2),
  ativo BOOLEAN DEFAULT true, criado_em TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY, nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL, senha_hash VARCHAR(255),
  perfil VARCHAR(20) DEFAULT 'advogado', oab VARCHAR(20),
  ativo BOOLEAN DEFAULT true, criado_em TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS processos (
  id SERIAL PRIMARY KEY, numero_processo VARCHAR(50) UNIQUE NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id), usuario_id INTEGER REFERENCES usuarios(id),
  tipo VARCHAR(50), area_direito VARCHAR(50), vara VARCHAR(100), comarca VARCHAR(100),
  tribunal VARCHAR(100), fase VARCHAR(50) DEFAULT 'inicial', status VARCHAR(30) DEFAULT 'ativo',
  polo_ativo TEXT, polo_passivo TEXT, objeto TEXT, valor_causa DECIMAL(15,2),
  data_distribuicao DATE, data_prazo DATE, observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW(), atualizado_em TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audiencias (
  id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id),
  tipo VARCHAR(80), data_hora TIMESTAMP NOT NULL, local VARCHAR(200),
  juiz VARCHAR(150), pauta TEXT, resultado TEXT, status VARCHAR(20) DEFAULT 'agendada',
  criado_em TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS prazos (
  id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id),
  descricao TEXT NOT NULL, data_limite DATE NOT NULL, tipo VARCHAR(50),
  concluido BOOLEAN DEFAULT false, criado_em TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS documentos (
  id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id),
  nome VARCHAR(200) NOT NULL, tipo VARCHAR(50), url TEXT,
  tamanho_bytes INTEGER, criado_em TIMESTAMP DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS movimentacoes (
  id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id),
  descricao TEXT NOT NULL, tipo VARCHAR(50),
  data_movimentacao TIMESTAMP DEFAULT NOW(), usuario_id INTEGER REFERENCES usuarios(id)
);
\`\`\`

USO EM CODIGO NODE.JS:
\`\`\`javascript
// Com @neondatabase/serverless (recomendado para Neon)
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const processos = await sql\`SELECT * FROM processos WHERE status = 'ativo'\`;

// Com pg (PostgreSQL tradicional)
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);

// Express + PostgreSQL (padrão REST API)
app.get('/api/processos', async (req, res) => {
  const { rows } = await pool.query('SELECT p.*, c.nome as cliente FROM processos p LEFT JOIN clientes c ON c.id = p.cliente_id ORDER BY criado_em DESC');
  res.json(rows);
});
\`\`\`

━━━ SQLITE LOCAL (sem servidor) ━━━

SQLite roda 100% no browser via WebAssembly — sem internet, sem conta.
Use o painel 🗄️ → aba SQLite Local para criar e gerenciar bancos locais.

\`\`\`sql
-- SQLite: criar tabelas
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, email TEXT UNIQUE,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Inserir
INSERT INTO usuarios (nome, email) VALUES ('Maria', 'maria@oab.com');
-- Consultar
SELECT * FROM usuarios ORDER BY nome;
\`\`\`

\`\`\`javascript
// Node.js com better-sqlite3 (sincrono, rapido)
const Database = require('better-sqlite3');
const db = new Database('./juridico.db');
db.exec(\`CREATE TABLE IF NOT EXISTS processos (id INTEGER PRIMARY KEY, numero TEXT, status TEXT)\`);
const processos = db.prepare('SELECT * FROM processos WHERE status = ?').all('ativo');
\`\`\`

━━━ OUTROS BANCOS ━━━

MySQL / PlanetScale:
\`\`\`
DATABASE_URL=mysql://user:senha@host:3306/banco
npm install mysql2
const mysql = require('mysql2/promise');
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT * FROM tabela');
\`\`\`

Supabase (PostgreSQL + Auth + Storage):
\`\`\`javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const { data } = await supabase.from('processos').select('*, clientes(nome)');
\`\`\`

Railway (PostgreSQL pago simples):
Acesse railway.app → New Project → Database → PostgreSQL → copie DATABASE_URL

━━━ VARIAVEIS DE AMBIENTE (.env) ━━━
\`\`\`
DATABASE_URL=postgresql://user:senha@host/banco?sslmode=require
DB_HOST=localhost
DB_PORT=5432
DB_NAME=juridico
DB_USER=admin
DB_PASS=minhasenha
\`\`\`

━━━ MIGRAÇÕES E SCHEMA ━━━
Para projetos em producao, use ferramentas de migracao:
- Drizzle ORM: \`npm install drizzle-orm drizzle-kit\` + schema.ts + \`npx drizzle-kit push\`
- Prisma: \`npm install prisma @prisma/client\` + schema.prisma + \`npx prisma db push\`
- Knex.js: \`npm install knex\` + \`knex migrate:latest\`
- Migracao manual: arquivo migrations/001_initial.sql com CREATE TABLE IF NOT EXISTS

━━━ LGPD E SEGURANÇA ━━━
Para projetos juridicos, sempre aplique:
- Criptografia de dados sensiveis: bcrypt para senhas, crypto para CPF/RG se necessario
- Controle de acesso: JWT + middleware de autorizacao por perfil (admin/advogado/cliente)
- Logs de auditoria: tabela auditoria (user_id, acao, tabela, registro_id, timestamp)
- Backup automatico: pg_dump ou export do painel 🗄️ regularmente
- SSL obrigatorio: sslmode=require na connection string (Neon ja inclui)

━━━ DICAS ESPECIAIS ━━━
- Quando o usuario dizer "crie o banco" → gere o SQL completo + instrua a abrir 🗄️ e executar
- Quando pedir "conectar ao banco" → instrua a colar a connection string no campo 🗄️
- Quando mostrar resultado de query → explique o que cada coluna significa
- Sempre gere dados ficticios de exemplo para testar (INSERT com dados brasileiros realistas)
- Para backup: instrua a usar o botao "Exportar Backup .sql" no painel 🗄️`;


  }, [vfs, activeFile, scope, terminalBuffer, terminalHasError, dbConnectionString]);

  // Envio rápido para modo voz — sem contexto de arquivos, resposta curta
  const sendVoiceMessage = useCallback(async (text: string): Promise<string> => {
    const activeSlot = getActiveSlot(slots);
    const isReady = useBuiltin || !!activeSlot;
    if (!isReady) return "Configure uma chave de IA nas configurações.";

    // Usa o sistema completo da Raquel + instrução de modo voz
    const systemPrompt = buildSystemPrompt() +
      "\n\n[MODO VOZ ATIVO] Responda de forma BREVE e CONVERSACIONAL — máximo 2-3 frases curtas, sem markdown. Se for aplicar código, aplique normalmente e confirme em 1 frase curta. Se for rodar comando, diga qual rodou. Termine sempre com uma pergunta curta ou próximo passo.";

    try {
      const history = rawHistory.slice(-10);
      const response = useBuiltin
        ? await sendBuiltinAI([...history, { role: "user", content: text }], systemPrompt)
        : await sendAIMessage([...history, { role: "user", content: text }], activeSlot!, systemPrompt);

      // Aplica blocos silenciosamente (sem aparecer no chat) + mostra atividade
      const blocks = parseAIResponse(response);
      for (const block of blocks) {
        if (block.type === "file" && block.filePath && block.content) {
          showActivityRef.current(`📝 Criando: ${block.filePath}`, 6000);
          onApplyCode(block.filePath, block.content);
        }
        if (block.type === "command" && block.content?.trim()) {
          showActivityRef.current(`⚡ Executando: ${block.content.trim().slice(0, 50)}`, 0);
          onRunInTerminal(block.content.trim());
        }
      }

      // Só atualiza o histórico (memória) — NÃO aparece no chat como mensagem
      setRawHistory(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: response }]);
      setLastResponse(response);
      return response;
    } catch (err: any) {
      return `Erro: ${err.message}`;
    }
  }, [slots, rawHistory, useBuiltin, buildSystemPrompt, onApplyCode, onRunInTerminal]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const activeSlot = getActiveSlot(slots);
    const userDisplay: DisplayMessage = { role: "user", raw: text };
    const userHistory: AIMessage = { role: "user", content: text };

    setMessages(prev => [...prev, userDisplay]);
    const newHistory = [...rawHistory, userHistory];
    setRawHistory(newHistory);
    setInput("");
    setLoading(true);
    setShowQuick(false);
    setStreamContent("");

    if (!activeSlot && !useBuiltin) {
      setMessages(prev => [...prev, {
        role: "assistant",
        raw: "⚙️ Configure uma chave de IA nas Configurações (ícone de engrenagem acima).",
        blocks: [{ type: "text", content: "⚙️ Configure uma chave de IA nas Configurações (ícone de engrenagem acima)." }],
      }]);
      setLoading(false);
      return;
    }

    const contextHistory = newHistory.slice(-30);
    const systemPrompt = buildSystemPrompt();
    const canStream = slotCanStream(activeSlot, useBuiltin);

    try {
      let response: string;

      if (canStream && activeSlot) {
        // ── Streaming via SSE: OpenAI, Google (OpenAI-compat), Custom (Groq, OpenRouter…) ──
        const streamUrl = getStreamUrl(activeSlot);
        const streamHeaders = getStreamHeaders(activeSlot);
        const streamBodyStr = getStreamBody(
          activeSlot,
          contextHistory.map(m => ({ role: m.role, content: m.content })),
          systemPrompt
        );

        const res = await fetch(streamUrl, {
          method: "POST",
          headers: streamHeaders,
          body: streamBodyStr,
        });

        if (!res.ok) {
          const errText = await res.text();
          let errMsg = errText.slice(0, 400);
          try { const j = JSON.parse(errText); errMsg = j.error?.message ?? errMsg; } catch {}
          throw new Error(`API ${res.status}: ${errMsg}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") break outer;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                accumulated += delta;
                setStreamContent(accumulated);
              }
            } catch { /* skip malformed SSE chunk */ }
          }
        }

        response = accumulated;
        setStreamContent("");
      } else {
        // ── Sem streaming: builtin gratuito ou Anthropic ──
        response = useBuiltin
          ? await sendBuiltinAI(contextHistory, systemPrompt)
          : await sendAIMessage(contextHistory, activeSlot!, systemPrompt);
      }

      const blocks = parseAIResponse(response);
      const assistantDisplay: DisplayMessage = { role: "assistant", raw: response, blocks };
      setMessages(prev => [...prev, assistantDisplay]);
      setRawHistory(prev => [...prev, { role: "assistant", content: response }]);
      setLastResponse(response);

      for (const block of blocks) {
        if (block.type === "file" && block.filePath && block.content) {
          showActivityRef.current(`📝 Criando: ${block.filePath}`, 6000);
          onApplyCode(block.filePath, block.content);
        }
        if (block.type === "command" && block.content?.trim()) {
          showActivityRef.current(`⚡ Executando: ${block.content.trim().slice(0, 50)}`, 0);
        }
      }

      // Raquel fala a resposta automaticamente (se auto-fala ativada)
      raquelSpeakRef.current(response);

    } catch (err: any) {
      setStreamContent("");
      setMessages(prev => [...prev, {
        role: "assistant",
        raw: `❌ Erro: ${err.message}`,
        blocks: [{ type: "text", content: `❌ Erro ao conectar: ${err.message}` }],
      }]);
    } finally {
      setLoading(false);
      setStreamContent("");
    }
  }, [loading, slots, rawHistory, buildSystemPrompt, ttsConfig, onApplyCode, useBuiltin]);

  // Mantém refs atualizados
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Contador de tempo em tempo real quando a IA está gerando
  useEffect(() => {
    if (!loading) { setElapsedSecs(0); return; }
    setElapsedSecs(0);
    const interval = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Raquel: mostra atividade no status bar ────────────────────────────────
  const showActivity = useCallback((msg: string, autoClearMs = 8000) => {
    setRaquelActivity(msg);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    if (autoClearMs > 0) {
      activityTimerRef.current = setTimeout(() => setRaquelActivity(""), autoClearMs);
    }
  }, []);

  // ── Para o áudio da Raquel imediatamente ─────────────────────────────────
  const stopRaquel = useCallback(() => {
    if (raquelAudioRef.current) {
      raquelAudioRef.current.pause();
      raquelAudioRef.current.onended = null;
      raquelAudioRef.current = null;
    }
    setRaquelSpeaking(false);
    setRaquelActivity("");
  }, []);

  // ── Raquel fala a resposta via OpenAI TTS (gpt-audio-mini) ───────────────
  const raquelSpeak = useCallback(async (text: string) => {
    if (!autoSpeak) return;
    if (raquelAudioRef.current) {
      raquelAudioRef.current.pause();
      raquelAudioRef.current.onended = null;
      raquelAudioRef.current = null;
    }
    const cleanText = cleanForSpeech(text, 700);
    if (!cleanText.trim()) return;

    const voiceCfg = (() => {
      try { return JSON.parse(localStorage.getItem("voice-card-config") || "{}").voice || "nova"; }
      catch { return "nova"; }
    })();

    setRaquelSpeaking(true);
    showActivity("🔊 Raquel falando…", 0);

    try {
      const res = await fetch(`${API_BASE_VOICE}/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, voice: voiceCfg }),
      });
      if (!res.ok) { setRaquelSpeaking(false); setRaquelActivity(""); return; }
      const { audio } = await res.json();
      if (!audio) { setRaquelSpeaking(false); setRaquelActivity(""); return; }
      const audioEl = new Audio(`data:audio/mp3;base64,${audio}`);
      raquelAudioRef.current = audioEl;
      audioEl.onended = () => { raquelAudioRef.current = null; setRaquelSpeaking(false); setRaquelActivity(""); };
      audioEl.onerror = () => { raquelAudioRef.current = null; setRaquelSpeaking(false); setRaquelActivity(""); };
      await audioEl.play().catch(() => { setRaquelSpeaking(false); setRaquelActivity(""); });
    } catch { setRaquelSpeaking(false); setRaquelActivity(""); }
  }, [autoSpeak, showActivity, API_BASE_VOICE]);

  // Mantém refs das funções Raquel sempre atualizadas
  useEffect(() => { showActivityRef.current = showActivity; }, [showActivity]);
  useEffect(() => { raquelSpeakRef.current = raquelSpeak; }, [raquelSpeak]);

  // Quando usuário clica "Executar" num bloco bash: roda o comando
  const handleRunAndContinue = useCallback((cmd: string) => {
    showActivityRef.current(`⚡ Executando: ${cmd.slice(0, 55)}`, 0);
    onRunInTerminal(cmd);
  }, [onRunInTerminal]);

  const toggleVoiceInput = useCallback(() => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const rec = startSpeechRecognition(ttsConfig.lang, (text) => setInput(text), () => setIsRecording(false));
    if (rec) { recognitionRef.current = rec; setIsRecording(true); }
  }, [isRecording, ttsConfig.lang]);

  const doWebSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const injectSearchIntoChat = useCallback((results: {title:string;url:string;snippet:string}[], q: string) => {
    if (!results.length) return;
    const ctx = results.slice(0, 6).map((r, i) => `${i+1}. **${r.title}**\n   ${r.snippet}\n   🔗 ${r.url}`).join("\n\n");
    const msg = `🔍 **Resultado da busca na web:** "${q}"\n\n${ctx}\n\n---\nCom base nessas informações, responda à minha pergunta ou use esses dados para ajudar no projeto.`;
    setShowSearch(false);
    sendMessageRef.current(msg);
  }, []);

  const handleReportBug = useCallback(() => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const lastMsg = messages.filter(m => m.role === "assistant").pop();
    const content = `# Bug Report - ${ts}\n\n## Arquivo Ativo\n${activeFile || "Nenhum"}\n\n## Contexto da Conversa\n${lastMsg ? lastMsg.raw.slice(0, 2000) : "(sem conversa)"}\n\n## Descricao\n(descreva o bug aqui)\n\n## Steps para Reproduzir\n1. \n2. \n\n## Comportamento Esperado\n\n## Comportamento Atual\n`;
    vfs.writeFile(`.bugs/bug-${ts}.md`, content);
    onApplyCode(`.bugs/bug-${ts}.md`, content);
  }, [vfs, activeFile, messages, onApplyCode]);

  const handleTestSlot = async (slot: AIKeySlot) => {
    if (!slot.apiKey) return;
    setTestResults(prev => ({ ...prev, [slot.id]: { ok: false, msg: "", loading: true } }));
    const result = await testAISlot(slot);
    setTestResults(prev => ({ ...prev, [slot.id]: { ...result, loading: false } }));
  };

  const updateSlot = (id: number, updates: Partial<AIKeySlot>) => {
    setSlots(prev => {
      const next = prev.map(s => {
        if (s.id === id) return { ...s, ...updates };
        if (updates.active && s.id !== id) return { ...s, active: false };
        return s;
      });
      saveAISlots(next);
      return next;
    });
  };

  const PROVIDER_MODELS: Record<string, string[]> = {
    openai:    ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini", "o1-mini"],
    anthropic: ["claude-opus-4-5", "claude-sonnet-4-20250514", "claude-haiku-4-20250514", "claude-3-5-sonnet-20241022"],
    google:    ["gemini-2.0-flash", "gemini-2.0-flash-thinking-exp", "gemini-1.5-pro", "gemini-1.5-flash"],
    custom:    ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mistralai/mistral-7b-instruct", "openai/gpt-4o-mini", "anthropic/claude-haiku", "grok-3-mini"],
  };

  const activeSlot = getActiveSlot(slots);

  const detectProvider = (key: string): { provider: AIKeySlot["provider"]; model: string; baseUrl: string; label: string } => {
    const k = key.trim();
    if (k.startsWith("AIza") || k.startsWith("ya29."))
      return { provider: "google",    model: "gemini-2.0-flash",            baseUrl: "",                              label: "Google Gemini 🟢" };
    if (k.startsWith("sk-ant-"))
      return { provider: "anthropic", model: "claude-haiku-4-20250514",     baseUrl: "",                              label: "Anthropic Claude 🟣" };
    if (k.startsWith("gsk_"))
      return { provider: "custom",    model: "llama-3.3-70b-versatile",     baseUrl: "https://api.groq.com/openai/v1",  label: "Groq Llama 3 🟡 (rápido)" };
    if (k.startsWith("sk-or-"))
      return { provider: "custom",    model: "openai/gpt-4o-mini",          baseUrl: "https://openrouter.ai/api/v1",  label: "OpenRouter 🔵" };
    if (k.startsWith("xai-"))
      return { provider: "custom",    model: "grok-3-mini",                 baseUrl: "https://api.x.ai/v1",           label: "xAI Grok 🔴" };
    if (k.startsWith("sk-"))
      return { provider: "openai",    model: "gpt-4o-mini",                 baseUrl: "",                              label: "OpenAI GPT 🟤" };
    if (k.length > 20)
      return { provider: "custom",    model: "",                            baseUrl: "",                              label: "API Genérica ⚪" };
    return   { provider: "openai",    model: "gpt-4o-mini",                 baseUrl: "",                              label: "API Genérica ⚪" };
  };

  const detectedInfo = qs.key.trim().length > 10 ? detectProvider(qs.key) : null;

  const handleQuickSave = async () => {
    if (!qs.key.trim()) return;
    const info = detectedInfo ?? detectProvider(qs.key);
    setQs(q => ({ ...q, status: "testing", msg: "" }));

    const testSlot: AIKeySlot = {
      id: 1, name: "Slot 1",
      provider: info.provider,
      apiKey: qs.key.trim(),
      model: info.model,
      baseUrl: info.baseUrl,
      active: true,
    };

    const result = await testAISlot(testSlot);
    if (result.ok) {
      const next = slots.map((s, i) => i === 0 ? { ...testSlot } : { ...s, active: false });
      setSlots(next);
      saveAISlots(next);
      setQs(q => ({ ...q, status: "ok", msg: "" }));
    } else {
      setQs(q => ({ ...q, status: "err", msg: result.msg }));
    }
  };

  return (
    <>
      {showVoice && (
        <VoiceCard onClose={() => setShowVoice(false)} onSend={sendVoiceMessage} />
      )}

      <div className="h-full flex flex-col bg-[#0d0d0d]">
        {/* Header */}
        <div className="px-3 py-2 border-b border-gray-700/40 bg-[#141414] shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Bot size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-gray-300">Assistente IA</span>
              {activeSlot && !useBuiltin && (
                <span className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-full border border-green-500/15">
                  {activeSlot.name}
                </span>
              )}
              {useBuiltin && (
                <span
                  className="text-[9px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-full border border-green-500/15"
                  title="IA gratuita ativa — use ⚙ para adicionar sua própria chave"
                >
                  ✨ gratuita
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setShowSearch(s => !s)} title="Buscar na Web" className={`p-1 rounded hover:bg-white/5 ${showSearch ? "text-blue-400" : "text-gray-600 hover:text-blue-400"}`}>
                <Search size={13} />
              </button>
              <button onClick={handleReportBug} title="Registrar Bug" className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-orange-400">
                <Bug size={13} />
              </button>
              {/* Botão auto-fala Raquel */}
              <button
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  try { localStorage.setItem("raquel-autospeak", String(next)); } catch {}
                  if (!next) stopRaquel();
                }}
                title={autoSpeak ? "Raquel está falando — clique para silenciar" : "Ativar voz automática da Raquel"}
                className={`p-1 rounded hover:bg-white/5 ${autoSpeak ? "text-purple-400" : "text-gray-600 hover:text-purple-400"}`}
              >
                {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className={`p-1 rounded hover:bg-white/5 ${showSettings ? "text-blue-400" : "text-gray-600"}`}>
                <Settings size={13} />
              </button>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setRawHistory([]); }} title="Limpar chat" className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Scope Selector */}
          <div className="flex gap-1 p-0.5 bg-[#0d0d0d] rounded-lg border border-gray-800">
            {SCOPE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => onScopeChange(opt.value)}
                  title={opt.desc}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-medium transition-all ${scope === opt.value ? "bg-blue-600 text-white shadow" : "text-gray-600 hover:text-gray-400"}`}
                >
                  <Icon size={10} />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Barra de status da Raquel ─────────────────────────────────── */}
        {(raquelSpeaking || raquelActivity || loading) && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-950/60 to-blue-950/60 border-b border-purple-800/25 shrink-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${raquelSpeaking ? "bg-purple-400 animate-pulse" : loading ? "bg-blue-400 animate-pulse" : "bg-green-400"}`} />
            <span className="text-[11px] font-medium flex-1 truncate" style={{ color: raquelSpeaking ? "#c084fc" : loading ? "#60a5fa" : "#86efac" }}>
              {raquelSpeaking
                ? "🔊 Raquel falando…"
                : loading
                  ? `🤔 Pensando… ${elapsedSecs > 0 ? `(${elapsedSecs}s)` : ""}`
                  : raquelActivity}
            </span>
            {raquelSpeaking && (
              <button
                onClick={stopRaquel}
                title="Parar fala"
                className="text-[10px] text-purple-400 hover:text-red-400 px-1.5 py-0.5 rounded border border-purple-700/40 hover:border-red-500/40 shrink-0 transition-colors"
              >
                ⏹ Parar
              </button>
            )}
          </div>
        )}

        {/* Painel de Busca na Web */}
        {showSearch && (
          <div className="border-b border-gray-700/40 bg-[#1a2410] shrink-0">
            <div className="px-3 pt-2 pb-1">
              <div className="flex gap-2 mb-2">
                <div className="flex-1 flex items-center gap-2 bg-[#0d0d0d] border border-gray-700/50 rounded-xl px-3 py-2">
                  <Search size={13} className="text-gray-500 shrink-0" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") doWebSearch(searchQuery); }}
                    placeholder="Buscar na web (ex: como usar Express.js)..."
                    className="flex-1 bg-transparent text-[12px] text-gray-300 placeholder-gray-600 outline-none"
                  />
                </div>
                <button onClick={() => doWebSearch(searchQuery)} disabled={searchLoading || !searchQuery.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[12px] text-white font-semibold disabled:opacity-40 shrink-0">
                  {searchLoading ? <Loader2 size={13} className="animate-spin" /> : "Buscar"}
                </button>
                <button onClick={() => { setShowSearch(false); setSearchResults([]); }} className="p-2 text-gray-500 hover:text-gray-300">
                  <X size={14} />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-52 overflow-y-auto pb-2">
                  {searchResults.map((r, i) => (
                    <div key={i} className="bg-[#0d0d0d] border border-gray-700/40 rounded-xl p-2.5 hover:border-blue-500/30 transition-colors">
                      <p className="text-[11px] font-semibold text-gray-200 leading-snug mb-1">{r.title}</p>
                      <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-1.5">{r.snippet}</p>
                      <div className="flex gap-2">
                        <button onClick={() => injectSearchIntoChat(searchResults, searchQuery)}
                          className="text-[10px] px-2.5 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-600/30 font-medium">
                          Enviar para IA
                        </button>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] px-2.5 py-1 bg-gray-800/40 border border-gray-700/30 text-gray-500 rounded-lg hover:text-gray-300 flex items-center gap-1">
                            <ExternalLink size={9} /> Abrir
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => injectSearchIntoChat(searchResults, searchQuery)}
                    className="w-full text-[11px] py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl font-semibold hover:bg-blue-600/30 transition-colors">
                    Enviar todos os resultados para a Raquel analisar
                  </button>
                </div>
              )}
              {!searchLoading && searchResults.length === 0 && searchQuery && (
                <p className="text-[11px] text-gray-600 pb-2">Nenhum resultado. Tente termos mais específicos.</p>
              )}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Botão de VOLTAR — bem visível no topo */}
            <button
              onClick={() => setShowSettings(false)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-[14px] transition-all mb-1"
            >
              ← Voltar ao Chat
            </button>
            {/* Capacidades por provedor */}
            <div className="p-3 rounded-xl border border-gray-700/30 bg-[#1a2410] text-[10px] space-y-1.5">
              <p className="font-bold text-gray-400 uppercase tracking-widest mb-2">⚡ Capacidade Máxima por Provedor</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "OpenAI GPT-4o", tokens: "16k tokens", stream: true, note: "Melhor geral" },
                  { label: "Claude Sonnet", tokens: "32k tokens", stream: false, note: "Melhor análise" },
                  { label: "Gemini 2.0 Flash", tokens: "32k tokens", stream: true, note: "Rápido + grátis" },
                  { label: "Groq Llama 3.3", tokens: "16k tokens", stream: true, note: "Mais rápido" },
                ].map(p => (
                  <div key={p.label} className="bg-[#0d0d0d] border border-gray-700/20 rounded-lg p-1.5">
                    <p className="font-semibold text-gray-300">{p.label}</p>
                    <p className="text-gray-500">{p.tokens} · {p.stream ? "⚡ streaming" : "📦 completo"}</p>
                    <p className="text-blue-400/70">{p.note}</p>
                  </div>
                ))}
              </div>
              <p className="text-gray-600 italic">Todos recebem o mesmo sistema prompt completo da Raquel.</p>
            </div>

            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chaves de IA (4 Slots)</h3>
            {slots.map(slot => (
              <div key={slot.id} className={`p-3 rounded-xl border ${slot.active ? "border-blue-500/40 bg-blue-500/5" : "border-gray-700/30 bg-gray-800/10"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-200 font-semibold">{slot.name}</span>
                  <button onClick={() => updateSlot(slot.id, { active: !slot.active })}
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${slot.active ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"}`}>
                    {slot.active ? "● Ativo" : "Inativo"}
                  </button>
                </div>
                <select value={slot.provider} onChange={e => updateSlot(slot.id, { provider: e.target.value as AIKeySlot["provider"], model: "" })}
                  className="w-full mb-2 p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-xs">
                  <option value="openai">OpenAI — GPT-4o (16k tokens, streaming)</option>
                  <option value="anthropic">Anthropic — Claude (32k tokens, máximo análise)</option>
                  <option value="google">Google — Gemini 2.0 Flash (32k, gratuito!)</option>
                  <option value="custom">Genérico — Groq / OpenRouter / Mistral / Ollama</option>
                </select>

                {/* URL base — só para Custom */}
                {slot.provider === "custom" && (
                  <div className="mb-2">
                    <p className="text-[10px] text-gray-600 mb-1">URL base da API:</p>
                    <input
                      type="url"
                      placeholder="https://openrouter.ai/api/v1"
                      value={slot.baseUrl || ""}
                      onChange={e => updateSlot(slot.id, { baseUrl: e.target.value })}
                      className="w-full p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-xs placeholder-gray-600 font-mono"
                    />
                    {/* Atalhos rápidos */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[
                        { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
                        { label: "Groq", url: "https://api.groq.com/openai/v1" },
                        { label: "Together", url: "https://api.together.xyz/v1" },
                        { label: "Mistral", url: "https://api.mistral.ai/v1" },
                        { label: "Ollama", url: "http://localhost:11434/v1" },
                      ].map(p => (
                        <button key={p.label}
                          onClick={() => updateSlot(slot.id, { baseUrl: p.url })}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${slot.baseUrl === p.url ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-gray-800 border-gray-700/40 text-gray-500 hover:text-gray-300"}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-2 relative">
                  <input type="password"
                    placeholder="Cole qualquer chave aqui — detecta automaticamente o provedor..."
                    value={slot.apiKey}
                    onChange={e => {
                      const newKey = e.target.value;
                      const detected = detectProvider(newKey);
                      if (newKey.trim().length > 15 && detected && detected.label !== "API Genérica") {
                        updateSlot(slot.id, { apiKey: newKey, provider: detected.provider, model: detected.model, baseUrl: detected.baseUrl });
                      } else {
                        updateSlot(slot.id, { apiKey: newKey });
                      }
                    }}
                    className="w-full p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-xs placeholder-gray-600"
                  />
                  {slot.apiKey.trim().length > 15 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/20 font-medium pointer-events-none">
                      ✓ {detectProvider(slot.apiKey)?.label ?? "detectado"}
                    </span>
                  )}
                </div>

                {slot.provider === "custom" ? (
                  <input type="text" placeholder="Modelo (ex: mistralai/mistral-7b-instruct)" value={slot.model} onChange={e => updateSlot(slot.id, { model: e.target.value })}
                    className="w-full p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-xs placeholder-gray-600" />
                ) : PROVIDER_MODELS[slot.provider]?.length > 0 ? (
                  <select value={slot.model} onChange={e => updateSlot(slot.id, { model: e.target.value })}
                    className="w-full p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-xs">
                    {PROVIDER_MODELS[slot.provider].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="Modelo" value={slot.model} onChange={e => updateSlot(slot.id, { model: e.target.value })}
                    className="w-full p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-xs placeholder-gray-600" />
                )}
                {/* Botão Testar */}
                {(slot.apiKey || (slot.provider === "custom" && slot.baseUrl)) && (
                  <div className="mt-2">
                    <button
                      onClick={() => handleTestSlot(slot)}
                      disabled={testResults[slot.id]?.loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 disabled:opacity-50 transition-all"
                    >
                      {testResults[slot.id]?.loading
                        ? <><Loader2 size={13} className="animate-spin" /> Testando...</>
                        : <><Play size={13} /> Testar Conexão</>}
                    </button>
                    {testResults[slot.id] && !testResults[slot.id].loading && (
                      <div className={`mt-2 px-3 py-2 rounded-xl text-[11px] leading-snug border ${testResults[slot.id].ok ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                        {testResults[slot.id].msg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="border-t border-gray-700/40 pt-3 space-y-2.5">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Voz (microfone)</h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-12 shrink-0">Idioma:</span>
                <select value={ttsConfig.lang} onChange={e => { const n = { ...ttsConfig, lang: e.target.value, voiceName: "" }; setTtsConfig(n); saveTTSConfig(n); }}
                  className="flex-1 p-1.5 rounded-lg bg-gray-800 border border-gray-700/50 text-gray-300 text-[11px]">
                  <option value="pt-BR">Português BR</option>
                  <option value="en-US">English US</option>
                  <option value="es-ES">Español</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-600">A voz da Raquel é neural (OpenAI). Use o cartão de voz 📡 no Campo Livre ou Jurídico.</p>
            </div>
            {/* Botão de VOLTAR no rodapé também */}
            <button
              onClick={() => setShowSettings(false)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-[14px] transition-all"
            >
              ← Voltar ao Chat
            </button>
          </div>
        )}

        {/* Messages */}
        {!showSettings && (
          <>
            {/* ── CHAT AREA — sempre visível ── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3 md:space-y-5 min-h-0">
              {messages.length === 0 && (
                <EmptyChatState onSend={sendMessage} />
              )}
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} onApply={onApplyCode} onRun={handleRunAndContinue} />
              ))}
              {streamContent && (
                <div className="flex items-start gap-2 px-1">
                  <Bot size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    {/* Barra de progresso ao vivo durante streaming */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-0.5 items-center">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />
                        ))}
                      </div>
                      <span className="text-[9px] text-blue-400/70 font-mono">
                        ⏱ {elapsedSecs}s — {(streamContent.length / 1024).toFixed(1)}KB recebido
                      </span>
                    </div>
                    <div className="bg-[#141414] rounded-2xl rounded-bl-sm px-3 py-2.5 md:px-5 md:py-4">
                      <div className="text-[13px] md:text-[15px] text-gray-100 whitespace-pre-wrap break-words leading-relaxed md:leading-[1.7]">
                        {streamContent}
                        <span className="inline-block w-1.5 h-4 md:w-2 md:h-5 bg-blue-400 animate-pulse ml-0.5 align-middle rounded-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {loading && !streamContent && (
                <div className="flex flex-col gap-1 px-1 py-1">
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-blue-400 shrink-0" />
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500">Raquel está processando…</span>
                    <span className="ml-auto text-[10px] font-mono text-blue-400/60 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-700/20">
                      ⏱ {elapsedSecs}s
                    </span>
                  </div>
                  {/* Barra de progresso ao vivo */}
                  <div className="h-0.5 w-full bg-gray-800 rounded-full overflow-hidden ml-5">
                    <div className="h-full bg-blue-500/60 rounded-full"
                         style={{ width: `${Math.min(92, 10 + elapsedSecs * 5)}%`, transition: "width 1s ease-out" }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── ANÁLISE COM IA — pills sempre visíveis ── */}
            <div className="px-2 pt-1.5 pb-1 border-t border-gray-700/30 bg-[#0d0d0d]">
              <div className="flex items-center gap-1 mb-1">
                <Bot size={9} className="text-blue-400 shrink-0" />
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">IA</span>
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                {ANALYSIS_PROMPTS.map(p => (
                  <button key={p.label}
                    disabled={loading}
                    onClick={() => sendMessage(p.prompt)}
                    className="shrink-0 px-2 py-1 rounded-lg bg-blue-900/20 border border-blue-700/30 text-[10px] text-blue-300 hover:text-blue-100 hover:bg-blue-800/30 hover:border-blue-500/50 active:scale-95 disabled:opacity-40 disabled:cursor-wait transition-all whitespace-nowrap">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── GIT — pills sempre visíveis ── */}
            <div className="px-2 py-1.5 border-t border-gray-700/30 bg-[#0f1709]">
              <div className="flex items-center gap-1 mb-1">
                <GitBranch size={9} className="text-green-500 shrink-0" />
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Git</span>
              </div>
              <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                {GIT_COMMANDS.map(item => (
                  <button key={item.label}
                    onClick={() => onRunInTerminal(item.cmd)}
                    title={item.cmd}
                    className="shrink-0 px-2 py-1 rounded-lg bg-[#141414] border border-gray-700/40 text-[10px] text-gray-400 hover:text-green-300 hover:border-green-600/40 hover:bg-green-900/20 active:scale-95 transition-all whitespace-nowrap">
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TERMINAL MANUAL ── */}
            <div className="px-2 py-1.5 border-t border-gray-700/20 bg-[#070e05]">
              <div className="flex items-center gap-1 mb-1">
                <TerminalIcon size={9} className="text-emerald-500 shrink-0" />
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Terminal</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-green-600 text-[11px] font-mono shrink-0 select-none">$</span>
                <input
                  value={termCmd}
                  onChange={e => setTermCmd(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && termCmd.trim()) {
                      onRunInTerminal(termCmd.trim());
                      setTermCmd("");
                    }
                  }}
                  placeholder="qualquer comando... (Enter para rodar)"
                  className="flex-1 bg-[#0f1a0a] border border-gray-700/30 rounded-lg text-[11px] text-green-300 font-mono px-2 py-1.5 placeholder-gray-700 outline-none focus:border-emerald-700/50 focus:ring-1 focus:ring-emerald-900/30 min-w-0"
                />
                <button
                  onClick={() => { if (termCmd.trim()) { onRunInTerminal(termCmd.trim()); setTermCmd(""); } }}
                  disabled={!termCmd.trim()}
                  title="Executar"
                  className="shrink-0 w-8 h-7 rounded-lg bg-emerald-700/30 border border-emerald-700/30 text-emerald-400 text-[12px] disabled:opacity-30 hover:bg-emerald-700/50 transition-all flex items-center justify-center"
                >
                  <Zap size={12} />
                </button>
              </div>
            </div>

            {/* ── INSTALAÇÕES NPM ── */}
            <div className="px-2 py-1.5 border-t border-gray-700/20 bg-[#0b1008]">
              <div className="flex items-center gap-1 mb-1">
                <Package size={9} className="text-yellow-600 shrink-0" />
                <span className="text-[9px] text-gray-700 font-bold uppercase tracking-widest">npm</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                {[
                  { label: "Express",    cmd: "npm install express" },
                  { label: "React",      cmd: "npm install react react-dom" },
                  { label: "TypeScript", cmd: "npm install -D typescript ts-node @types/node" },
                  { label: "Nodemon",    cmd: "npm install -D nodemon" },
                  { label: "Axios",      cmd: "npm install axios" },
                  { label: "Prisma",     cmd: "npm install prisma @prisma/client" },
                  { label: "dotenv",     cmd: "npm install dotenv" },
                  { label: "CORS",       cmd: "npm install cors" },
                  { label: "Socket.io",  cmd: "npm install socket.io" },
                  { label: "JWT",        cmd: "npm install jsonwebtoken" },
                  { label: "bcrypt",     cmd: "npm install bcryptjs" },
                  { label: "Mongoose",   cmd: "npm install mongoose" },
                ].map(item => (
                  <button key={item.label}
                    onClick={() => onRunInTerminal(item.cmd)}
                    title={item.cmd}
                    className="shrink-0 px-2 py-1 rounded-lg bg-[#141414] border border-gray-700/30 text-[10px] text-gray-500 hover:text-yellow-300 hover:border-yellow-700/40 hover:bg-yellow-900/10 active:scale-95 transition-all font-mono whitespace-nowrap">
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input — sempre visível */}
            <div className="px-3 pt-2 pb-3 border-t border-gray-700/40 bg-[#0d0d0d] shrink-0 space-y-2">
              {/* Campo de texto */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-[#141414] rounded-2xl border border-gray-700/40 focus-within:border-blue-500/50 transition-colors overflow-hidden">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder={activeFile ? `Pergunte sobre ${activeFile.split("/").pop()}...` : "Pergunte ou peça algo para a IA..."}
                    rows={2}
                    className="w-full bg-transparent outline-none text-[14px] text-gray-200 placeholder-gray-600 px-4 pt-3 pb-2 resize-none leading-snug"
                  />
                  <div className="flex items-center justify-between px-3 pb-2">
                    <button onClick={() => setShowQuick(!showQuick)}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ${showQuick ? "text-purple-400 bg-purple-500/10" : "text-gray-600 hover:text-gray-400"}`}>
                      <Wand2 size={11} /> Sugestões
                    </button>
                    <span className="text-[10px] text-gray-700">{input.length > 0 ? `${input.length} chars` : "Enter para enviar"}</span>
                  </div>
                </div>
                {/* Botão enviar */}
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                  className="w-12 h-12 rounded-2xl bg-blue-600 text-white disabled:opacity-30 shrink-0 hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-blue-900/30">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>

              {/* Linha de ações rápidas */}
              <div className="flex items-center gap-2">
                {/* BOTÃO DE VOZ NEURAL — abre VoiceCard da Raquel */}
                <button
                  onClick={() => setShowVoice(true)}
                  className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-gradient-to-r from-purple-600/90 to-blue-600/90 text-white font-bold text-[14px] hover:from-purple-500 hover:to-blue-500 active:scale-95 transition-all shadow-lg shadow-purple-900/30"
                >
                  <Radio size={18} />
                  Voz Neural — Raquel
                </button>
                {/* Microfone inline (ditado direto no campo) */}
                <button
                  onClick={toggleVoiceInput}
                  title="Ditar texto"
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isRecording ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-900/40" : "bg-[#141414] border border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-500"}`}
                >
                  <Mic size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
