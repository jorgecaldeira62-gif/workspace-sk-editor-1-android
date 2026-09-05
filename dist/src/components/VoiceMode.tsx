import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, X, Bot, Loader2, Square } from "lucide-react";
import { stopSpeaking, cleanForSpeech, TTSConfig } from "@/lib/tts-service";

interface VoiceModeProps {
  onClose: () => void;
  onSend: (text: string) => Promise<string>;
  ttsConfig: TTSConfig;
}

type Phase = "idle" | "listening" | "thinking" | "speaking";

export default function VoiceMode({ onClose, onSend, ttsConfig }: VoiceModeProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard]   = useState("");
  const [reply, setReply]   = useState("");
  const [autoLoop, setAutoLoop] = useState(false);
  const [err, setErr]       = useState("");

  const phaseRef     = useRef<Phase>("idle");
  const transcRef    = useRef("");
  const recRef       = useRef<any>(null);
  const loopTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);
  const ampRef       = useRef(0);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  const setPhaseSync = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const p = phaseRef.current;
    const target = p === "listening" ? 30 : p === "speaking" ? 16 : 3;
    ampRef.current += (target - ampRef.current) * 0.12;
    const color = p === "listening" ? "#ef4444" : p === "speaking" ? "#818cf8" : "#374151";
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.shadowColor = color; ctx.shadowBlur = p === "idle" ? 0 : 14;
    const t = Date.now() * 0.003;
    for (let x = 0; x < W; x++) {
      const y = H/2 + Math.sin(x*0.05+t)*ampRef.current*Math.sin(x*0.018+t*0.5);
      x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.stroke();
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => { rafRef.current = requestAnimationFrame(draw); return () => cancelAnimationFrame(rafRef.current); }, [draw]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioBlobUrl.current) {
      URL.revokeObjectURL(audioBlobUrl.current);
      audioBlobUrl.current = null;
    }
  };

  const speakNeural = async (text: string, afterSpeak: () => void) => {
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "alloy" }),
      });
      if (!res.ok) throw new Error("TTS neural falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioBlobUrl.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { stopAudio(); afterSpeak(); };
      audio.onerror = () => { stopAudio(); afterSpeak(); };
      setPhaseSync("speaking");
      audio.play();
    } catch {
      afterSpeak();
    }
  };

  const listen = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("Microfone não disponível neste navegador"); return; }

    transcRef.current = "";
    setHeard(""); setErr("");
    setPhaseSync("listening");

    const rec = new SR();
    rec.lang = ttsConfig.lang;
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onresult = (e: any) => {
      let final = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? (final += t) : (interim += t);
      }
      const heard = (final || interim).trim();
      transcRef.current = final || transcRef.current;
      setHeard(heard);
    };

    rec.onend = async () => {
      const text = transcRef.current.trim();
      if (!text) {
        if (autoLoop && phaseRef.current === "listening") {
          loopTimer.current = setTimeout(listen, 600);
        } else {
          setPhaseSync("idle");
        }
        return;
      }

      setPhaseSync("thinking");
      setReply("");

      try {
        const response = await onSend(text);
        const clean = cleanForSpeech(response);
        setReply(clean);

        const afterSpeak = () => {
          if (autoLoop) {
            loopTimer.current = setTimeout(listen, 700);
          } else {
            setPhaseSync("idle");
          }
        };

        await speakNeural(clean || response, afterSpeak);
      } catch (e: any) {
        setErr(e.message);
        setPhaseSync("idle");
      }
    };

    rec.onerror = () => setPhaseSync("idle");
    rec.start();
  }, [ttsConfig, autoLoop, onSend]);

  const handleButton = useCallback(() => {
    if (phase === "idle") {
      listen();
    } else if (phase === "listening") {
      recRef.current?.stop();
    } else if (phase === "speaking") {
      stopAudio();
      stopSpeaking();
      if (autoLoop) { loopTimer.current = setTimeout(listen, 500); }
      else setPhaseSync("idle");
    }
  }, [phase, listen, autoLoop]);

  const handleAutoLoop = useCallback(() => {
    setAutoLoop(true);
    listen();
  }, [listen]);

  useEffect(() => () => {
    recRef.current?.stop();
    stopAudio();
    stopSpeaking();
    if (loopTimer.current) clearTimeout(loopTimer.current);
  }, []);

  const btnColor = {
    idle: "bg-gray-700 hover:bg-gray-600",
    listening: "bg-red-600 shadow-[0_0_50px_rgba(239,68,68,0.5)]",
    thinking: "bg-blue-600 opacity-70",
    speaking: "bg-indigo-600 shadow-[0_0_50px_rgba(99,102,241,0.5)]",
  }[phase];

  const hint = {
    idle: "Toque para falar",
    listening: "Ouvindo… pare de falar para enviar",
    thinking: "Processando…",
    speaking: "Falando… toque para parar",
  }[phase];

  return (
    <div className="fixed inset-0 z-50 bg-[#080e08]/96 backdrop-blur-md flex flex-col items-center justify-between p-6">
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-indigo-400" />
          <span className="text-sm font-semibold text-gray-300">Modo Voz</span>
          {autoLoop && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-bold">
              AUTO
            </span>
          )}
        </div>
        <button onClick={() => { recRef.current?.stop(); stopAudio(); stopSpeaking(); if (loopTimer.current) clearTimeout(loopTimer.current); onClose(); }}
          className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full max-w-sm">
        <canvas ref={canvasRef} width={300} height={60} className="w-full opacity-90" />

        <div className="w-full min-h-[110px] flex flex-col items-center justify-center px-2 text-center gap-2">
          {phase === "thinking" && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={28} className="animate-spin text-blue-400" />
              <span className="text-[13px] text-blue-300">Pensando…</span>
            </div>
          )}
          {phase === "listening" && (
            <p className="text-white text-[15px] font-medium leading-snug min-h-[40px]">
              {heard || <span className="text-gray-500 italic">Ouvindo…</span>}
            </p>
          )}
          {phase === "speaking" && (
            <p className="text-indigo-200 text-[13px] leading-relaxed">{reply}</p>
          )}
          {phase === "idle" && heard && (
            <p className="text-gray-500 text-[12px]">"{heard}"</p>
          )}
          {err && <p className="text-red-400 text-[12px]">{err}</p>}
        </div>

        <button
          onClick={handleButton}
          disabled={phase === "thinking"}
          className={`w-28 h-28 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 ${btnColor}`}
        >
          {phase === "thinking" ? (
            <Loader2 size={40} className="text-white animate-spin" />
          ) : phase === "listening" ? (
            <Square size={36} className="text-white" />
          ) : phase === "speaking" ? (
            <Square size={36} className="text-white" />
          ) : (
            <Mic size={40} className="text-white" />
          )}
        </button>

        <p className={`text-[13px] font-medium ${
          phase === "listening" ? "text-red-400" :
          phase === "speaking"  ? "text-indigo-400" :
          phase === "thinking"  ? "text-blue-400" : "text-gray-500"
        }`}>{hint}</p>

        {phase === "idle" && (
          <button
            onClick={autoLoop ? () => { setAutoLoop(false); } : handleAutoLoop}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[13px] font-bold transition-all active:scale-95 ${
              autoLoop
                ? "bg-indigo-600/30 border border-indigo-500/50 text-indigo-300"
                : "bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/25"
            }`}
          >
            <Mic size={14} />
            {autoLoop ? "✓ Modo automático ativo" : "Modo automático (mãos-livres)"}
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-700 text-center">
        {autoLoop
          ? "Fale → pausa → IA responde → ouve de novo"
          : "Pressione · Fale · Pare de falar · IA responde"}
      </p>
    </div>
  );
}
