import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, X, Loader2, Volume2, Settings2, StopCircle } from "lucide-react";
import { cleanForSpeech } from "@/lib/tts-service";

interface VoiceCardProps {
  onClose: () => void;
  onSend: (text: string) => Promise<string>;
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

const VOICES = [
  { id: "nova",    label: "Nova",    desc: "Calorosa e conversacional" },
  { id: "alloy",   label: "Alloy",   desc: "Neutra e profissional" },
  { id: "echo",    label: "Echo",    desc: "Clara e grave" },
  { id: "fable",   label: "Fable",   desc: "Narrativa e expressiva" },
  { id: "onyx",    label: "Onyx",    desc: "Grave e marcante" },
  { id: "shimmer", label: "Shimmer", desc: "Leve e alegre" },
];

const SPEEDS = [
  { id: "devagar",      label: "🐢 Devagar",      prompt: "Fale bem devagar e claramente." },
  { id: "normal",       label: "🎯 Normal",        prompt: "Fale em velocidade normal." },
  { id: "rapido",       label: "🚀 Rápido",        prompt: "Fale um pouco mais rápido que o normal." },
  { id: "muito-rapido", label: "⚡ Muito rápido",  prompt: "Fale rapidamente, mas mantendo clareza." },
];

const RESPONSE_LEVELS = [
  { value: 1, label: "⚡ Flash",    prompt: "Responda em UMA frase apenas. Seja direto e curto ao máximo." },
  { value: 2, label: "📝 Curto",    prompt: "Responda em 1-2 frases curtas e diretas." },
  { value: 3, label: "💬 Normal",   prompt: "Responda em 2-3 frases conversacionais." },
  { value: 4, label: "📖 Médio",    prompt: "Responda em 3-4 frases, pode elaborar um pouco quando necessário." },
  { value: 5, label: "📚 Completo", prompt: "Pode dar respostas mais completas e detalhadas quando o assunto precisar." },
];

const STORAGE_KEY = "voice-card-config";

interface VoiceConfig {
  voice: string;
  speed: string;
  responseLevel: number;
  autoLoop: boolean;
}

function loadConfig(): VoiceConfig {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      // Força autoLoop=false como padrão seguro — evita loop infinito ao abrir pela 1ª vez
      const base = { voice: "nova", speed: "normal", responseLevel: 3, autoLoop: false };
      return { ...base, ...parsed, autoLoop: parsed.autoLoop ?? false };
    }
  } catch {}
  return { voice: "nova", speed: "normal", responseLevel: 3, autoLoop: false };
}

function saveConfig(c: VoiceConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
}

const API_BASE = (() => {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  return base.replace(/\/$/, "") + "/api";
})();

