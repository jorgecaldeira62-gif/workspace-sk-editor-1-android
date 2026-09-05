import { useState, useRef, useCallback, useEffect } from "react";
import {
  Scale, ArrowLeft, Eye, EyeOff, Save, Key, X, Settings,
  Mic, MicOff, Volume2, VolumeX, Download, Copy, Check,
  Loader2, StopCircle, Trash2, FileText, FileAudio,
  ChevronDown, ChevronUp, MessageSquare, Send, Zap,
  BookOpen, Clock, Wand2, Plus, Pencil, AlignLeft, AlignJustify,
  Play, Search, Library, SlidersHorizontal,
} from "lucide-react";
import { speak, stopSpeaking, loadTTSConfig, saveTTSConfig, getAvailableVoices, cleanForSpeech, type TTSConfig } from "@/lib/tts-service";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ementa {
  id: string;
  titulo: string;
  categoria: string;
  texto: string;
  criadoEm: string;
}

interface HistoryEntry {
  id: string;
  acao: string;
  inputSnippet: string;
  resultado: string;
  timestamp: string;
}

interface CustomAction {
  id: string;
  label: string;
  descricao: string;
  prompt: string;
}

interface SavedKey { id: string; label: string; key: string; url: string; model: string; provider: string; }
interface ChatMsg { role: "user" | "assistant"; content: string; }

// ─── Constantes ───────────────────────────────────────────────────────────────
const EFFORT_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: "Rápido",    color: "text-blue-400",   desc: "Resposta direta e concisa" },
  2: { label: "Básico",    color: "text-cyan-400",    desc: "Pontos principais" },
  3: { label: "Detalhado", color: "text-amber-400",   desc: "Análise completa" },
  4: { label: "Profundo",  color: "text-orange-400",  desc: "Fundamentação robusta" },
  5: { label: "Exaustivo", color: "text-purple-400",  desc: "Máximo esforço possível" },
};

const MODES = [
  { id: "modo-estrito",    label: "Corrigir Texto",    color: "bg-blue-800/30 border-blue-600/40 text-blue-300" },
  { id: "modo-redacao",    label: "Redação Jurídica",  color: "bg-purple-800/30 border-purple-600/40 text-purple-300" },
  { id: "modo-interativo", label: "Verificar Lacunas", color: "bg-yellow-800/30 border-yellow-600/40 text-yellow-300" },
];

const ACTIONS = [
  { id: "resumir",     label: "Resumir" },
  { id: "revisar",     label: "Revisar" },
  { id: "refinar",     label: "Refinar" },
  { id: "simplificar", label: "Linguagem Simples" },
  { id: "minuta",      label: "Gerar Minuta" },
  { id: "analisar",    label: "Analisar" },
];

const AUTO_DETECT: [string, string][] = [
  ["gsk_",   "Groq"],
  ["sk-or-", "OpenRouter"],
  ["pplx-",  "Perplexity"],
  ["AIza",   "Google Gemini"],
  ["xai-",   "xAI/Grok"],
  ["sk-ant", "Anthropic"],
  ["sk-",    "OpenAI"],
];

function detectProviderName(key: string): string | null {
  const k = (key || "").trim();
  for (const [prefix, name] of AUTO_DETECT) {
    if (k.startsWith(prefix)) return name;
  }
  return null;
}

// ─── Chamadas diretas à IA (sem proxy Replit) ─────────────────────────────
const AUTO_DETECT_FULL: Array<[string, string, string]> = [
  ["gsk_",  "https://api.groq.com/openai/v1",                          "llama-3.3-70b-versatile"],
  ["sk-or-","https://openrouter.ai/api/v1",                             "openai/gpt-4o-mini"],
  ["pplx-", "https://api.perplexity.ai",                               "sonar-pro"],
  ["AIza",  "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.0-flash"],
  ["xai-",  "https://api.x.ai/v1",                                     "grok-2-latest"],
  ["sk-ant","https://api.anthropic.com/v1",                             "claude-haiku-4-20250514"],
  ["sk-",   "https://api.openai.com/v1",                               "gpt-4o-mini"],
];

function resolveAIEndpoint(key: string, customUrl: string, customModel: string) {
  const k = key.trim();
  for (const [prefix, url, model] of AUTO_DETECT_FULL) {
    if (k.startsWith(prefix)) {
      return { isAnthropic: prefix === "sk-ant", url: (customUrl || url).replace(/\/$/, ""), model: customModel || model };
    }
  }
  return { isAnthropic: false, url: (customUrl || "https://api.openai.com/v1").replace(/\/$/, ""), model: customModel || "gpt-4o-mini" };
}

function buildLegalPrompt(actionId: string, effort: number, verbosity: "curta" | "longa", customPrompt?: string): string {
  if (customPrompt) return customPrompt;
  const e = effort <= 2 ? "conciso e direto" : effort >= 4 ? "exaustivo e profundo" : "detalhado";
  const v = verbosity === "longa" ? "Use parágrafos bem estruturados e seja abrangente." : "Seja breve e objetivo.";
  const prompts: Record<string, string> = {
    resumir:     `Você é um assistente jurídico especializado. Resuma o texto de forma ${e}, destacando pontos essenciais, fundamentações e conclusões. ${v}`,
    revisar:     `Você é um revisor jurídico. Revise o texto corrigindo erros gramaticais, ortográficos, concordância e pontuação, no padrão formal jurídico brasileiro.${effort >= 4 ? " Melhore também coesão e estrutura argumentativa." : ""} ${v}`,
    refinar:     `Você é um redator jurídico. Refine o texto tornando-o mais claro, preciso e persuasivo, mantendo rigor técnico-jurídico.${effort >= 4 ? " Reescreva completamente se necessário." : ""} ${v}`,
    simplificar: `Você é um comunicador jurídico. Reescreva o texto em linguagem simples e acessível, sem jargões desnecessários, para que um cidadão comum entenda.${effort >= 3 ? " Explique os termos que precisarem aparecer." : ""} ${v}`,
    minuta:      `Você é um advogado especializado. Gere uma minuta jurídica profissional com estrutura adequada (cabeçalho, qualificações, cláusulas, fecho) baseada no texto.${effort >= 4 ? " Inclua cláusulas detalhadas e fundamentação legal." : ""} ${v}`,
    analisar:    `Você é um analista jurídico. Analise o texto de forma ${e}, identificando: pontos fortes/fracos, fundamentos legais, riscos, lacunas e oportunidades. ${v}`,
  };
  return prompts[actionId] || `Você é um assistente jurídico especializado. Processe o seguinte texto com foco em: ${actionId}. ${v}`;
}

