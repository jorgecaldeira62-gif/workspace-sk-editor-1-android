import { useCallback, useEffect, useState } from "react";
import { X, RefreshCw, Check, AlertTriangle, XCircle, Wifi, WifiOff, Cpu, HardDrive, Shield, Bot, Server, Package } from "lucide-react";
import { VirtualFileSystem } from "@/lib/virtual-fs";

type Status = "ok" | "warn" | "error" | "checking";

interface CheckItem {
  id: string;
  label: string;
  status: Status;
  detail: string;
  icon: React.ReactNode;
}

interface Props {
  open: boolean;
  onClose: () => void;
  vfs: VirtualFileSystem;
  projectName: string;
  terminalMode: "online" | "offline" | "real";
}

const StatusBadge = ({ s }: { s: Status }) => {
  if (s === "ok") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 text-[11px] md:text-[13px] font-bold">
      <Check size={12} /> OK
    </span>
  );
  if (s === "warn") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 text-[11px] md:text-[13px] font-bold">
      <AlertTriangle size={12} /> Atenção
    </span>
  );
  if (s === "error") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 text-[11px] md:text-[13px] font-bold">
      <XCircle size={12} /> Falha
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-500/15 text-gray-400 text-[11px] md:text-[13px] font-bold">
      <RefreshCw size={12} className="animate-spin" /> Checando…
    </span>
  );
};

