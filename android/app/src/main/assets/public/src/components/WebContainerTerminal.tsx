import { useState, useRef, useEffect, useCallback } from "react";
import { WebContainer, FileSystemTree, WebContainerProcess } from "@webcontainer/api";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Loader2, RotateCw, AlertTriangle } from "lucide-react";
import type { VirtualFileSystem } from "@/lib/virtual-fs";

interface Props {
  vfs: VirtualFileSystem;
  externalCommand?: string;
  onCommandExecuted?: () => void;
  onServerToggle?: (running: boolean, port?: number) => void;
}

let bootedInstance: WebContainer | null = null;
let bootingPromise: Promise<WebContainer> | null = null;

async function getOrBootWebContainer(): Promise<WebContainer> {
  if (bootedInstance) return bootedInstance;
  if (bootingPromise) return bootingPromise;
  bootingPromise = WebContainer.boot().then((wc) => {
    bootedInstance = wc;
    return wc;
  }).catch((e) => {
    bootingPromise = null;
    throw e;
  });
  return bootingPromise;
}

function vfsToTree(vfs: VirtualFileSystem): FileSystemTree {
  const tree: FileSystemTree = {};
  const files = vfs.listFiles();
  for (const path of files) {
    const parts = path.split("/").filter(Boolean);
    let node: any = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node[part]) node[part] = { directory: {} };
      if (!node[part].directory) node[part] = { directory: {} };
      node = node[part].directory;
    }
    const filename = parts[parts.length - 1];
    node[filename] = { file: { contents: vfs.readFile(path) ?? "" } };
  }
  if (Object.keys(tree).length === 0) {
    tree["README.md"] = { file: { contents: "# Projeto vazio\n\nUse o painel de arquivos pra criar seus arquivos.\n" } };
  }
  return tree;
}