async function callAIStreaming(
  apiKey: string, apiUrl: string, apiModel: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal,
  onChunk: (full: string) => void,
  onDone: (full: string) => void,
): Promise<void> {
  const key = apiKey.trim();

  // Sem chave → fallback para servidor gratuito (igual ao Campo Livre)
  if (!key) {
    const sysMsg = messages.find(m => m.role === "system")?.content || "";
    const chatMsgs = messages.filter(m => m.role !== "system");
    const resp = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: sysMsg, messages: chatMsgs }),
      signal,
    });
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || `Servidor indisponível (${resp.status}). Configure uma chave em ⚙️ para usar.`);
    }
    const data = await resp.json();
    const content = data.content || "";
    onChunk(content); onDone(content);
    return;
  }

  const prov = resolveAIEndpoint(key, apiUrl, apiModel);

  if (prov.isAnthropic) {
    const sys = messages.find(m => m.role === "system")?.content || "";
    const chat = messages.filter(m => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: prov.model, max_tokens: 64000, system: sys, messages: chat, temperature: 0.5 }),
      signal,
    });
    if (!res.ok) { const t = await res.text(); let m = t.slice(0, 300); try { m = JSON.parse(t).error?.message || m; } catch {} throw new Error(`Anthropic ${res.status}: ${m}`); }
    const d: any = await res.json();
    const text = d.content?.[0]?.text || "";
    onChunk(text); onDone(text);
    return;
  }

  const res = await fetch(`${prov.url}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://sk-editor.app", "X-Title": "SK Editor" },
    body: JSON.stringify({ model: prov.model, messages, stream: true, max_tokens: 32768, temperature: 0.5 }),
    signal,
  });
  if (!res.ok) { const t = await res.text(); let m = t.slice(0, 300); try { m = JSON.parse(t).error?.message || m; } catch {} throw new Error(`${res.status}: ${m}`); }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Sem resposta do servidor.");
  const dec = new TextDecoder();
  let buf = "", full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const d = line.slice(6).trim();
      if (d === "[DONE]") continue;
      try { const chunk = JSON.parse(d).choices?.[0]?.delta?.content || ""; if (chunk) { full += chunk; onChunk(full); } } catch {}
    }
  }
  onDone(full);
}

const CATEGORIAS_SUGERIDAS = [
  "STF", "STJ", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6",
  "TRT", "TJSP", "TJRJ", "TJMG", "TJRS", "Súmula", "Doutrina",
];

// ─── LegalText renderer ──────────────────────────────────────────────────────
function LegalText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: "13px", lineHeight: "1.9", color: "#e5e7eb" }}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const lines = trimmed.split("\n");
        const isSingleLine = lines.length === 1;
        const isTitle = isSingleLine && trimmed === trimmed.toUpperCase() && trimmed.length > 2 && /[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ]/.test(trimmed) && !/^\d+\./.test(trimmed);
        const isListItem = /^\d+[.\)]\s/.test(trimmed) || /^[a-z]\)/.test(trimmed) || /^[-–]\s/.test(trimmed);
        const isQuote = (trimmed.startsWith('"') || trimmed.startsWith('\u201c')) && trimmed.length > 60;
        const renderLines = (arr: string[]) => arr.map((l, j) => j === 0 ? l : <span key={j}><br />{l}</span>);
        if (isTitle)    return <p key={i} style={{ textAlign: "justify", fontWeight: "bold", margin: "4px 0 0", textIndent: "0" }}>{trimmed}</p>;
        if (isListItem) return <p key={i} style={{ textAlign: "justify", margin: "0", paddingLeft: "1cm", textIndent: "0" }}>{renderLines(lines)}</p>;
        if (isQuote)    return <p key={i} style={{ textAlign: "justify", margin: "0", paddingLeft: "4cm", fontSize: "12px" }}>{renderLines(lines)}</p>;
        return <p key={i} style={{ textIndent: "4cm", textAlign: "justify", margin: "0" }}>{renderLines(lines)}</p>;
      })}
    </div>
  );
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────
type Tab = "processar" | "ementas" | "historico" | "acoes";

interface Props { onBack: () => void; }

export default function AssistenteJuridico({ onBack }: Props) {
  // ─── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("processar");

  // ─── Chave de API ─────────────────────────────────────────────────────────
  const [apiKey,     setApiKey]     = useState(() => localStorage.getItem("aj_api_key") || localStorage.getItem("sk_global_key") || "");
  const [apiUrl,     setApiUrl]     = useState(() => localStorage.getItem("aj_api_url")   || "");
  const [apiModel,   setApiModel]   = useState(() => localStorage.getItem("aj_api_model") || "");
  const [showKey,    setShowKey]    = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSavedKeys, setShowSavedKeys] = useState(false);
  const [keyLabel,   setKeyLabel]   = useState("");
  const [savedKeys,  setSavedKeys]  = useState<SavedKey[]>(() => loadLS("aj_saved_keys", []));
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing,    setTesting]    = useState(false);

  // ─── Esforço + Verbosidade ────────────────────────────────────────────────
  const [effortLevel, setEffortLevel] = useState<number>(() => loadLS("aj_effort", 3));
  const [verbosity,   setVerbosity]   = useState<"curta" | "longa">(() => loadLS("aj_verbosity", "longa"));

  // ─── Estado principal ─────────────────────────────────────────────────────
  const [inputText, setInputText] = useState("");
  const [jurisText, setJurisText] = useState("");
  const [showJuris, setShowJuris] = useState(false);
  const [result,    setResult]    = useState("");
  const [streaming, setStreaming] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode,setActiveMode]= useState<string | null>(null);
  const [demoMode,  setDemoMode]  = useState(false);
  const [ttsOn,          setTtsOn]          = useState(() => loadTTSConfig().enabled);
  const [ttsConfig,      setTtsConfig]      = useState<TTSConfig>(() => loadTTSConfig());
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceList,      setVoiceList]      = useState<SpeechSynthesisVoice[]>([]);
  const [isListening,    setIsListening]    = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [importing, setImporting] = useState(false);

  // ─── Chat de refinamento ──────────────────────────────────────────────────
  const [chatInput,   setChatInput]   = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat,    setShowChat]    = useState(false);

  // ─── Ementas ──────────────────────────────────────────────────────────────
  const [ementas,          setEmentas]          = useState<Ementa[]>(() => loadLS("aj_ementas", []));
  const [selectedEmentas,  setSelectedEmentas]  = useState<Set<string>>(new Set());
  const [showEmentaForm,   setShowEmentaForm]   = useState(false);
  const [editingEmenta,    setEditingEmenta]    = useState<Ementa | null>(null);
  const [eTitulo,          setETitulo]          = useState("");
  const [eCategoria,       setECategoria]       = useState("");
  const [eTexto,           setETexto]           = useState("");
  const [ementaSearch,     setEmentaSearch]     = useState("");
  const [ementaFilterCat,  setEmentaFilterCat]  = useState<string | null>(null);

  // ─── Histórico ────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadLS("aj_history", []));

  // ─── Ações customizadas ───────────────────────────────────────────────────
  const [customActions,     setCustomActions]     = useState<CustomAction[]>(() => loadLS("aj_custom_actions", []));
  const [showCustomForm,    setShowCustomForm]    = useState(false);
  const [editingCustom,     setEditingCustom]     = useState<CustomAction | null>(null);
  const [caLabel,           setCaLabel]           = useState("");
  const [caDesc,            setCaDesc]            = useState("");
  const [caPrompt,          setCaPrompt]          = useState("");

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const abortRef       = useRef<AbortController | null>(null);
  const chatAbortRef   = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const audioInputRef  = useRef<HTMLInputElement>(null);
  const chatEndRef     = useRef<HTMLDivElement>(null);
  const resultRef      = useRef<HTMLDivElement>(null);

  // ─── Persistência ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (apiKey)   localStorage.setItem("aj_api_key",   apiKey); else localStorage.removeItem("aj_api_key");
    if (apiUrl)   localStorage.setItem("aj_api_url",   apiUrl); else localStorage.removeItem("aj_api_url");
    if (apiModel) localStorage.setItem("aj_api_model", apiModel); else localStorage.removeItem("aj_api_model");
  }, [apiKey, apiUrl, apiModel]);

  useEffect(() => { saveLS("aj_saved_keys",     savedKeys);     }, [savedKeys]);
  useEffect(() => { saveLS("aj_effort",         effortLevel);   }, [effortLevel]);
  useEffect(() => { saveLS("aj_verbosity",      verbosity);     }, [verbosity]);
  useEffect(() => { saveLS("aj_ementas",        ementas);       }, [ementas]);
  useEffect(() => { saveLS("aj_history",        history);       }, [history]);
  useEffect(() => { saveLS("aj_custom_actions", customActions); }, [customActions]);

  useEffect(() => {
    if (result || streaming) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result, streaming]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, chatLoading]);
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ─── Vozes TTS ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      if (voices.length > 0) setVoiceList(voices);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const applyTTSConfig = (patch: Partial<TTSConfig>) => {
    setTtsConfig(prev => {
      const next = { ...prev, ...patch };
      saveTTSConfig(next);
      return next;
    });
  };

  // ─── Auto-detecção de chave (igual ao Campo Livre) ────────────────────────
  useEffect(() => {
    if (!apiKey) return;
    const clean = apiKey.trim();
    const prov = resolveAIEndpoint(clean, "", "");
    if (prov.url) setApiUrl(prov.url);
    if (prov.model) setApiModel(prov.model);
  }, [apiKey]);

  // ─── Helpers de chave ─────────────────────────────────────────────────────
  const providerName = detectProviderName(apiKey);
  const hasCustomKey = Boolean(apiKey.trim());

  const saveCurrentKey = () => {
    if (!apiKey.trim() || savedKeys.some(s => s.key === apiKey.trim())) return;
    const prov = detectProviderName(apiKey) || "Custom";
    const lbl  = keyLabel.trim() || prov;
    setSavedKeys(prev => [...prev, { id: Date.now().toString(), label: lbl, key: apiKey.trim(), url: apiUrl, model: apiModel, provider: prov }]);
    setKeyLabel("");
  };

  const loadKey = (sk: SavedKey) => {
    setApiKey(sk.key); setApiUrl(sk.url); setApiModel(sk.model);
    setShowSavedKeys(false); setTestResult(null);
  };

  const testarChave = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) { setTestResult({ ok: false, msg: "❌ Insira uma chave primeiro." }); return; }
    setTesting(true); setTestResult(null);
    try {
      await callAIStreaming(
        cleanKey, apiUrl, apiModel,
        [{ role: "system", content: "Responda apenas 'OK'." }, { role: "user", content: "OK" }],
        new AbortController().signal,
        () => {}, () => {},
      );
      setTestResult({ ok: true, msg: `✅ Chave válida! Provedor: ${detectProviderName(cleanKey) || "Custom"}` });
    } catch (e: any) {
      setTestResult({ ok: false, msg: `❌ ${e.message.slice(0, 120)}` });
    } finally { setTesting(false); }
  };

  // ─── Streaming helper ─────────────────────────────────────────────────────
  const streamResponse = useCallback(async (
    url: string, body: object, signal: AbortSignal,
    onChunk: (full: string) => void, onDone: (full: string) => void,
  ) => {
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.message || `Erro ${resp.status}`); }
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("Sem resposta do servidor.");
    const dec = new TextDecoder(); let buf = ""; let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.mode === "demo")   setDemoMode(true);
          if (ev.mode === "custom") setDemoMode(false);
          if (ev.content) { full += ev.content; onChunk(full); }
          if (ev.error) throw new Error(ev.error);
        } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
      }
    }
    onDone(full);
  }, []);

  // ─── Ação principal ───────────────────────────────────────────────────────
  const runAction = useCallback(async (actionId: string, customPrompt?: string) => {
    const text = inputText.trim();
    if (!text) { alert("Cole ou importe o texto do documento antes de escolher uma ação."); return; }
    if (isLoading) return;

    // Juntar ementas selecionadas
    const selectedEmentaTexts = ementas
      .filter(e => selectedEmentas.has(e.id))
      .map(e => `[${e.titulo} — ${e.categoria}]\n${e.texto}`)
      .join("\n\n");

    const jurisPart = [jurisText.trim(), selectedEmentaTexts].filter(Boolean).join("\n\n");

    setIsLoading(true); setResult(""); setStreaming("");
    setActiveMode(customPrompt ? "custom_" + actionId : actionId);
    setChatHistory([]); setShowChat(false); setDemoMode(false);

    const controller = new AbortController();
    abortRef.current = controller;
    const sysPrompt = buildLegalPrompt(actionId, effortLevel, verbosity, customPrompt || undefined);
    const userContent = [
      jurisPart ? `Jurisprudência e ementas de referência:\n${jurisPart}\n\n---` : "",
      `Texto a processar:\n\n${text}`,
    ].filter(Boolean).join("\n");
    const msgs = [{ role: "system", content: sysPrompt }, { role: "user", content: userContent }];
    try {
      await callAIStreaming(
        apiKey, apiUrl, apiModel, msgs, controller.signal,
        (full) => setStreaming(full),
        (full) => {
          if (full.trim()) {
            setResult(full);
            if (ttsOn) { const clean = cleanForSpeech(full); speak(clean, { ...ttsConfig, enabled: true }); }
            const label = customPrompt
              ? (customActions.find(a => a.id === actionId)?.label || "Ação Custom")
              : (ACTIONS.find(a => a.id === actionId)?.label || MODES.find(m => m.id === actionId)?.label || actionId);
            const entry: HistoryEntry = {
              id: Date.now().toString(), acao: label,
              inputSnippet: text.substring(0, 120), resultado: full,
              timestamp: new Date().toLocaleString("pt-BR"),
            };
            setHistory(prev => [entry, ...prev].slice(0, 15));
          }
        },
      );
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setResult(`❌ Erro: ${err.message}`);
    } finally {
      setIsLoading(false); setStreaming(""); abortRef.current = null;
    }
  }, [inputText, jurisText, selectedEmentas, ementas, isLoading, ttsOn, effortLevel, verbosity, apiKey, apiUrl, apiModel, customActions]);

  // ─── Chat de refinamento ──────────────────────────────────────────────────
  const sendChat = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading || !result) return;
    const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: msg }];
    setChatHistory(newHistory); setChatInput(""); setChatLoading(true);
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const messages = [
      { role: "system",    content: buildLegalPrompt("refinar", effortLevel, verbosity) },
      { role: "user",      content: `O documento gerado foi:\n\n${result}` },
      { role: "assistant", content: "Entendido. Estou pronta para refinar." },
      ...chatHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user",      content: msg },
    ];
    try {
      await callAIStreaming(
        apiKey, apiUrl, apiModel, messages, controller.signal,
        (full) => setChatHistory([...newHistory, { role: "assistant", content: full }]),
        (full) => {
          if (full.length > result.length * 0.5 && !full.toLowerCase().startsWith("para")) setResult(full);
          setChatHistory([...newHistory, { role: "assistant", content: full }]);
        },
      );
    } catch (err: any) {
      if (err.name !== "AbortError") setChatHistory([...newHistory, { role: "assistant", content: `❌ Erro: ${err.message}` }]);
    } finally { setChatLoading(false); chatAbortRef.current = null; }
  }, [chatInput, chatLoading, result, chatHistory, effortLevel, verbosity, apiKey, apiUrl, apiModel]);

  const stop = () => {
    abortRef.current?.abort(); abortRef.current = null;
    chatAbortRef.current?.abort(); chatAbortRef.current = null;
  };

  // ─── Importar arquivo ─────────────────────────────────────────────────────
  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (["pdf", "docx", "doc", "rtf"].includes(ext)) {
      alert(`Para arquivos ${ext.toUpperCase()}: copie o texto e cole no campo acima.\n\nDica: No Word/Google Docs → Arquivo → Baixar como → Texto (.txt) e importe o .txt aqui.`);
      return;
    } else {
      const reader = new FileReader();
      reader.onload = ev => { const t = ev.target?.result as string; setInputText(prev => prev ? prev + "\n\n" + t : t); };
      reader.readAsText(file, "utf-8");
    }
  };

  const onAudioSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const cleanKey = apiKey.trim();
    if (!cleanKey) { alert("Para transcrever áudio, insira uma chave Groq ou OpenAI em ⚙️ Configurações."); return; }
    setImporting(true);
    try {
      const url = cleanKey.startsWith("gsk_") ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("model", cleanKey.startsWith("gsk_") ? "whisper-large-v3" : "whisper-1");
      fd.append("language", "pt"); fd.append("response_format", "text");
      const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${cleanKey}` }, body: fd });
      if (!resp.ok) throw new Error((await resp.text()).substring(0, 200));
      const t = await resp.text();
      setInputText(prev => prev ? prev + "\n\n" + t.trim() : t.trim());
    } catch (err: any) { alert("Erro na transcrição: " + err.message); }
    finally { setImporting(false); }
  };

  // ─── Exportar ─────────────────────────────────────────────────────────────
  const displayText = streaming || result;

  const downloadTxt = () => {
    if (!displayText) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([displayText], { type: "text/plain;charset=utf-8" }));
    a.download = `juridico-${Date.now()}.txt`; a.click();
  };

  const downloadRtf = () => {
    if (!displayText) return;
    const rtf = `{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Times New Roman;}}\n{\\f0\\fs26\n${
      displayText.split(/\n\n+/).map(block => {
        const t = block.trim(); if (!t) return "";
        if (t === t.toUpperCase() && t.length > 2 && /[A-Z]/.test(t) && !/^\d/.test(t))
          return `\\pard\\qj\\b ${t.replace(/[\\{}]/g, "\\$&")}\\b0\\par\\par`;
        if (/^\d+[.\)]\s/.test(t) || /^[-–]\s/.test(t))
          return `\\pard\\qj\\li720 ${t.replace(/[\\{}]/g, "\\$&")}\\par\\par`;
        return `\\pard\\qj\\fi2268 ${t.replace(/[\\{}]/g, "\\$&")}\\par\\par`;
      }).join("\n")
    }\n}}`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rtf], { type: "application/rtf" }));
    a.download = `juridico-${Date.now()}.rtf`; a.click();
  };

  const copyResult = () => {
    if (!displayText) return;
    navigator.clipboard.writeText(displayText); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // ─── Ditado por voz ───────────────────────────────────────────────────────
  const startVoice = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome ou Edge para ditar por voz."); return; }
    const rec = new SR(); rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
    let timer: any = null; let fullText = "";
    const scheduleStop = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { rec.stop(); } catch {}
        if (fullText.trim()) setInputText(prev => prev ? prev.trimEnd() + "\n\n" + fullText.trim() : fullText.trim());
      }, 1800);
    };
    rec.onresult = (e: any) => {
      let f = ""; let itr = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) f += e.results[i][0].transcript; else itr += e.results[i][0].transcript;
      }
      fullText = f || itr; if (fullText) scheduleStop();
    };
    rec.onerror = () => { if (timer) clearTimeout(timer); recognitionRef.current = null; setIsListening(false); };
    rec.onend   = () => { if (timer) clearTimeout(timer); recognitionRef.current = null; setIsListening(false); };
    recognitionRef.current = rec;
    try { rec.start(); setIsListening(true); } catch { setIsListening(false); }
  }, [isListening]);

  // ─── Ementas CRUD ─────────────────────────────────────────────────────────
  const openNewEmenta = () => {
    setEditingEmenta(null); setETitulo(""); setECategoria(""); setETexto(""); setShowEmentaForm(true);
  };
  const openEditEmenta = (em: Ementa) => {
    setEditingEmenta(em); setETitulo(em.titulo); setECategoria(em.categoria); setETexto(em.texto); setShowEmentaForm(true);
  };
  const saveEmenta = () => {
    if (!eTitulo.trim() || !eTexto.trim()) return;
    if (editingEmenta) {
      setEmentas(prev => prev.map(e => e.id === editingEmenta.id ? { ...e, titulo: eTitulo, categoria: eCategoria, texto: eTexto } : e));
    } else {
      setEmentas(prev => [{ id: Date.now().toString(), titulo: eTitulo, categoria: eCategoria, texto: eTexto, criadoEm: new Date().toLocaleString("pt-BR") }, ...prev]);
    }
    setShowEmentaForm(false); setEditingEmenta(null);
  };
  const deleteEmenta = (id: string) => {
    setEmentas(prev => prev.filter(e => e.id !== id));
    setSelectedEmentas(prev => { const n = new Set(prev); n.delete(id); return n; });
  };
  const toggleEmenta = (id: string) => setSelectedEmentas(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredEmentas = ementas.filter(e => {
    const q = ementaSearch.toLowerCase();
    const matchQ = !q || e.titulo.toLowerCase().includes(q) || e.texto.toLowerCase().includes(q) || e.categoria.toLowerCase().includes(q);
    const matchCat = !ementaFilterCat || e.categoria === ementaFilterCat;
    return matchQ && matchCat;
  });

  const ementaCats = [...new Set(ementas.map(e => e.categoria).filter(Boolean))];

  // ─── Custom Actions CRUD ──────────────────────────────────────────────────
  const openNewCustom = () => { setEditingCustom(null); setCaLabel(""); setCaDesc(""); setCaPrompt(""); setShowCustomForm(true); };
  const openEditCustom = (a: CustomAction) => { setEditingCustom(a); setCaLabel(a.label); setCaDesc(a.descricao); setCaPrompt(a.prompt); setShowCustomForm(true); };
  const saveCustom = () => {
    if (!caLabel.trim() || !caPrompt.trim()) return;
    if (editingCustom) {
      setCustomActions(prev => prev.map(a => a.id === editingCustom.id ? { ...a, label: caLabel, descricao: caDesc, prompt: caPrompt } : a));
    } else {
      setCustomActions(prev => [...prev, { id: Date.now().toString(), label: caLabel, descricao: caDesc, prompt: caPrompt }]);
    }
    setShowCustomForm(false); setEditingCustom(null);
  };

  // ─── Effort badge color ───────────────────────────────────────────────────
  const effortInfo = EFFORT_LABELS[effortLevel] || EFFORT_LABELS[3];

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0d0d0d] text-gray-200 overflow-hidden">

      {/* ══ HEADER ══ */}
      <header className="h-11 flex items-center gap-2 px-3 bg-[#141414] border-b border-gray-700/50 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
          <ArrowLeft size={17} />
        </button>
        <Scale size={15} className="text-amber-400 shrink-0" />
        <span className="text-sm font-semibold flex-1 truncate">Assistente Jurídico</span>

        <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
          hasCustomKey ? "bg-gray-800/30 text-green-400 border-green-700/30" : "bg-amber-900/30 text-amber-400 border-amber-700/30"
        }`}>
          {hasCustomKey ? (providerName || "Chave Própria") : "Demo ✨"}
        </span>

        <button
          onClick={() => { setTtsOn(v => { const n = !v; if (!n) { stopSpeaking(); setShowVoicePanel(false); } return n; }); }}
          className={`p-1.5 rounded-lg ${ttsOn ? "text-amber-400 bg-amber-900/20" : "text-gray-600 hover:bg-white/5"}`}
          title={ttsOn ? "Desativar voz" : "Ativar voz"}
        >
          {ttsOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        {ttsOn && (
          <button
            onClick={() => setShowVoicePanel(v => !v)}
            className={`p-1.5 rounded-lg ${showVoicePanel ? "text-amber-300 bg-amber-900/30" : "text-gray-600 hover:bg-white/5 hover:text-amber-400"}`}
            title="Configurar voz (velocidade, tom, escolher)"
          >
            <SlidersHorizontal size={13} />
          </button>
        )}
        <button
          onClick={() => { setShowConfig(v => !v); setShowSavedKeys(false); }}
          className={`p-1.5 rounded-lg ${showConfig ? "bg-white/10 text-gray-200" : "hover:bg-white/5 text-gray-500"}`}
        >
          <Settings size={14} />
        </button>
        <button
          onClick={() => { setShowSavedKeys(v => !v); setShowConfig(false); }}
          className={`p-1.5 rounded-lg relative ${showSavedKeys ? "bg-white/10 text-gray-200" : "hover:bg-white/5 text-gray-500"}`}
        >
          <Key size={14} />
          {savedKeys.length > 0 && <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-amber-600 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">{savedKeys.length}</span>}
        </button>
      </header>

      {/* ══ PAINEL DE VOZ ══ */}
      {showVoicePanel && (
        <div className="border-b border-amber-800/30 bg-[#1a2410] p-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configurações de Voz</span>
            <button onClick={() => setShowVoicePanel(false)} className="p-0.5 rounded text-gray-600 hover:text-gray-400"><X size={12} /></button>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Voz ({voiceList.length} disponíveis)</label>
            {voiceList.length === 0 ? (
              <p className="text-[11px] text-gray-600 italic">Sem vozes disponíveis neste navegador.</p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-700/40 bg-[#0d0d0d] p-1">
                <button onClick={() => applyTTSConfig({ voiceName: "" })}
                  className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${ttsConfig.voiceName === "" ? "bg-amber-900/40 text-amber-300 border border-amber-700/40" : "text-gray-400 hover:bg-white/5"}`}>
                  <span className="font-medium">Automático</span>
                  <span className="text-[10px] text-gray-600 ml-1">(melhor voz pt-BR)</span>
                </button>
                {[...voiceList.filter(v => v.lang.toLowerCase().startsWith("pt")), ...voiceList.filter(v => !v.lang.toLowerCase().startsWith("pt"))].map(voice => (
                  <button key={voice.name} onClick={() => applyTTSConfig({ voiceName: voice.name })}
                    className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${ttsConfig.voiceName === voice.name ? "bg-amber-900/40 text-amber-300 border border-amber-700/40" : "text-gray-400 hover:bg-white/5"}`}>
                    <span className="font-medium truncate block">{voice.name}</span>
                    <span className="text-[10px] text-gray-600">{voice.lang} {voice.localService ? "· local" : "· online"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500">Velocidade</label>
              <span className="text-[10px] text-amber-400 font-mono">{ttsConfig.rate.toFixed(2)}×</span>
            </div>
            <input type="range" min="0.5" max="2.0" step="0.05" value={ttsConfig.rate}
              onChange={e => applyTTSConfig({ rate: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 h-1.5" />
            <div className="flex justify-between text-[9px] text-gray-700 mt-0.5"><span>Lenta</span><span>Normal</span><span>Rápida</span></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500">Tom de voz</label>
              <span className="text-[10px] text-amber-400 font-mono">{ttsConfig.pitch.toFixed(2)}</span>
            </div>
            <input type="range" min="0.5" max="1.8" step="0.05" value={ttsConfig.pitch}
              onChange={e => applyTTSConfig({ pitch: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 h-1.5" />
            <div className="flex justify-between text-[9px] text-gray-700 mt-0.5"><span>Grave</span><span>Natural</span><span>Agudo</span></div>
          </div>
          <button
            onClick={() => {
              stopSpeaking();
              const u = new SpeechSynthesisUtterance("Olá! Sou a Jasmim, sua assistente jurídica. Como posso ajudar?");
              u.lang = ttsConfig.lang; u.rate = ttsConfig.rate; u.pitch = ttsConfig.pitch;
              const selectedVoice = voiceList.find(v => v.name === ttsConfig.voiceName);
              if (selectedVoice) u.voice = selectedVoice;
              window.speechSynthesis?.speak(u);
            }}
            className="w-full py-1.5 text-[11px] bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-lg hover:bg-amber-900/50 transition-colors"
          >
            ▶ Testar voz agora
          </button>
        </div>
      )}

      {/* ══ PAINEL CONFIGURAÇÃO ══ */}
      {showConfig && (
        <div className="border-b border-gray-700/40 bg-[#141414] p-3 space-y-3 shrink-0">

          {/* Esforço 1-5 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nível de Esforço</span>
              <span className={`text-[11px] font-semibold ${effortInfo.color}`}>
                {effortLevel} — {effortInfo.label}
              </span>
            </div>
            <input
              type="range" min={1} max={5} value={effortLevel}
              onChange={e => setEffortLevel(Number(e.target.value))}
              className="w-full accent-amber-500 h-1.5"
            />
            <div className="flex justify-between text-[9px] text-gray-600 mt-0.5 px-0.5">
              <span>Rápido</span><span>Básico</span><span>Detalhado</span><span>Profundo</span><span>Exaustivo</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">{effortInfo.desc}</p>
          </div>

          {/* Verbosidade */}
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">Extensão da Resposta</span>
            <div className="flex gap-2">
              <button
                onClick={() => setVerbosity("curta")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  verbosity === "curta" ? "bg-blue-700/30 border-blue-600/50 text-blue-300" : "border-gray-700/30 text-gray-600 hover:text-gray-400"
                }`}
              >
                <AlignLeft size={12} /> Concisa
              </button>
              <button
                onClick={() => setVerbosity("longa")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                  verbosity === "longa" ? "bg-amber-700/30 border-amber-600/50 text-amber-300" : "border-gray-700/30 text-gray-600 hover:text-gray-400"
                }`}
              >
                <AlignJustify size={12} /> Completa
              </button>
            </div>
          </div>

          {/* Chave de API — simplificada, igual ao Campo Livre */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chave de API</span>
              {hasCustomKey
                ? <span className="text-[10px] text-green-400 font-medium">✓ {providerName || "Custom"} detectado</span>
                : <span className="text-[10px] text-amber-400">Gratuita ✨ (ou cole sua chave)</span>
              }
            </div>
            <div className="flex gap-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value.trim()); setTestResult(null); }}
                placeholder="Cole aqui: gsk_..., sk-..., AIza..., xai-..."
                className="flex-1 h-9 px-3 text-[12px] font-mono bg-[#0d0d0d] border border-gray-700/50 rounded-lg text-gray-200 outline-none focus:border-amber-600/60"
              />
              <button onClick={() => setShowKey(v => !v)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500">
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {hasCustomKey && apiModel && (
              <p className="text-[10px] text-gray-600 mt-1 px-1">
                Modelo detectado: <span className="text-amber-400 font-mono">{apiModel}</span>
              </p>
            )}
            {apiKey && (
              <div className="flex gap-1 mt-1.5 items-center">
                <button onClick={testarChave} disabled={testing}
                  className="flex items-center gap-1 px-2 h-7 text-[11px] bg-blue-700/30 border border-blue-600/40 text-blue-300 rounded hover:bg-blue-700/50 disabled:opacity-50">
                  {testing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Testar
                </button>
                <button onClick={saveCurrentKey}
                  className="flex items-center gap-1 px-2 h-7 text-[11px] bg-amber-700/30 border border-amber-600/40 text-amber-400 rounded hover:bg-amber-700/50">
                  <Save size={11} /> Salvar
                </button>
                <button onClick={() => { setApiKey(""); setApiUrl(""); setApiModel(""); setTestResult(null); }}
                  className="flex items-center gap-1 px-2 h-7 text-[11px] text-red-400 border border-red-700/30 rounded hover:bg-red-900/20">
                  <X size={11} /> Remover
                </button>
              </div>
            )}
            {testResult && (
              <p className={`text-[10px] px-2 py-1 rounded mt-1 ${testResult.ok ? "text-green-400 bg-green-900/20" : "text-red-400 bg-red-900/20"}`}>
                {testResult.msg}
              </p>
            )}
            {!apiKey && <p className="text-[10px] text-gray-600 mt-1">💡 Sem chave: usa IA do servidor (Demo). Com Groq (gsk_...) ou OpenAI (sk-...): ativa transcrição de áudio.</p>}
          </div>
        </div>
      )}

      {/* ══ CHAVES SALVAS ══ */}
      {showSavedKeys && (
        <div className="border-b border-gray-700/40 bg-[#141414] p-3 space-y-1.5 shrink-0 max-h-44 overflow-y-auto">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chaves Salvas ({savedKeys.length})</span>
          {savedKeys.length === 0
            ? <p className="text-[11px] text-gray-600 py-2 text-center">Nenhuma chave salva.</p>
            : savedKeys.map(sk => (
              <div key={sk.id} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] ${sk.key === apiKey ? "bg-amber-900/20 border-amber-700/40" : "bg-[#0d0d0d] border-gray-700/30"}`}>
                <button onClick={() => loadKey(sk)} className="flex-1 text-left min-w-0">
                  <div className="font-medium text-gray-200 truncate">{sk.label}</div>
                  <div className="text-[10px] text-gray-500">{sk.provider} · {sk.key.substring(0, 8)}...{sk.key.slice(-4)}</div>
                </button>
                {sk.key === apiKey && <span className="text-[9px] text-amber-400 font-bold shrink-0">ATIVA</span>}
                <button onClick={() => setSavedKeys(prev => prev.filter(k => k.id !== sk.id))}
                  className="p-1 rounded hover:bg-red-900/20 text-gray-600 hover:text-red-400 shrink-0"><X size={11} /></button>
              </div>
            ))
          }
        </div>
      )}

      {/* ══ INPUTS OCULTOS ══ */}
      <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx,.doc,.rtf" className="hidden" onChange={onFileSelected} />
      <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.mp4,.wav,.m4a,.ogg,.webm,.flac" className="hidden" onChange={onAudioSelected} />

      {/* ══ ABAS ══ */}
      <div className="flex border-b border-gray-700/40 bg-[#141414] shrink-0">
        {([
          { id: "processar", label: "Processar",   icon: Play },
          { id: "ementas",   label: `Ementas${ementas.length ? ` (${ementas.length})` : ""}`,    icon: Library },
          { id: "historico", label: `Histórico${history.length ? ` (${history.length})` : ""}`, icon: Clock },
          { id: "acoes",     label: `Ações${customActions.length ? ` (${customActions.length})` : ""}`, icon: Wand2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex items-center gap-1 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
              tab === id ? "border-amber-500 text-amber-400" : "border-transparent text-gray-600 hover:text-gray-400"
            }`}
          >
            <Icon size={11} />
            <span className="truncate max-w-[80px]">{label}</span>
          </button>
        ))}
      </div>

      {/* ══ CONTEÚDO DAS ABAS ══ */}
      <div className="flex-1 overflow-y-auto">

        {/* ─────── ABA: PROCESSAR ─────── */}
        {tab === "processar" && (
          <>
            {/* Barra de esforço + verbosidade */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-700/20 bg-[#1a2411]">
              <span className={`text-[10px] font-semibold ${effortInfo.color}`}>
                <Zap size={10} className="inline mr-0.5" />
                {effortInfo.label}
              </span>
              <div className="flex-1">
                <input type="range" min={1} max={5} value={effortLevel} onChange={e => setEffortLevel(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1" />
              </div>
              <button
                onClick={() => setVerbosity(v => v === "curta" ? "longa" : "curta")}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                  verbosity === "curta"
                    ? "bg-blue-900/20 border-blue-700/40 text-blue-400"
                    : "bg-amber-900/20 border-amber-700/40 text-amber-400"
                }`}
                title={verbosity === "curta" ? "Resposta concisa — clique para completa" : "Resposta completa — clique para concisa"}
              >
                {verbosity === "curta" ? <AlignLeft size={10} className="inline mr-0.5" /> : <AlignJustify size={10} className="inline mr-0.5" />}
                {verbosity === "curta" ? "Concisa" : "Completa"}
              </button>
              {selectedEmentas.size > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-800/30 text-green-400 border border-green-700/30 rounded-full shrink-0">
                  {selectedEmentas.size} ementa{selectedEmentas.size > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Entrada de texto */}
            <div className="p-3 border-b border-gray-700/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium">Texto do processo:</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  <button onClick={() => fileInputRef.current?.click()} disabled={importing}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-gray-700/40 text-gray-500 hover:text-amber-400 hover:border-amber-700/40 disabled:opacity-40">
                    {importing ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                    {importing ? "Extraindo..." : "PDF/DOCX"}
                  </button>
                  <button onClick={() => audioInputRef.current?.click()} disabled={importing}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-gray-700/40 text-gray-500 hover:text-amber-400 hover:border-amber-700/40 disabled:opacity-40">
                    {importing ? <Loader2 size={11} className="animate-spin" /> : <FileAudio size={11} />}
                    Áudio
                  </button>
                  <button onClick={startVoice}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all ${isListening ? "bg-red-600 text-white animate-pulse" : "border border-gray-700/40 text-gray-500 hover:text-amber-400 hover:border-amber-700/40"}`}>
                    {isListening ? <><MicOff size={11} /> Parar</> : <><Mic size={11} /> Ditar</>}
                  </button>
                  <button onClick={() => setInputText("")} disabled={!inputText}
                    className="px-2 py-1 rounded-lg text-[11px] border border-gray-700/40 text-gray-600 hover:text-red-400 disabled:opacity-30">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <textarea
                value={inputText} onChange={e => setInputText(e.target.value)}
                placeholder="Cole o texto, importe PDF/DOCX/TXT, ou use áudio/voz..."
                className="w-full h-28 resize-none bg-[#141414] border border-gray-700/40 rounded-xl px-3 py-2.5 text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-amber-600/40 leading-relaxed"
              />
            </div>

            {/* Jurisprudência */}
            <div className="border-b border-gray-700/30">
              <button onClick={() => setShowJuris(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-gray-500 hover:text-amber-400 transition-colors">
                <div className="flex items-center gap-2">
                  <BookOpen size={12} className="text-amber-600" />
                  <span className="font-medium">Jurisprudência manual (opcional)</span>
                  {jurisText && <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-500 rounded-full border border-amber-700/30">{jurisText.split("\n").filter(l => l.trim()).length}L</span>}
                  {selectedEmentas.size > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-gray-800/30 text-green-500 rounded-full border border-green-700/30">{selectedEmentas.size} ementa{selectedEmentas.size > 1 ? "s" : ""} selecionada{selectedEmentas.size > 1 ? "s" : ""}</span>}
                </div>
                {showJuris ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showJuris && (
                <div className="px-3 pb-3 space-y-1.5">
                  <p className="text-[10px] text-gray-600">Cole ementas ou precedentes. A Jamile vai citá-los literalmente no documento.</p>
                  <textarea value={jurisText} onChange={e => setJurisText(e.target.value)}
                    placeholder="Cole as ementas ou precedentes aqui..."
                    className="w-full h-24 resize-none bg-[#141414] border border-amber-800/30 rounded-xl px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-amber-600/40 leading-relaxed" />
                  {jurisText && <button onClick={() => setJurisText("")} className="text-[10px] text-gray-600 hover:text-red-400 flex items-center gap-1"><Trash2 size={10} /> Limpar</button>}
                </div>
              )}
            </div>

            {/* Modos rápidos */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Modos:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => runAction(m.id)} disabled={isLoading}
                    className={`flex items-center justify-center py-2.5 px-2 rounded-xl border text-[11px] font-medium transition-all active:scale-95 disabled:opacity-40 ${m.color}`}>
                    {isLoading && activeMode === m.id ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="px-3 pb-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Ações:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ACTIONS.map(a => (
                  <button key={a.id} onClick={() => runAction(a.id)} disabled={isLoading}
                    className={`py-2 px-3 rounded-xl border text-[11px] font-medium transition-all active:scale-95 disabled:opacity-40 ${
                      activeMode === a.id && (isLoading || result)
                        ? "bg-amber-800/30 border-amber-600/50 text-amber-300"
                        : "bg-[#141414] border-gray-700/40 text-gray-400 hover:border-amber-700/40 hover:text-amber-400"
                    }`}>
                    {isLoading && activeMode === a.id ? <Loader2 size={11} className="animate-spin inline mr-1" /> : null}
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ações customizadas (se houver) */}
            {customActions.length > 0 && (
              <div className="px-3 pb-3">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Ações Personalizadas:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {customActions.map(a => (
                    <button key={a.id} onClick={() => runAction("custom", a.prompt)} disabled={isLoading}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-medium transition-all active:scale-95 disabled:opacity-40 ${
                        activeMode === "custom_custom" && (isLoading || result)
                          ? "bg-purple-800/30 border-purple-600/50 text-purple-300"
                          : "bg-[#252f1a] border-purple-700/30 text-purple-400 hover:border-purple-600/50 hover:text-purple-300"
                      }`}
                      title={a.descricao}
                    >
                      <Wand2 size={11} className="inline mr-1" />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stop */}
            {(isLoading || chatLoading) && (
              <div className="px-3 pb-2">
                <button onClick={stop} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-900/20 border border-red-700/30 text-red-400 text-[11px] hover:bg-red-900/30 transition-colors">
                  <StopCircle size={13} /> Parar
                </button>
              </div>
            )}

            {/* Resultado */}
            {displayText && (
              <div className="px-3 pb-4" ref={resultRef}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Resultado</span>
                    {demoMode && <span className="text-[9px] px-1.5 py-0.5 bg-amber-900/20 border border-amber-700/30 text-amber-500 rounded-full">Demo</span>}
                    {isLoading && <Loader2 size={11} className="animate-spin text-amber-500" />}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={copyResult} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border ${copied ? "border-green-600/40 text-green-400 bg-green-900/20" : "border-gray-700/40 text-gray-500 hover:text-amber-400 hover:border-amber-700/40"}`}>
                      {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copiado!" : "Copiar"}
                    </button>
                    <button onClick={downloadTxt} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-gray-700/40 text-gray-500 hover:text-amber-400 hover:border-amber-700/40">
                      <Download size={11} /> TXT
                    </button>
                    <button onClick={downloadRtf} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border border-gray-700/40 text-gray-500 hover:text-amber-400 hover:border-amber-700/40">
                      <Download size={11} /> RTF
                    </button>
                  </div>
                </div>

                <div className="bg-[#141414] border border-gray-700/30 rounded-xl p-4 overflow-x-auto">
                  <LegalText text={displayText} />
                </div>

                {/* Chat de refinamento */}
                <div className="mt-3">
                  <button onClick={() => setShowChat(v => !v)} disabled={!result}
                    className="flex items-center gap-2 text-[11px] text-gray-500 hover:text-amber-400 transition-colors disabled:opacity-30">
                    <MessageSquare size={13} />
                    {showChat ? "Fechar" : "Refinar com Jamile"}
                    {chatHistory.length > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-amber-900/30 text-amber-500 rounded-full">{Math.floor(chatHistory.length / 2)} ajuste{chatHistory.length !== 2 ? "s" : ""}</span>}
                  </button>

                  {showChat && (
                    <div className="mt-2 space-y-2">
                      {chatHistory.length > 0 && (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {chatHistory.map((msg, i) => (
                            <div key={i} className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${msg.role === "user" ? "bg-amber-900/20 border border-amber-800/30 text-amber-200 ml-4" : "bg-[#141414] border border-gray-700/30 text-gray-300 mr-4"}`}>
                              <div className="text-[10px] font-bold mb-1 opacity-60">{msg.role === "user" ? "Você" : "Jamile"}</div>
                              {msg.content.length > 300 ? (
                                <details><summary className="cursor-pointer text-amber-400 text-[11px]">Ver resposta...</summary><div className="mt-2 whitespace-pre-wrap">{msg.content}</div></details>
                              ) : <div className="whitespace-pre-wrap">{msg.content}</div>}
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="bg-[#141414] border border-gray-700/30 rounded-xl px-3 py-2 flex items-center gap-2 mr-4">
                              <Loader2 size={12} className="animate-spin text-amber-500" />
                              <span className="text-[11px] text-gray-500">Jamile está respondendo...</span>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                          placeholder="Ex: Adicione mais fundamentação... / Inclua tutela de urgência... / Reformule o início..."
                          rows={2}
                          className="flex-1 resize-none bg-[#141414] border border-amber-800/30 rounded-xl px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-amber-600/50 leading-relaxed" />
                        <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                          className="self-end px-3 py-2 bg-amber-700/40 border border-amber-600/40 text-amber-300 rounded-xl hover:bg-amber-700/60 disabled:opacity-30 transition-colors">
                          {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="h-6" />
          </>
        )}

        {/* ─────── ABA: EMENTAS ─────── */}
        {tab === "ementas" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><Library size={15} /> Biblioteca de Ementas</h2>
                <p className="text-[10px] text-gray-600 mt-0.5">Salve jurisprudência para incluir automaticamente nos documentos.</p>
              </div>
              <button onClick={openNewEmenta}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-700/30 border border-amber-600/40 text-amber-400 text-[12px] hover:bg-amber-700/50 transition-colors">
                <Plus size={13} /> Nova Ementa
              </button>
            </div>

            {/* Formulário de ementa */}
            {showEmentaForm && (
              <div className="bg-[#141414] border border-amber-700/30 rounded-xl p-3 space-y-2">
                <h3 className="text-[12px] font-semibold text-amber-400">{editingEmenta ? "Editar Ementa" : "Nova Ementa"}</h3>
                <input value={eTitulo} onChange={e => setETitulo(e.target.value)}
                  placeholder="Título (ex: STJ — Responsabilidade civil médica)"
                  className="w-full h-8 px-2 text-[12px] bg-[#0d0d0d] border border-gray-700/40 rounded-lg text-gray-200 outline-none focus:border-amber-600/50" />
                <div className="flex gap-2">
                  <input value={eCategoria} onChange={e => setECategoria(e.target.value)}
                    placeholder="Categoria (ex: STJ, STF, TRF1...)"
                    list="cats-datalist"
                    className="flex-1 h-8 px-2 text-[12px] bg-[#0d0d0d] border border-gray-700/40 rounded-lg text-gray-200 outline-none focus:border-amber-600/50" />
                  <datalist id="cats-datalist">
                    {CATEGORIAS_SUGERIDAS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <textarea value={eTexto} onChange={e => setETexto(e.target.value)}
                  placeholder="Cole a ementa completa aqui..."
                  rows={5}
                  className="w-full resize-none bg-[#0d0d0d] border border-gray-700/40 rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-amber-600/50 leading-relaxed" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowEmentaForm(false); setEditingEmenta(null); }}
                    className="px-3 py-1.5 text-[12px] border border-gray-700/40 text-gray-500 rounded-lg hover:text-gray-300">
                    Cancelar
                  </button>
                  <button onClick={saveEmenta} disabled={!eTitulo.trim() || !eTexto.trim()}
                    className="px-3 py-1.5 text-[12px] bg-amber-700/40 border border-amber-600/50 text-amber-300 rounded-lg hover:bg-amber-700/60 disabled:opacity-40">
                    <Save size={12} className="inline mr-1" /> Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Busca + filtro */}
            {ementas.length > 0 && (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={12} className="absolute left-2.5 top-2 text-gray-600" />
                  <input value={ementaSearch} onChange={e => setEmentaSearch(e.target.value)}
                    placeholder="Buscar ementas..."
                    className="w-full h-7 pl-7 pr-2 text-[11px] bg-[#141414] border border-gray-700/40 rounded-lg text-gray-300 outline-none focus:border-amber-600/40" />
                </div>
                {ementaCats.length > 0 && (
                  <select value={ementaFilterCat || ""} onChange={e => setEmentaFilterCat(e.target.value || null)}
                    className="h-7 px-2 text-[11px] bg-[#141414] border border-gray-700/40 rounded-lg text-gray-400 outline-none">
                    <option value="">Todos</option>
                    {ementaCats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Lista de ementas */}
            {filteredEmentas.length === 0
              ? <div className="text-center py-8 text-gray-600 text-[12px]">
                  {ementas.length === 0 ? "Nenhuma ementa salva. Clique em \"Nova Ementa\" para começar." : "Nenhum resultado para a busca."}
                </div>
              : filteredEmentas.map(em => (
                <div key={em.id} className={`rounded-xl border p-3 space-y-2 transition-all ${selectedEmentas.has(em.id) ? "border-green-600/50 bg-green-900/10" : "border-gray-700/40 bg-[#141414]"}`}>
                  <div className="flex items-start gap-2">
                    <button onClick={() => toggleEmenta(em.id)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        selectedEmentas.has(em.id) ? "bg-green-600 border-green-500" : "border-gray-600 hover:border-green-500"
                      }`}>
                      {selectedEmentas.has(em.id) && <Check size={10} className="text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-gray-200 truncate">{em.titulo}</span>
                        {em.categoria && <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 text-blue-400 border border-blue-700/30 rounded-full shrink-0">{em.categoria}</span>}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{em.texto}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEditEmenta(em)} className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-amber-400"><Pencil size={12} /></button>
                      <button onClick={() => deleteEmenta(em.id)} className="p-1 rounded hover:bg-red-900/20 text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))
            }

            {selectedEmentas.size > 0 && (
              <div className="sticky bottom-0 bg-[#0d0d0d] border-t border-green-700/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-green-400">{selectedEmentas.size} ementa{selectedEmentas.size > 1 ? "s" : ""} selecionada{selectedEmentas.size > 1 ? "s" : ""} — serão incluídas no próximo processamento</span>
                  <button onClick={() => setSelectedEmentas(new Set())}
                    className="text-[11px] text-gray-500 hover:text-red-400 flex items-center gap-1"><X size={11} /> Limpar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────── ABA: HISTÓRICO ─────── */}
        {tab === "historico" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><Clock size={15} /> Histórico</h2>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="text-[11px] text-gray-600 hover:text-red-400 flex items-center gap-1">
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>

            {history.length === 0
              ? <div className="text-center py-8 text-gray-600 text-[12px]">Nenhum documento gerado ainda.</div>
              : history.map(h => (
                <div key={h.id} className="bg-[#141414] border border-gray-700/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-400">{h.acao}</span>
                    <span className="text-[10px] text-gray-600">{h.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{h.inputSnippet}...</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setResult(h.resultado); setTab("processar"); }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] bg-amber-700/20 border border-amber-700/30 text-amber-400 rounded-lg hover:bg-amber-700/30"
                    >
                      <Play size={11} /> Restaurar
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(h.resultado); }}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-700/40 text-gray-500 rounded-lg hover:text-amber-400 hover:border-amber-700/40"
                    >
                      <Copy size={11} /> Copiar
                    </button>
                    <button
                      onClick={() => setHistory(prev => prev.filter(e => e.id !== h.id))}
                      className="p-1 text-gray-600 hover:text-red-400 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <details>
                    <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-amber-400">Ver resultado...</summary>
                    <div className="mt-2 text-[11px] text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border-t border-gray-700/30 pt-2">
                      {h.resultado.substring(0, 800)}{h.resultado.length > 800 ? "..." : ""}
                    </div>
                  </details>
                </div>
              ))
            }
          </div>
        )}

        {/* ─────── ABA: AÇÕES CUSTOMIZADAS ─────── */}
        {tab === "acoes" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><Wand2 size={15} /> Ações Personalizadas</h2>
                <p className="text-[10px] text-gray-600 mt-0.5">Crie instruções personalizadas para a IA. Aparecem na aba Processar.</p>
              </div>
              <button onClick={openNewCustom}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700/30 border border-purple-600/40 text-purple-400 text-[12px] hover:bg-purple-700/50 transition-colors">
                <Plus size={13} /> Nova Ação
              </button>
            </div>

            {/* Formulário */}
            {showCustomForm && (
              <div className="bg-[#141414] border border-purple-700/30 rounded-xl p-3 space-y-2">
                <h3 className="text-[12px] font-semibold text-purple-400">{editingCustom ? "Editar Ação" : "Nova Ação"}</h3>
                <input value={caLabel} onChange={e => setCaLabel(e.target.value)}
                  placeholder="Nome da ação (ex: Petição Inicial Trabalhista)"
                  className="w-full h-8 px-2 text-[12px] bg-[#0d0d0d] border border-gray-700/40 rounded-lg text-gray-200 outline-none focus:border-purple-600/50" />
                <input value={caDesc} onChange={e => setCaDesc(e.target.value)}
                  placeholder="Descrição curta (opcional)"
                  className="w-full h-8 px-2 text-[12px] bg-[#0d0d0d] border border-gray-700/40 rounded-lg text-gray-200 outline-none focus:border-purple-600/50" />
                <textarea value={caPrompt} onChange={e => setCaPrompt(e.target.value)}
                  placeholder="Instrução para a IA. O texto do documento será adicionado automaticamente após. Ex: Elabore uma petição inicial trabalhista com base no seguinte caso, incluindo todos os pedidos cabíveis, fundamentação legal e jurisprudência pertinente..."
                  rows={5}
                  className="w-full resize-none bg-[#0d0d0d] border border-gray-700/40 rounded-lg px-3 py-2 text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-purple-600/50 leading-relaxed" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowCustomForm(false); setEditingCustom(null); }}
                    className="px-3 py-1.5 text-[12px] border border-gray-700/40 text-gray-500 rounded-lg hover:text-gray-300">
                    Cancelar
                  </button>
                  <button onClick={saveCustom} disabled={!caLabel.trim() || !caPrompt.trim()}
                    className="px-3 py-1.5 text-[12px] bg-purple-700/40 border border-purple-600/50 text-purple-300 rounded-lg hover:bg-purple-700/60 disabled:opacity-40">
                    <Save size={12} className="inline mr-1" /> Salvar
                  </button>
                </div>
              </div>
            )}

            {customActions.length === 0 && !showCustomForm
              ? <div className="text-center py-8 text-gray-600 text-[12px] space-y-2">
                  <Wand2 size={24} className="mx-auto text-gray-700" />
                  <p>Nenhuma ação personalizada.</p>
                  <p className="text-[11px]">Crie ações com suas próprias instruções — petição inicial específica, contrato, parecer jurídico, etc.</p>
                </div>
              : customActions.map(a => (
                <div key={a.id} className="bg-[#141414] border border-purple-700/20 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-purple-300">{a.label}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditCustom(a)} className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-amber-400"><Pencil size={12} /></button>
                      <button onClick={() => setCustomActions(prev => prev.filter(x => x.id !== a.id))}
                        className="p-1 rounded hover:bg-red-900/20 text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {a.descricao && <p className="text-[11px] text-gray-500">{a.descricao}</p>}
                  <details>
                    <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-purple-400">Ver prompt...</summary>
                    <p className="text-[11px] text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed border-t border-gray-700/30 pt-2">{a.prompt}</p>
                  </details>
                  <button
                    onClick={() => { setTab("processar"); setTimeout(() => runAction("custom", a.prompt), 100); }}
                    disabled={!inputText.trim()}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] bg-purple-700/20 border border-purple-700/30 text-purple-400 rounded-lg hover:bg-purple-700/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={!inputText.trim() ? "Cole o texto na aba Processar primeiro" : ""}
                  >
                    <Play size={11} /> Executar agora
                  </button>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