export default function SystemStatusPanel({ open, onClose, vfs, projectName, terminalMode }: Props) {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const runChecks = useCallback(async () => {
    setIsChecking(true);

    const items: CheckItem[] = [];

    // 1. Conexão internet básica
    items.push({
      id: "online",
      label: "Conexão à internet",
      status: navigator.onLine ? "ok" : "error",
      detail: navigator.onLine ? "Online" : "Sem rede — só modo Offline funciona",
      icon: navigator.onLine ? <Wifi size={16} className="text-green-400" /> : <WifiOff size={16} className="text-red-400" />,
    });

    // 2. Servidor da API (Online terminal + IA fetch)
    let apiStatus: Status = "checking";
    let apiDetail = "Testando…";
    const apiStart = performance.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("/api/healthz", { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      const ms = Math.round(performance.now() - apiStart);
      if (r.ok) {
        apiStatus = "ok";
        apiDetail = `Servidor respondendo (${ms}ms) — terminal Online e IA funcionam`;
      } else {
        apiStatus = "warn";
        apiDetail = `Servidor respondeu HTTP ${r.status} — pode ter problema`;
      }
    } catch (e: any) {
      apiStatus = "error";
      apiDetail = `Sem servidor — terminal Online e IA fetch indisponíveis (${e.message || "timeout"})`;
    }
    items.push({
      id: "api",
      label: "Servidor da API",
      status: apiStatus,
      detail: apiDetail,
      icon: <Server size={16} className="text-blue-400" />,
    });

    // 3. Cross-origin isolation (necessário para WebContainer / terminal Real)
    const coi = (window as any).crossOriginIsolated === true;
    const sab = typeof SharedArrayBuffer !== "undefined";
    items.push({
      id: "coi",
      label: "Cross-Origin Isolation",
      status: coi && sab ? "ok" : "warn",
      detail: coi && sab
        ? "Habilitado — terminal Real (WebContainer) pode rodar"
        : "Desabilitado — terminal Real não funciona aqui (precisa do app publicado/instalado como APK)",
      icon: <Shield size={16} className={coi && sab ? "text-green-400" : "text-yellow-400"} />,
    });

    // 4. Service Worker (PWA + injeção de COOP/COEP)
    let swStatus: Status = "checking";
    let swDetail = "Verificando…";
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.active) {
          swStatus = "ok";
          swDetail = `Ativo — escopo ${reg.scope}`;
        } else if (reg) {
          swStatus = "warn";
          swDetail = "Registrado mas não ativo — recarregue a página";
        } else {
          swStatus = "warn";
          swDetail = "Não registrado — instale como PWA pra ativar";
        }
      } catch {
        swStatus = "error";
        swDetail = "Erro ao verificar service worker";
      }
    } else {
      swStatus = "error";
      swDetail = "Browser não suporta service worker";
    }
    items.push({
      id: "sw",
      label: "Service Worker (PWA)",
      status: swStatus,
      detail: swDetail,
      icon: <Cpu size={16} className="text-purple-400" />,
    });

    // 5. Modo PWA standalone
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    items.push({
      id: "pwa",
      label: "Modo App Instalado (PWA)",
      status: isStandalone ? "ok" : "warn",
      detail: isStandalone
        ? "Rodando como app instalado — máxima compatibilidade"
        : "Rodando no browser — instale como PWA/APK pra melhor desempenho",
      icon: <span className="text-[16px]">{isStandalone ? "📱" : "🌐"}</span>,
    });

    // 6. Terminal atual em uso
    const tmLabel = terminalMode === "online" ? "Online (servidor remoto)"
      : terminalMode === "real" ? "Real (WebContainer no browser)"
      : "Offline (simulado)";
    const tmStatus: Status = terminalMode === "offline" ? "warn" : "ok";
    const tmDetail = terminalMode === "offline"
      ? "Modo simulado — npm install só atualiza package.json (não baixa código)"
      : terminalMode === "online"
        ? "Comandos rodam no servidor Linux real — npm install funciona de verdade"
        : "Node.js de verdade no browser — npm install funciona offline (precisa COI)";
    items.push({
      id: "term",
      label: "Terminal em uso",
      status: tmStatus,
      detail: tmDetail + ` · ativo: ${tmLabel}`,
      icon: <span className="text-[16px]">⬛</span>,
    });

    // 7. IA built-in proxy — testa GET (deve dar 404/405 se viva, erro de rede se morta)
    let aiStatus: Status = "checking";
    let aiDetail = "Testando proxy da Jasmim…";
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("/api/ai/chat", { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      // 405 (method not allowed) ou 400 (bad request) = endpoint vivo
      if (r.status === 405 || r.status === 400 || r.ok) {
        aiStatus = "ok";
        aiDetail = `Endpoint /api/ai/chat respondendo (HTTP ${r.status}) — Jasmim deve funcionar`;
      } else if (r.status === 404) {
        aiStatus = "error";
        aiDetail = "Endpoint /api/ai/chat não existe — Jasmim não vai responder";
      } else {
        aiStatus = "warn";
        aiDetail = `IA respondeu HTTP ${r.status}`;
      }
    } catch (e: any) {
      aiStatus = "error";
      aiDetail = `IA built-in indisponível (${e.message || "erro"}) — Jasmim não vai responder`;
    }
    items.push({
      id: "ai",
      label: "Jasmim (IA built-in)",
      status: aiStatus,
      detail: aiDetail,
      icon: <Bot size={16} className="text-purple-300" />,
    });

    // 8. Armazenamento local
    let storageStatus: Status = "checking";
    let storageDetail = "Calculando…";
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const est = await navigator.storage.estimate();
        const usedMB = ((est.usage || 0) / 1024 / 1024).toFixed(1);
        const quotaMB = ((est.quota || 0) / 1024 / 1024).toFixed(0);
        const pct = est.quota ? (((est.usage || 0) / est.quota) * 100).toFixed(1) : "?";
        storageStatus = est.quota && (est.usage || 0) / est.quota > 0.8 ? "warn" : "ok";
        storageDetail = `${usedMB} MB usados de ${quotaMB} MB (${pct}%)`;
      } else {
        storageStatus = "warn";
        storageDetail = "Browser não expõe info de armazenamento";
      }
    } catch {
      storageStatus = "warn";
      storageDetail = "Não consegui verificar";
    }
    items.push({
      id: "storage",
      label: "Armazenamento local",
      status: storageStatus,
      detail: storageDetail,
      icon: <HardDrive size={16} className="text-orange-400" />,
    });

    // 9. Projeto atual + arquivos
    const fileCount = vfs.listFiles().length;
    let pkgInfo = "";
    try {
      const pkgRaw = vfs.readFile("package.json");
      if (pkgRaw) {
        const pkg = JSON.parse(pkgRaw);
        const deps = Object.keys(pkg.dependencies || {}).length;
        const devDeps = Object.keys(pkg.devDependencies || {}).length;
        pkgInfo = ` · ${deps} dependência(s), ${devDeps} dev`;
      }
    } catch {}
    items.push({
      id: "proj",
      label: "Projeto atual",
      status: "ok",
      detail: `${projectName} · ${fileCount} arquivo(s)${pkgInfo}`,
      icon: <Package size={16} className="text-cyan-400" />,
    });

    setChecks(items);
    setLastCheck(new Date());
    setIsChecking(false);
  }, [vfs, projectName, terminalMode]);

  useEffect(() => {
    if (open) runChecks();
  }, [open, runChecks]);

  if (!open) return null;

  const okCount = checks.filter(c => c.status === "ok").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const errorCount = checks.filter(c => c.status === "error").length;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3 md:p-6" onClick={onClose}>
      <div
        className="bg-[#0d1409] border border-gray-700 rounded-2xl w-full max-w-[640px] md:max-w-[820px] max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-[18px] md:text-[22px]">🩺</span>
            </div>
            <div>
              <h2 className="text-[14px] md:text-[18px] font-bold text-white">Status do Sistema ao Vivo</h2>
              <p className="text-[10px] md:text-[12px] text-gray-500">
                {lastCheck ? `Atualizado às ${lastCheck.toLocaleTimeString("pt-BR")}` : "Carregando…"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-500"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-gray-800">
          <div className="flex flex-col items-center justify-center bg-green-500/10 border border-green-500/30 rounded-xl py-2 md:py-3">
            <span className="text-[20px] md:text-[28px] font-bold text-green-400">{okCount}</span>
            <span className="text-[10px] md:text-[12px] text-green-300">funcionando</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-yellow-500/10 border border-yellow-500/30 rounded-xl py-2 md:py-3">
            <span className="text-[20px] md:text-[28px] font-bold text-yellow-400">{warnCount}</span>
            <span className="text-[10px] md:text-[12px] text-yellow-300">atenção</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-red-500/10 border border-red-500/30 rounded-xl py-2 md:py-3">
            <span className="text-[20px] md:text-[28px] font-bold text-red-400">{errorCount}</span>
            <span className="text-[10px] md:text-[12px] text-red-300">falhas</span>
          </div>
        </div>

        {/* Lista de checagens */}
        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-2 md:py-3">
          {checks.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-[13px] md:text-[15px]">
              <RefreshCw size={32} className="mx-auto mb-2 animate-spin text-blue-400" />
              Verificando tudo…
            </div>
          )}
          {checks.map((c) => (
            <div key={c.id} className="flex items-start gap-3 py-2.5 md:py-3 border-b border-gray-800/60 last:border-b-0">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[13px] md:text-[15px] font-bold text-gray-200">{c.label}</h3>
                  <StatusBadge s={c.status} />
                </div>
                <p className="text-[11px] md:text-[14px] text-gray-400 leading-snug mt-0.5 md:mt-1 break-words">
                  {c.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer com Atualizar */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-700/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-3">
          <p className="text-[10px] md:text-[12px] text-gray-600 leading-snug">
            Clique em <strong className="text-blue-400">Atualizar</strong> sempre que mudar algo (rede, modo, instalação) pra ver o estado real.
          </p>
          <button
            onClick={runChecks}
            disabled={isChecking}
            className="flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 active:scale-95 text-white font-bold text-[13px] md:text-[15px] transition-all shrink-0"
          >
            <RefreshCw size={16} className={isChecking ? "animate-spin" : ""} />
            {isChecking ? "Atualizando…" : "Atualizar agora"}
          </button>
        </div>
      </div>
    </div>
  );
}
