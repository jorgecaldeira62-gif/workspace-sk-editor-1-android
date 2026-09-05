import { useState, useRef, useCallback, useEffect } from "react";
import {
  MessageSquare, Settings, Send, Trash2, ArrowLeft, Eye, EyeOff,
  Loader2, StopCircle, Check, ClipboardCopy, Save, Key, X,
  Download, Upload, Mic, MicOff, Volume2, VolumeX, SlidersHorizontal,
} from "lucide-react";
import { speak, stopSpeaking, loadTTSConfig, saveTTSConfig, getAvailableVoices, cleanForSpeech, type TTSConfig } from "@/lib/tts-service";

const AUTO_DETECT: [string, string, string, string][] = [
  ["gsk_",  "https://api.groq.com/openai/v1",                          "llama-3.3-70b-versatile", "Groq"],
  ["sk-or-","https://openrouter.ai/api/v1",                             "openai/gpt-4o-mini",      "OpenRouter"],
  ["pplx-", "https://api.perplexity.ai",                               "sonar-pro",               "Perplexity"],
  ["AIza",  "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.0-flash",        "Google Gemini"],
  ["xai-",  "https://api.x.ai/v1",                                     "grok-2-latest",           "xAI/Grok"],
  ["sk-ant","https://api.anthropic.com/v1",                             "claude-haiku-4-20250514", "Anthropic"],
  ["sk-",   "https://api.openai.com/v1",                               "gpt-4o-mini",             "OpenAI"],
];

function detectProvider(key: string): { url: string; model: string; name: string } | null {
  const k = (key || "").trim();
  for (const [prefix, url, model, name] of AUTO_DETECT) {
    if (k.startsWith(prefix)) return { url, model, name };
  }
  return null;
}