async function speakText(text: string, voice: string, speedPrompt: string): Promise<HTMLAudioElement> {
  const res = await fetch(`${API_BASE}/voice/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, speedPrompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Erro na síntese de voz");
  }
  const { audio } = await res.json();
  return new Audio(`data:audio/mp3;base64,${audio}`);
}

export default function VoiceCard({ onClose, onSend }: VoiceCardProps) {
  const [cfg, setCfg]     = useState<VoiceConfig>(loadConfig);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [err, setErr]     = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const phaseRef   = useRef<Phase>("idle");
  const recRef     = useRef<any>(null);
  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const loopTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cfgRef     = useRef<VoiceConfig>(cfg);
  const stoppedRef = useRef(false); // flag para parar tudo imediatamente

  useEffect(() => { cfgRef.current = cfg; saveConfig(cfg); }, [cfg]);

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const stopAll = useCallback((closeCard = false) => {
    stoppedRef.current = true;
    recRef.current?.abort?.();
    recRef.current?.stop?.();
    recRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
    if (loopTimer.current) { clearTimeout(loopTimer.current); loopTimer.current = null; }
    if (!closeCard) {
      setP("idle");
      // Permite novas ações depois de 500ms
      setTimeout(() => { stoppedRef.current = false; }, 500);
    } else {
      onClose();
    }
  }, [onClose]);

  const speak = useCallback(async (text: string) => {
    if (stoppedRef.current) return;
    const clean = cleanForSpeech(text);
    if (!clean.trim()) { setP("idle"); return; }
    setP("speaking");

    const { voice, speed } = cfgRef.current;
    const speedObj = SPEEDS.find(s => s.id === speed) ?? SPEEDS[1];

    try {
      const audio = await speakText(clean, voice, speedObj.prompt);
      if (stoppedRef.current) return;
      audioRef.current = audio;
      audio.onended = () => {
        audioRef.current = null;
        if (stoppedRef.current) return;
        if (cfgRef.current.autoLoop && phaseRef.current === "speaking") {
          loopTimer.current = setTimeout(listen, 800); // 800ms de pausa antes de ouvir de novo
        } else {
          setP("idle");
        }
      };
      audio.onerror = () => { audioRef.current = null; setP("idle"); };
      audio.play().catch(() => setP("idle"));
    } catch (e: any) {
      setErr(e.message);
      setP("idle");
    }
  }, []);

  const listen = useCallback(() => {
    if (stoppedRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("Microfone não suportado neste navegador"); return; }

    setHeard(""); setErr(""); setP("listening");

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;
    let finalText = "";

    rec.onresult = (e: any) => {
      if (stoppedRef.current) return;
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      setHeard(finalText || interim);
    };

    rec.onend = async () => {
      if (stoppedRef.current) return;
      const text = finalText.trim();
      if (!text) {
        // Sem fala detectada
        if (cfgRef.current.autoLoop && phaseRef.current === "listening") {
          // Espera 1.5s antes de tentar de novo — evita apitar rapidamente
          loopTimer.current = setTimeout(listen, 1500);
        } else {
          setP("idle");
        }
        return;
      }
      setHeard(text);
      setP("thinking");
      try {
        const level = RESPONSE_LEVELS.find(r => r.value === cfgRef.current.responseLevel) ?? RESPONSE_LEVELS[2];
        const enriched = `[${level.prompt}] ${text}`;
        const response = await onSend(enriched);
        if (stoppedRef.current) return;
        setReply(response);
        await speak(response);
      } catch (e: any) {
        setErr(e.message);
        setP("idle");
      }
    };

    rec.onerror = (e: any) => {
      if (stoppedRef.current) return;
      // Ignora "no-speech" silenciosamente — não mostra erro
      if (e.error === "aborted") return;
      if (e.error !== "no-speech") setErr(`Erro de microfone: ${e.error}`);
      // Se autoLoop E não foi parado manualmente: espera 2s antes de reiniciar
      if (cfgRef.current.autoLoop && phaseRef.current === "listening" && !stoppedRef.current) {
        loopTimer.current = setTimeout(listen, 2000);
      } else {
        setP("idle");
      }
    };

    rec.start();
  }, [onSend, speak]);

  // NÃO auto-inicia mais — usuário precisa clicar manualmente
  useEffect(() => {
    return () => { stopAll(); };
  }, []);

  const handleButton = useCallback(() => {
    stoppedRef.current = false;
    if (phase === "idle") listen();
    else if (phase === "listening") {
      recRef.current?.stop?.();
      setP("idle");
    } else if (phase === "speaking") {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
      setP("idle");
    }
  }, [phase, listen]);

  const handleClose = useCallback(() => { stopAll(true); }, [stopAll]);
  const handleStop  = useCallback(() => { stopAll(false); }, [stopAll]);
  const update = (patch: Partial<VoiceConfig>) => setCfg(prev => ({ ...prev, ...patch }));

  const currentLevel = RESPONSE_LEVELS.find(r => r.value === cfg.responseLevel) ?? RESPONSE_LEVELS[2];

  const btnColor = {
    idle:     "bg-gray-700 hover:bg-gray-600 border-gray-600",
    listening:"bg-red-600 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.35)]",
    thinking: "bg-blue-600 border-blue-500 opacity-70",
    speaking: "bg-green-600 border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.35)]",
  }[phase];

  const statusLabel = {
    idle:     "Toque em Falar para começar",
    listening:"Ouvindo… (pare de falar para enviar)",
    thinking: "Pensando…",
    speaking: "Falando… (toque para parar)",
  }[phase];

  const statusColor = {
    idle:"text-gray-500", listening:"text-red-400", thinking:"text-blue-400", speaking:"text-green-400",
  }[phase];

  return (
    <div className="fixed bottom-16 right-3 z-50 w-72 rounded-2xl shadow-2xl border border-white/10 bg-[#0d0d0d]/97 backdrop-blur-md overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Volume2 size={13} className="text-green-400" />
          <span className="text-[12px] font-semibold text-green-300">Raquel — Voz Neural</span>
          {cfg.autoLoop && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 font-bold">AUTO</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Botão de PARAR TUDO — sempre visível */}
          {phase !== "idle" && (
            <button
              onClick={handleStop}
              title="Parar tudo"
              className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <StopCircle size={13} />
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            title="Configurações de voz"
            className={`p-1.5 rounded-lg transition-colors ${showSettings ? "bg-white/10 text-white" : "hover:bg-white/10 text-gray-500 hover:text-gray-300"}`}
          >
            <Settings2 size={13} />
          </button>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Painel de configurações */}
      {showSettings && (
        <div className="px-3 py-3 border-b border-white/10 bg-white/3 flex flex-col gap-3">

          {/* Voz */}
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">🎤 Voz</p>
            <div className="grid grid-cols-3 gap-1">
              {VOICES.map(v => (
                <button
                  key={v.id}
                  onClick={() => update({ voice: v.id })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold text-center transition-all ${
                    cfg.voice === v.id
                      ? "bg-green-500/25 border border-green-500/50 text-green-300"
                      : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                  }`}
                  title={v.desc}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1 text-center italic">
              {VOICES.find(v => v.id === cfg.voice)?.desc}
            </p>
          </div>

          {/* Velocidade */}
          <div>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1.5">⚡ Velocidade</p>
            <div className="grid grid-cols-2 gap-1">
              {SPEEDS.map(s => (
                <button
                  key={s.id}
                  onClick={() => update({ speed: s.id })}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold text-center transition-all ${
                    cfg.speed === s.id
                      ? "bg-blue-500/25 border border-blue-500/50 text-blue-300"
                      : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tamanho da resposta */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">💬 Resposta</p>
              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                {currentLevel.label}
              </span>
            </div>
            <input
              type="range" min={1} max={5} step={1}
              value={cfg.responseLevel}
              onChange={e => update({ responseLevel: parseInt(e.target.value) })}
              className="w-full accent-purple-500 h-1.5 rounded-full cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-gray-600">⚡ Flash</span>
              <span className="text-[9px] text-gray-600">📚 Completo</span>
            </div>
          </div>

          {/* Auto-loop — agora desligado por padrão */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400">🔁 Conversa automática</span>
              <p className="text-[9px] text-gray-600">Ouve novamente após responder</p>
            </div>
            <button
              onClick={() => update({ autoLoop: !cfg.autoLoop })}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                cfg.autoLoop
                  ? "bg-green-500/20 border border-green-500/40 text-green-400"
                  : "bg-white/5 border border-white/10 text-gray-500"
              }`}
            >
              {cfg.autoLoop ? "Ligado" : "Desligado"}
            </button>
          </div>
        </div>
      )}

      {/* Corpo */}
      <div className="px-3 py-2.5 flex flex-col gap-2 min-h-[60px]">
        {heard && (
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
            <p className="text-[9px] text-gray-500 mb-0.5 uppercase tracking-wider">Você disse</p>
            <p className="text-[12px] text-gray-200 leading-snug">{heard}</p>
          </div>
        )}
        {reply && (
          <div className="rounded-xl bg-green-500/5 border border-green-500/20 px-3 py-2">
            <p className="text-[9px] text-green-600 mb-0.5 uppercase tracking-wider">Raquel</p>
            <p className="text-[12px] text-green-200 leading-snug line-clamp-3">{reply}</p>
          </div>
        )}
        {err && <p className="text-[11px] text-red-400 text-center">{err}</p>}
        <p className={`text-[11px] text-center font-medium ${statusColor}`}>{statusLabel}</p>
      </div>

      {/* Botão principal + Parar tudo */}
      <div className="px-3 pb-3 flex flex-col gap-2">
        <button
          onClick={handleButton}
          disabled={phase === "thinking"}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-white transition-all active:scale-95 disabled:opacity-40 border ${btnColor}`}
        >
          {phase === "thinking" ? (
            <><Loader2 size={15} className="animate-spin" /> Pensando…</>
          ) : phase === "listening" ? (
            <><Square size={14} /> Parar de ouvir</>
          ) : phase === "speaking" ? (
            <><Square size={14} /> Pular resposta</>
          ) : (
            <><Mic size={14} /> Falar</>
          )}
        </button>

        {/* Botão de PARAR TUDO — sempre visível na parte inferior */}
        <button
          onClick={handleStop}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-semibold hover:bg-red-500/20 transition-colors active:scale-95"
        >
          <StopCircle size={12} /> Parar tudo e silenciar
        </button>
      </div>
    </div>
  );
}