export default function WebContainerTerminal({ vfs, externalCommand, onCommandExecuted, onServerToggle }: Props) {
  const [status, setStatus] = useState<"booting" | "ready" | "error" | "unsupported">("booting");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [bootKey, setBootKey] = useState(0); // incrementa em retry → reexecuta init
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wcRef = useRef<WebContainer | null>(null);
  const shellRef = useRef<WebContainerProcess | null>(null);
  const shellWriterRef = useRef<WritableStreamDefaultWriter | null>(null);
  const lastCmdRef = useRef<string | undefined>(undefined);
  const pendingCmdRef = useRef<string | undefined>(undefined);
  const mountedFilesRef = useRef<Set<string>>(new Set());
  const onServerToggleRef = useRef(onServerToggle);
  useEffect(() => { onServerToggleRef.current = onServerToggle; }, [onServerToggle]);

  // ─── Verifica suporte a SharedArrayBuffer (necessário pro WebContainer) ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = typeof SharedArrayBuffer !== "undefined" && (window as any).crossOriginIsolated;
    if (!supported) {
      setStatus("unsupported");
      setErrorMsg(
        "Seu navegador ou ambiente atual não permite o terminal real (precisa de cross-origin isolation). Use o modo Online ou Offline por enquanto, ou abra o app instalado/publicado — depois que o service worker registrar e o app for recarregado, geralmente passa a funcionar."
      );
    }
  }, []);

  // ─── Inicializa xterm + WebContainer ──────────────────────────────────────
  useEffect(() => {
    if (status === "unsupported") return;
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let serverReadyHandler: ((port: number, url: string) => void) | null = null;
    let portHandler: ((port: number, type: "open" | "close", url: string) => void) | null = null;
    let localShell: WebContainerProcess | null = null;
    let localXterm: XTerm | null = null;

    (async () => {
      try {
        if (!containerRef.current) return;

        // ── Cria o xterm ──
        const xterm = new XTerm({
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          cursorBlink: true,
          convertEol: true,
          theme: {
            background: "#0d1117",
            foreground: "#c9d1d9",
            cursor: "#58a6ff",
            black: "#484f58",
            red: "#ff7b72",
            green: "#7ee787",
            yellow: "#d29922",
            blue: "#58a6ff",
            magenta: "#bc8cff",
            cyan: "#39c5cf",
            white: "#b1bac4",
          },
        });
        const fit = new FitAddon();
        xterm.loadAddon(fit);
        xterm.loadAddon(new WebLinksAddon());
        xterm.open(containerRef.current);
        try { fit.fit(); } catch {}
        xtermRef.current = xterm;
        localXterm = xterm;
        fitRef.current = fit;

        xterm.writeln("\x1b[36m╔══════════════════════════════════════════╗\x1b[0m");
        xterm.writeln("\x1b[36m║   Terminal REAL — Node.js no navegador   ║\x1b[0m");
        xterm.writeln("\x1b[36m╚══════════════════════════════════════════╝\x1b[0m");
        xterm.writeln("\x1b[90mIniciando ambiente Node.js... aguarde alguns segundos\x1b[0m");
        xterm.writeln("");

        // ── Boota WebContainer (compartilhada entre instâncias) ──
        const wc = await getOrBootWebContainer();
        if (cancelled) return;
        wcRef.current = wc;

        // ── Monta arquivos do VFS ──
        const tree = vfsToTree(vfs);
        await wc.mount(tree);
        if (cancelled) return;
        mountedFilesRef.current = new Set(vfs.listFiles());

        // ── Detecta servidores HTTP iniciados ──
        serverReadyHandler = (port, url) => {
          xterm.writeln(`\x1b[32m✓ Servidor pronto na porta ${port} → ${url}\x1b[0m`);
          onServerToggleRef.current?.(true, port);
        };
        portHandler = (port, type) => {
          if (type === "close") onServerToggleRef.current?.(false, port);
        };
        wc.on("server-ready", serverReadyHandler);
        wc.on("port", portHandler);

        // ── Inicia shell jsh ──
        const shell = await wc.spawn("jsh", { terminal: { cols: xterm.cols, rows: xterm.rows } });
        if (cancelled) { try { shell.kill(); } catch {}; return; }
        shellRef.current = shell;
        localShell = shell;

        // Pipe shell → xterm
        shell.output.pipeTo(new WritableStream({
          write(chunk) { xterm.write(chunk); },
        })).catch(() => {});

        // Pipe xterm → shell
        const writer = shell.input.getWriter();
        shellWriterRef.current = writer;
        const dataDisposable = xterm.onData((data) => {
          writer.write(data).catch(() => {});
        });

        // Resize handler
        const onResize = () => {
          try {
            fit.fit();
            shell.resize({ cols: xterm.cols, rows: xterm.rows });
          } catch {}
        };
        resizeObs = new ResizeObserver(onResize);
        resizeObs.observe(containerRef.current);

        setStatus("ready");

        // Cleanup do data disposable se cancelar depois
        if (cancelled) { try { dataDisposable.dispose(); } catch {} }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setStatus("error");
        setErrorMsg(msg);
        try { localXterm?.writeln(`\x1b[31m✗ Erro ao iniciar: ${msg}\x1b[0m`); } catch {}
      }
    })();

    return () => {
      cancelled = true;
      try { resizeObs?.disconnect(); } catch {}
      // Remove listeners da instância compartilhada
      try {
        const wc = wcRef.current;
        if (wc) {
          if (serverReadyHandler) (wc as any).off?.("server-ready", serverReadyHandler);
          if (portHandler) (wc as any).off?.("port", portHandler);
        }
      } catch {}
      // Mata o shell
      try { localShell?.kill(); } catch {}
      try { shellRef.current?.kill(); } catch {}
      shellRef.current = null;
      // Libera o writer
      try { shellWriterRef.current?.releaseLock(); } catch {}
      shellWriterRef.current = null;
      // Disposa xterm
      try { localXterm?.dispose(); } catch {}
      try { xtermRef.current?.dispose(); } catch {}
      xtermRef.current = null;
      fitRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootKey, status === "unsupported"]);

  // ─── Sincroniza alterações do VFS com o filesystem do WebContainer ────────
  useEffect(() => {
    if (status !== "ready" || !wcRef.current) return;
    const unsubscribe = vfs.onChange(async () => {
      const wc = wcRef.current;
      if (!wc) return;
      const current = new Set(vfs.listFiles());
      // Adiciona/atualiza
      for (const path of current) {
        const content = vfs.readFile(path) ?? "";
        try {
          const parts = path.split("/");
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            try { await wc.fs.mkdir(dir, { recursive: true }); } catch {}
          }
          await wc.fs.writeFile(path, content);
        } catch {}
      }
      // Remove os que sumiram
      for (const oldPath of mountedFilesRef.current) {
        if (!current.has(oldPath)) {
          try { await wc.fs.rm(oldPath, { force: true }); } catch {}
        }
      }
      mountedFilesRef.current = current;
    });
    return () => { unsubscribe(); };
  }, [status, vfs]);

  // ─── Envia comando enfileirado quando o terminal ficar pronto ─────────────
  const trySendPending = useCallback(() => {
    const cmd = pendingCmdRef.current;
    const writer = shellWriterRef.current;
    if (!cmd || !writer) return;
    if (cmd === "clear") {
      xtermRef.current?.clear();
    } else {
      writer.write(cmd + "\n").catch(() => {});
    }
    pendingCmdRef.current = undefined;
    lastCmdRef.current = cmd;
    onCommandExecuted?.();
  }, [onCommandExecuted]);

  // ─── Executa comando externo (Rodar, Compilar, Painel de Pacotes etc.) ────
  useEffect(() => {
    if (!externalCommand || externalCommand === lastCmdRef.current) return;
    pendingCmdRef.current = externalCommand;
    if (status === "ready") trySendPending();
    // Se ainda não está ready, fica pendente e o próximo effect dispara
  }, [externalCommand, status, trySendPending]);

  // Quando ficar ready, dispara comando pendente
  useEffect(() => {
    if (status === "ready") trySendPending();
  }, [status, trySendPending]);

  const handleRetry = useCallback(() => {
    setErrorMsg("");
    setStatus("booting");
    bootedInstance = null;
    bootingPromise = null;
    setBootKey((k) => k + 1);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117] relative">
      {status === "unsupported" && (
        <div className="absolute inset-0 flex items-center justify-center p-4 z-10 bg-[#0d1117]/95">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle className="mx-auto text-amber-400" size={36} />
            <p className="text-amber-200 font-bold">Terminal Real precisa de recarregamento</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              O ambiente de segurança (COOP/COEP) necessário pro Node.js no navegador
              precisa ser aplicado via recarregamento de página.
              Clique no botão abaixo — resolve na maioria dos casos.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mx-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors"
            >
              <RotateCw size={14} /> Recarregar Página
            </button>
            <p className="text-gray-600 text-[11px]">
              Se após recarregar ainda não funcionar: abra a versão publicada (.replit.app) diretamente
              no navegador (não em iframe/preview). Em previews embutidos pode não funcionar.
            </p>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-[11px] font-bold hover:bg-red-600/30"
          >
            <RotateCw size={11} /> Tentar de novo
          </button>
        </div>
      )}
      {status === "booting" && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold">
          <Loader2 size={11} className="animate-spin" />
          Iniciando Node.js...
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 p-2" style={{ minHeight: 0 }} />
    </div>
  );
}