interface SavedKey {
  id: string;
  label: string;
  key: string;
  url: string;
  model: string;
  provider: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-gray-700/50">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e1a0a] text-gray-500 text-[10px] font-mono">
        <span>{lang || "code"}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 hover:text-gray-300 transition-colors">
          {copied ? <><Check className="w-3 h-3 text-green-400" /> Copiado!</> : <><ClipboardCopy className="w-3 h-3" /> Copiar</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-gray-200 font-mono bg-[#0d0d0d]"><code>{code}</code></pre>
    </div>
  );
}

function RenderContent({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div>
      {parts.map((part, i) => {
        const m = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
        if (m) return <CodeBlock key={i} lang={m[1]} code={m[2].trimEnd()} />;
        if (part.trim()) {
          const urlRe = /(https?:\/\/[^\s<>"']+)/g;
          const ps = part.split(urlRe);
          return (
            <p key={i} className="text-[12px] leading-relaxed whitespace-pre-wrap my-1 text-gray-200">
              {ps.map((p2, j) =>
                urlRe.test(p2)
                  ? <a key={j} href={p2} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{p2}</a>
                  : <span key={j}>{p2}</span>
              )}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

interface CampoLivreProps {
  onBack: () => void;
}

export default function CampoLivre({ onBack }: CampoLivreProps) {
  const [apiKey,   setApiKey]   = useState(() => localStorage.getItem("cl_api_key") || localStorage.getItem("sk_global_key") || "");
  const [apiUrl,   setApiUrl]   = useState(() => localStorage.getItem("cl_api_url")   || "https://api.groq.com/openai/v1");
  const [apiModel, setApiModel] = useState(() => localStorage.getItem("cl_api_model") || "llama-3.3-70b-versatile");
  const [showKey,       setShowKey]       = useState(false);
  const [showConfig,    setShowConfig]    = useState(() => !localStorage.getItem("cl_api_key"));
  const [showSavedKeys, setShowSavedKeys] = useState(false);
  const [keyLabel,      setKeyLabel]      = useState("");
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>(() => {
    try { return JSON.parse(localStorage.getItem("cl_saved_keys") || "[]"); } catch { return []; }
  });
  const [history, setHistory] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem("cl_chat_history") || "[]"); } catch { return []; }
  });
  const [prompt,       setPrompt]       = useState("");
  const [streaming,    setStreaming]     = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening,    setIsListening]    = useState(false);
  const [ttsOn,          setTtsOn]          = useState(() => loadTTSConfig().enabled);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [voiceList,      setVoiceList]      = useState<SpeechSynthesisVoice[]>([]);
  const [ttsConfig,      setTtsConfig]      = useState<TTSConfig>(() => loadTTSConfig());

  const abortRef          = useRef<AbortController | null>(null);
  const chatEndRef        = useRef<HTMLDivElement>(null);
  const importRef         = useRef<HTMLInputElement>(null);
  const wantsListeningRef = useRef(false);
  const recognitionRef    = useRef<any>(null);
  const conversationModeRef = useRef(false); // true quando usuário usa voz → reinicia mic após fala
  const spokenPosRef      = useRef(0);       // posição até onde já foi falado (TTS progressivo)

  // Carrega vozes disponíveis no navegador
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

  useEffect(() => {
    if (apiKey)   localStorage.setItem("cl_api_key",   apiKey);
    else          localStorage.removeItem("cl_api_key");
    if (apiUrl)   localStorage.setItem("cl_api_url",   apiUrl);
    if (apiModel) localStorage.setItem("cl_api_model", apiModel);
  }, [apiKey, apiUrl, apiModel]);

  useEffect(() => {
    localStorage.setItem("cl_saved_keys",    JSON.stringify(savedKeys));
  }, [savedKeys]);

  useEffect(() => {
    localStorage.setItem("cl_chat_history",  JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streaming]);

  useEffect(() => {
    if (!apiKey) return;
    const clean = apiKey.trim();
    const d = detectProvider(clean);
    if (d) { setApiUrl(d.url); setApiModel(d.model); }
  }, [apiKey]);

  useEffect(() => () => { wantsListeningRef.current = false; recognitionRef.current?.stop(); }, []);

  const applyKey = (k: string) => {
    setApiKey(k);
    const d = detectProvider(k);
    if (d) { setApiUrl(d.url); setApiModel(d.model); }
  };

  const saveCurrentKey = () => {
    if (!apiKey.trim()) return;
    if (savedKeys.some(sk => sk.key === apiKey.trim())) return;
    const d = detectProvider(apiKey);
    const label = keyLabel.trim() || d?.name || "Chave " + (savedKeys.length + 1);
    setSavedKeys(prev => [...prev, { id: Date.now().toString(), label, key: apiKey.trim(), url: apiUrl, model: apiModel, provider: d?.name || "Custom" }]);
    setKeyLabel("");
  };

  const loadKey = (sk: SavedKey) => { setApiKey(sk.key); setApiUrl(sk.url); setApiModel(sk.model); setShowSavedKeys(false); };
  const removeKey = (id: string) => setSavedKeys(prev => prev.filter(k => k.id !== id));

  // Reinicia o microfone após o TTS terminar (modo conversa)
  const restartMicAfterSpeech = useCallback(() => {
    if (!conversationModeRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setTimeout(() => {
      if (!conversationModeRef.current) return;
      const rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;
      let fullText = "";
      const scheduleAutoSend = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          const txt = fullText.trim();
          try { rec.stop(); } catch {}
          conversationModeRef.current = false;
          setIsListening(false);
          if (txt) sendMessageRef.current?.(txt);
        }, 1800);
      };
      rec.onresult = (e: any) => {
        let final = ""; let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        fullText = final || interim;
        setPrompt(fullText);
        if (fullText) scheduleAutoSend();
      };
      rec.onerror = () => { setIsListening(false); conversationModeRef.current = false; };
      rec.onend   = () => { setIsListening(false); };
      recognitionRef.current = rec;
      try { rec.start(); setIsListening(true); } catch { setIsListening(false); }
    }, 400);
  }, []);

  const sendMessageRef = useRef<((text: string) => void) | null>(null);

  const sendMessage = useCallback(async (textOverride?: string) => {
    const userMsg = (textOverride ?? prompt).trim();
    if (!userMsg || isProcessing) return;
    // Unlock TTS no Android (deve estar dentro de um user-gesture)
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.lang = "pt-BR";
      window.speechSynthesis.speak(u);
    }
    setPrompt("");
    spokenPosRef.current = 0;

    // Sistema de prompt de voz: pede respostas curtas e naturais (sem markdown)
    const voiceSystemMsg = ttsOn ? {
      role: "system" as const,
      content: "Você está em modo de conversa por voz. Responda de forma natural e direta, SEM usar markdown, asteriscos, sustenidos, hashtags, tabelas, listas numeradas, código ou caracteres especiais. Fale como numa conversa normal. Para tarefas longas ou com várias etapas, anuncie brevemente o que fará em seguida, por exemplo: 'Já analisei o primeiro ponto, agora vou verificar o segundo.' Seja objetivo e amigável.",
    } : null;
    const fullHistory = [
      ...(voiceSystemMsg ? [voiceSystemMsg] : []),
      ...history,
      { role: "user" as const, content: userMsg },
    ];
    const newHistory: Message[] = [...history, { role: "user", content: userMsg }];
    setHistory(newHistory);
    setIsProcessing(true);
    setStreaming("");

    const controller = new AbortController();
    abortRef.current = controller;

    const afterSpeak = (text: string) => {
      const clean = cleanForSpeech(text);
      if (!clean.trim()) { restartMicAfterSpeech(); return; }
      speak(clean, { ...ttsConfig, enabled: true }, restartMicAfterSpeech);
    };

    try {
      const cleanKey = apiKey.trim();

      // Sem chave → tenta backend gratuito, depois fallback informativo
      if (!cleanKey) {
        try {
          const resp = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: newHistory }),
            signal: controller.signal,
          });
          if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || `Erro ${resp.status}`); }
          const data = await resp.json();
          const content = data.content || "";
          setHistory(prev => [...prev, { role: "assistant", content }]);
          if (ttsOn && content) afterSpeak(content);
          return;
        } catch (serverErr: any) {
          if (serverErr.name === "AbortError") throw serverErr;
          const msg = "⚠️ Sem chave de IA configurada e o servidor não está disponível.\n\nVá em ⚙️ Configurações → cole sua chave (Groq grátis em console.groq.com, Gemini em aistudio.google.com).";
          setHistory(prev => [...prev, { role: "assistant", content: msg }]);
          return;
        }
      }

      // Com chave → chama provider direto (sem servidor)
      const targetUrl = (apiUrl.trim() || "https://api.openai.com/v1") + "/chat/completions";
      const isAnthropic = cleanKey.startsWith("sk-ant");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAnthropic) {
        headers["x-api-key"] = cleanKey;
        headers["anthropic-version"] = "2023-06-01";
        headers["anthropic-dangerous-direct-browser-access"] = "true";
      } else {
        headers["Authorization"] = `Bearer ${cleanKey}`;
      }
      const body: any = isAnthropic
        ? { model: apiModel, messages: fullHistory.filter(m => m.role !== "system"), max_tokens: 8192, stream: true, system: fullHistory.find(m => m.role === "system")?.content || "" }
        : { model: apiModel, messages: fullHistory, stream: true, max_tokens: 16384 };
      const anthropicUrl = isAnthropic ? "https://api.anthropic.com/v1/messages" : targetUrl;

      let resp = await fetch(anthropicUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      }).catch(async (corsErr) => {
        // Fallback: tenta via proxy do backend se disponível
        return fetch("/api/ai/forward", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: cleanKey, apiUrl: apiUrl.trim(), model: apiModel, messages: fullHistory, stream: true, maxTokens: 16384 }),
          signal: controller.signal,
        });
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        let errMsg = `Erro ${resp.status}`;
        try { const j = JSON.parse(errText); errMsg = j.error || j.message || errMsg; } catch {}
        throw new Error(errMsg.substring(0, 400));
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("Sem resposta");
      const decoder = new TextDecoder();
      let full = "";
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") continue;
          try {
            const p = JSON.parse(j);
            if (p.error) throw new Error(typeof p.error === "string" ? p.error : JSON.stringify(p.error));
            const delta = p.choices?.[0]?.delta?.content || p.text || p.content || "";
            if (delta) {
              full += delta;
              setStreaming(full);
              // TTS progressivo: fala frases completas conforme chegam
              if (ttsOn && conversationModeRef.current) {
                const unsaid = full.slice(spokenPosRef.current);
                // Detecta frase completa (termina com . ! ? e tem tamanho mínimo)
                const sentMatch = unsaid.match(/^(.{30,}?[.!?])\s/s);
                if (sentMatch) {
                  const toSay = cleanForSpeech(sentMatch[1], 400);
                  if (toSay.trim().length > 10) {
                    spokenPosRef.current += sentMatch[0].length;
                    // Só fala se TTS não estiver tocando (evita cortar frase anterior)
                    if (!window.speechSynthesis?.speaking) {
                      speak(toSay, { ...ttsConfig, enabled: true });
                    }
                  }
                }
              }
            }
          } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
        }
      }

      if (full.trim()) {
        setHistory(prev => [...prev, { role: "assistant", content: full }]);
        if (ttsOn) {
          // Fala o restante que ainda não foi falado
          const remaining = full.slice(spokenPosRef.current);
          afterSpeak(remaining || full);
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      const msg = err.message || "Erro desconhecido";
      setHistory(prev => [...prev, { role: "assistant", content: `❌ ${msg}` }]);
      conversationModeRef.current = false;
    } finally {
      setIsProcessing(false);
      setStreaming("");
      abortRef.current = null;
    }
  }, [prompt, apiKey, apiUrl, apiModel, history, ttsOn, ttsConfig, isProcessing, restartMicAfterSpeech]);

  // Ref para o sendMessage (usado no callback do mic sem criar dep circular)
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    conversationModeRef.current = false;
    stopSpeaking();
    recognitionRef.current?.stop();
  };

  const clearHistory = () => { stop(); setHistory([]); setStreaming(""); localStorage.removeItem("cl_chat_history"); };

  const exportConversation = () => {
    if (!history.length) return;
    const lines = ["=== CONVERSA — Campo Livre ===", `Data: ${new Date().toLocaleString("pt-BR")}`, ""];
    history.forEach(m => { lines.push(`[${m.role === "user" ? "VOCÊ" : "IA"}]`); lines.push(m.content); lines.push(""); });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `conversa-${Date.now()}.txt`; a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const t = ev.target?.result as string; if (t) setPrompt(prev => prev ? prev + "\n\n" + t : t); };
    reader.readAsText(file); e.target.value = "";
  };

  const startVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      conversationModeRef.current = false;
      stopSpeaking();
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome ou Edge para ditar por voz."); return; }

    // Ativa o modo conversa: após a IA falar, o mic reinicia automaticamente
    conversationModeRef.current = true;

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let fullText = "";

    const scheduleAutoSend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const txt = fullText.trim();
        try { rec.stop(); } catch {}
        if (txt) {
          setPrompt("");
          sendMessage(txt);
        }
      }, 1800);
    };

    rec.onresult = (e: any) => {
      let final = ""; let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      fullText = final || interim;
      setPrompt(fullText);
      if (fullText) scheduleAutoSend();
    };

    rec.onerror = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      recognitionRef.current = null;
      setIsListening(false);
    };

    rec.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = rec;
    try { rec.start(); setIsListening(true); } catch { setIsListening(false); }
  }, [isListening, sendMessage]);

  const activeProvider = detectProvider(apiKey);
  const allMessages: { role: "user"|"assistant"; content: string; streaming?: boolean }[] = [
    ...history,
    ...(streaming ? [{ role: "assistant" as const, content: streaming, streaming: true }] : []),
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0d0d0d] text-gray-200">
      <header className="h-11 flex items-center gap-2 px-3 bg-[#141414] border-b border-gray-700/50 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
          <ArrowLeft size={17} />
        </button>
        <MessageSquare size={15} className="text-green-400 shrink-0" />
        <span className="text-sm font-semibold truncate flex-1">Campo Livre</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-700/40 shrink-0">
          {activeProvider ? activeProvider.name : "Gratuita ✨"}
        </span>
        <button onClick={exportConversation} disabled={!history.length} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 disabled:opacity-30" title="Exportar conversa">
          <Download size={14} />
        </button>
        <button onClick={() => importRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500" title="Importar arquivo de texto">
          <Upload size={14} />
        </button>
        <input ref={importRef} type="file" accept=".txt,.md,.csv,.json" className="hidden" onChange={handleImport} />
        <button
          onClick={() => { setTtsOn(v => { const n = !v; if (!n) { stopSpeaking(); setShowVoicePanel(false); } return n; }); }}
          className={`p-1.5 rounded-lg ${ttsOn ? "text-green-400 bg-green-900/20" : "text-gray-600 hover:bg-white/5"}`}
          title={ttsOn ? "Voz da IA ativa — clique para desativar" : "Ativar voz da IA"}
        >
          {ttsOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
        </button>
        {ttsOn && (
          <button
            onClick={() => setShowVoicePanel(v => !v)}
            className={`p-1.5 rounded-lg ${showVoicePanel ? "text-green-300 bg-gray-800/30" : "text-gray-600 hover:bg-white/5 hover:text-green-400"}`}
            title="Configurar voz (escolher, velocidade, tom)"
          >
            <SlidersHorizontal size={13} />
          </button>
        )}
        <button onClick={() => { setShowConfig(v => !v); setShowSavedKeys(false); }} className={`p-1.5 rounded-lg ${showConfig ? "bg-white/10 text-gray-200" : "hover:bg-white/5 text-gray-500"}`} title="Configurar API">
          <Settings size={14} />
        </button>
        <button onClick={() => { setShowSavedKeys(v => !v); setShowConfig(false); }} className={`p-1.5 rounded-lg relative ${showSavedKeys ? "bg-white/10 text-gray-200" : "hover:bg-white/5 text-gray-500"}`} title="Chaves salvas">
          <Key size={14} />
          {savedKeys.length > 0 && <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-green-600 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">{savedKeys.length}</span>}
        </button>
        <button onClick={clearHistory} className="p-1.5 rounded-lg hover:bg-red-900/20 text-gray-600 hover:text-red-400" title="Limpar conversa">
          <Trash2 size={14} />
        </button>
      </header>

      {showVoicePanel && (
        <div className="border-b border-green-800/30 bg-[#1a2410] p-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configurações de Voz</span>
            <button onClick={() => setShowVoicePanel(false)} className="p-0.5 rounded text-gray-600 hover:text-gray-400"><X size={12} /></button>
          </div>

          {/* Seletor de voz */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Voz ({voiceList.length} disponíveis)</label>
            {voiceList.length === 0 ? (
              <p className="text-[11px] text-gray-600 italic">Sem vozes disponíveis neste navegador.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-lg border border-gray-700/40 bg-[#0d0d0d] p-1">
                {/* Opção padrão (melhor voz automática) */}
                <button
                  onClick={() => applyTTSConfig({ voiceName: "" })}
                  className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${ttsConfig.voiceName === "" ? "bg-green-900/40 text-green-300 border border-green-700/40" : "text-gray-400 hover:bg-white/5"}`}
                >
                  <span className="font-medium">Automático</span>
                  <span className="text-[10px] text-gray-600 ml-1">(melhor voz pt-BR disponível)</span>
                </button>
                {/* Vozes pt-BR primeiro, depois as demais */}
                {[
                  ...voiceList.filter(v => v.lang.toLowerCase().startsWith("pt")),
                  ...voiceList.filter(v => !v.lang.toLowerCase().startsWith("pt")),
                ].map(voice => (
                  <button
                    key={voice.name}
                    onClick={() => applyTTSConfig({ voiceName: voice.name })}
                    className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors ${ttsConfig.voiceName === voice.name ? "bg-green-900/40 text-green-300 border border-green-700/40" : "text-gray-400 hover:bg-white/5"}`}
                  >
                    <span className="font-medium truncate block">{voice.name}</span>
                    <span className="text-[10px] text-gray-600">{voice.lang} {voice.localService ? "· local" : "· online"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Velocidade */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500">Velocidade</label>
              <span className="text-[10px] text-green-400 font-mono">{ttsConfig.rate.toFixed(2)}×</span>
            </div>
            <input
              type="range" min="0.5" max="2.0" step="0.05"
              value={ttsConfig.rate}
              onChange={e => applyTTSConfig({ rate: parseFloat(e.target.value) })}
              className="w-full accent-green-500 h-1.5"
            />
            <div className="flex justify-between text-[9px] text-gray-700 mt-0.5">
              <span>Lenta</span><span>Normal</span><span>Rápida</span>
            </div>
          </div>

          {/* Tom */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500">Tom de voz</label>
              <span className="text-[10px] text-green-400 font-mono">{ttsConfig.pitch.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0.5" max="1.8" step="0.05"
              value={ttsConfig.pitch}
              onChange={e => applyTTSConfig({ pitch: parseFloat(e.target.value) })}
              className="w-full accent-green-500 h-1.5"
            />
            <div className="flex justify-between text-[9px] text-gray-700 mt-0.5">
              <span>Grave</span><span>Natural</span><span>Agudo</span>
            </div>
          </div>

          {/* Botão testar */}
          <button
            onClick={() => {
              stopSpeaking();
              const selectedVoice = voiceList.find(v => v.name === ttsConfig.voiceName);
              const cfg = { ...ttsConfig, enabled: true };
              const u = new SpeechSynthesisUtterance("Olá! Esta é a minha voz. Como posso te ajudar hoje?");
              u.lang = cfg.lang; u.rate = cfg.rate; u.pitch = cfg.pitch;
              if (selectedVoice) u.voice = selectedVoice;
              window.speechSynthesis?.speak(u);
            }}
            className="w-full py-1.5 text-[11px] bg-gray-800/30 border border-green-700/40 text-green-400 rounded-lg hover:bg-gray-800/50 transition-colors"
          >
            ▶ Testar voz agora
          </button>
        </div>
      )}

      {showConfig && (
        <div className="border-b border-gray-700/40 bg-[#141414] p-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configurar Chave de API</span>
            <span className="text-[10px] text-green-400">{apiKey ? "Sua chave ativa" : "Usando IA gratuita (Replit)"}</span>
          </div>
          {!apiKey && (
            <p className="text-[11px] text-blue-300 bg-blue-900/20 border border-blue-700/30 rounded px-2 py-1.5">
              Sem chave → usando IA gratuita. Cole qualquer chave abaixo para usar sua própria conta.
            </p>
          )}
          <div className="flex gap-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => applyKey(e.target.value.trim())}
              placeholder="gsk_..., AIza..., sk-..., pplx-..., xai-..., sk-or-..."
              className="flex-1 h-8 px-2 text-[11px] font-mono bg-[#0d0d0d] border border-gray-700/50 rounded-lg text-gray-200 outline-none focus:border-green-600/60"
            />
            <button onClick={() => setShowKey(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-gray-500">
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {apiKey && (
            <div className="flex gap-1 items-end">
              <input value={keyLabel} onChange={e => setKeyLabel(e.target.value)} placeholder={activeProvider?.name || "Nome para salvar"} className="flex-1 h-7 px-2 text-[11px] bg-[#0d0d0d] border border-gray-700/40 rounded text-gray-300 outline-none" />
              <button onClick={saveCurrentKey} className="flex items-center gap-1 px-2 h-7 text-[11px] bg-green-700/30 border border-green-600/40 text-green-400 rounded hover:bg-green-700/50">
                <Save size={11} /> Salvar
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1">
            <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="URL da API" className="h-7 px-2 text-[10px] font-mono bg-[#0d0d0d] border border-gray-700/40 rounded text-gray-400 outline-none" />
            <input value={apiModel} onChange={e => setApiModel(e.target.value)} placeholder="Modelo" className="h-7 px-2 text-[10px] font-mono bg-[#0d0d0d] border border-gray-700/40 rounded text-gray-400 outline-none" />
          </div>
          {apiKey && activeProvider && (
            <p className="text-[10px] text-green-400">✓ {activeProvider.name} · {apiModel}</p>
          )}
        </div>
      )}

      {showSavedKeys && (
        <div className="border-b border-gray-700/40 bg-[#141414] p-3 space-y-2 shrink-0 max-h-48 overflow-y-auto">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chaves Salvas ({savedKeys.length})</span>
          {savedKeys.length === 0 ? (
            <p className="text-[11px] text-gray-600 py-2 text-center">Nenhuma chave salva.</p>
          ) : savedKeys.map(sk => (
            <div key={sk.id} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] cursor-pointer ${sk.key === apiKey ? "bg-green-900/20 border-green-700/40" : "bg-[#0d0d0d] border-gray-700/30 hover:border-gray-600/50"}`}>
              <button onClick={() => loadKey(sk)} className="flex-1 text-left min-w-0">
                <div className="font-medium text-gray-200 truncate">{sk.label}</div>
                <div className="text-[10px] text-gray-500">{sk.provider} · {sk.key.substring(0, 8)}...{sk.key.slice(-4)}</div>
              </button>
              {sk.key === apiKey && <span className="text-[9px] text-green-400 font-bold shrink-0">ATIVA</span>}
              <button onClick={() => removeKey(sk.id)} className="p-1 rounded hover:bg-red-900/20 text-gray-600 hover:text-red-400 shrink-0">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {allMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-12">
            <MessageSquare size={36} className="text-gray-700" />
            <div>
              <p className="text-gray-400 text-sm font-medium">Campo Livre</p>
              <p className="text-gray-600 text-[12px] mt-1">Converse sobre qualquer assunto.<br/>Nenhuma restrição de tema.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["Olá, como você está?", "Me ajude a pensar em algo", "Conta uma curiosidade"].map(s => (
                <button key={s} onClick={() => setPrompt(s)} className="text-[11px] px-3 py-1.5 rounded-full border border-gray-700/50 text-gray-500 hover:border-green-700/50 hover:text-green-400 transition-colors">{s}</button>
              ))}
            </div>
          </div>
        )}

        {allMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${msg.role === "user"
              ? "bg-green-800/40 border border-green-700/30 text-gray-100"
              : "bg-[#141414] border border-gray-700/30"}`}>
              {msg.role === "assistant" ? (
                <div>
                  <RenderContent text={msg.content} />
                  {(msg as any).streaming && (
                    <span className="inline-block w-1.5 h-3.5 bg-green-400 animate-pulse ml-0.5 rounded-sm" />
                  )}
                  {!((msg as any).streaming) && msg.content && (
                    <button onClick={() => navigator.clipboard.writeText(msg.content)} className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400">
                      <ClipboardCopy size={10} /> Copiar
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-gray-700/40 bg-[#141414] p-2 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Digite sua mensagem… (Enter para enviar, Shift+Enter para nova linha)"
            rows={1}
            className="flex-1 resize-none bg-[#0d0d0d] border border-gray-700/50 rounded-xl px-3 py-2.5 text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-green-600/60 max-h-32 overflow-y-auto leading-relaxed"
            style={{ minHeight: "42px" }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={startVoice}
            className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-all ${isListening ? "bg-red-600 text-white animate-pulse" : "bg-[#0d0d0d] border border-gray-700/50 text-gray-500 hover:text-green-400 hover:border-green-700/50"}`}
            title="Ditar por voz"
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          {isProcessing ? (
            <button onClick={stop} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-900/30 border border-red-700/40 text-red-400 shrink-0">
              <StopCircle size={16} />
            </button>
          ) : (
            <button onClick={() => sendMessage()} disabled={!prompt.trim()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-700/30 border border-green-600/40 text-green-400 hover:bg-green-700/50 disabled:opacity-30 shrink-0 transition-all">
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
