import React, { useState, useCallback } from "react";
import {
  X, Globe, GitBranch, Download, CheckCircle, AlertCircle,
  ExternalLink, Copy, RefreshCw, Folder, FolderOpen, Rocket,
  HardDrive, Package, FileCode, Info, BookOpen, Eye, Server,
  Layers, CreditCard, ChevronDown, ChevronRight,
} from "lucide-react";

interface DeployPanelProps {
  onClose: () => void;
  projectName: string;
  files: Record<string, string>;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function copyText(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      {label && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</p>}
      <div className="relative bg-[#070d04] border border-gray-800/60 rounded-xl overflow-hidden">
        <pre className="text-[11px] font-mono text-green-300 px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{code}</pre>
        <button
          onClick={() => { copyText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 text-gray-400 hover:text-gray-200 transition-all"
        >
          {copied ? <CheckCircle size={11} className="text-green-400" /> : <Copy size={11} />}
        </button>
      </div>
    </div>
  );
}

// ─── Gerador de ZIPs ─────────────────────────────────────────────────────────

type Platform = "github-pages" | "vercel" | "netlify" | "vps" | "backup";

interface PlatformConfig {
  id: Platform;
  label: string;
  icon: string;
  color: string;
  desc: string;
  extraFiles: (files: Record<string, string>, name: string) => Record<string, string>;
  instructions: string[];
  deployUrl?: string;
  terminalCmds?: string[];
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "github-pages",
    label: "GitHub Pages",
    icon: "🐙",
    color: "gray",
    desc: "Hospedagem gratuita para sites estáticos direto do repositório GitHub",
    extraFiles: (files, name) => {
      const hasIndex = Object.keys(files).some(f => f === "index.html" || f.endsWith("/index.html"));
      const extra: Record<string, string> = {};
      extra[".nojekyll"] = "";
      if (!hasIndex) {
        extra["index.html"] = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title></head><body><h1>${name}</h1><p>Projeto em construção.</p></body></html>`;
      }
      extra[".github/workflows/pages.yml"] = `name: Deploy GitHub Pages\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read\n  pages: write\n  id-token: write\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment:\n      name: github-pages\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/configure-pages@v4\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: .\n      - uses: actions/deploy-pages@v4\n`;
      return extra;
    },
    instructions: [
      "Extraia o ZIP numa pasta no PC",
      "Abra o terminal nessa pasta: git init && git add . && git commit -m 'inicial'",
      "Crie um repositório no github.com (pode ser privado ou público)",
      "git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git",
      "git push -u origin main",
      "No GitHub: Settings → Pages → Source: GitHub Actions",
      "Aguarde 2 min — seu site estará em: https://SEU_USUARIO.github.io/SEU_REPO",
    ],
    deployUrl: "https://github.com/new",
    terminalCmds: [
      "git init",
      "git add .",
      'git commit -m "deploy inicial"',
      "git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git",
      "git push -u origin main",
    ],
  },
  {
    id: "vercel",
    label: "Vercel",
    icon: "▲",
    color: "blue",
    desc: "Deploy instantâneo com URL pública — ideal para apps React, Next.js e sites estáticos",
    extraFiles: (_files, name) => ({
      "vercel.json": JSON.stringify({
        name: name.toLowerCase().replace(/\s+/g, "-"),
        version: 2,
        builds: [{ src: "**/*", use: "@vercel/static" }],
        routes: [{ src: "/(.*)", dest: "/$1" }],
      }, null, 2),
    }),
    instructions: [
      "Extraia o ZIP numa pasta no PC",
      "Instale a CLI da Vercel: npm install -g vercel",
      "Na pasta do projeto: vercel login",
      "Execute: vercel --prod",
      "Siga as perguntas (nome do projeto, diretório raiz: ./)",
      "Seu site estará online em segundos com URL https://SEU_PROJETO.vercel.app",
    ],
    deployUrl: "https://vercel.com/new",
    terminalCmds: [
      "npm install -g vercel",
      "vercel login",
      "vercel --prod",
    ],
  },
  {
    id: "netlify",
    label: "Netlify",
    icon: "🔷",
    color: "teal",
    desc: "Drag-and-drop ou CLI — sem configuração, funciona com qualquer site estático",
    extraFiles: (_files, name) => ({
      "netlify.toml": `[build]\n  publish = "."\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n`,
      "_redirects": "/*    /index.html    200",
    }),
    instructions: [
      "Extraia o ZIP numa pasta no PC",
      "OPÇÃO 1 — Arrasta e solta: acesse app.netlify.com → 'Add new site' → 'Deploy manually' → arraste a pasta",
      "OPÇÃO 2 — CLI: npm install -g netlify-cli",
      "netlify login",
      "netlify deploy --prod --dir .",
      "Seu site estará em https://NOME_ALEATORIO.netlify.app",
    ],
    deployUrl: "https://app.netlify.com/drop",
    terminalCmds: [
      "npm install -g netlify-cli",
      "netlify login",
      "netlify deploy --prod --dir .",
    ],
  },
  {
    id: "vps",
    label: "VPS / Servidor",
    icon: "🖥️",
    color: "amber",
    desc: "Para rodar em servidor Linux próprio (DigitalOcean, AWS, Oracle Free Tier, etc.)",
    extraFiles: (_files, name) => ({
      "start.sh": `#!/bin/bash\n# Servidor local para ${name}\necho "Iniciando ${name}..."\n\n# Opção 1: Python (sempre disponível no Linux)\npython3 -m http.server 3000\n\n# Opção 2: Node.js (descomente se preferir)\n# npx serve . -p 3000\n\n# Opção 3: Nginx (descomente se tiver nginx instalado)\n# nginx -c nginx.conf\n`,
      "nginx.conf": `server {\n    listen 80;\n    root /var/www/${name.toLowerCase().replace(/\s+/g, "-")};\n    index index.html;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}\n`,
      "Dockerfile": `FROM nginx:alpine\nCOPY . /usr/share/nginx/html\nEXPOSE 80\nCMD ["nginx", "-g", "daemon off;"]\n`,
      "docker-compose.yml": `version: '3'\nservices:\n  web:\n    build: .\n    ports:\n      - "80:80"\n    restart: unless-stopped\n`,
    }),
    instructions: [
      "Envie a pasta para o servidor via: scp -r . usuario@IP:/var/www/meu-site",
      "Ou use rsync: rsync -avz ./ usuario@IP:/var/www/meu-site/",
      "OPÇÃO RÁPIDA: docker-compose up -d (precisa de Docker instalado)",
      "OPÇÃO PYTHON: python3 -m http.server 3000 (roda na porta 3000)",
      "OPÇÃO NGINX: copie nginx.conf para /etc/nginx/sites-available/ e reinicie o nginx",
      "Abra a porta 80 ou 3000 no firewall do servidor",
    ],
    terminalCmds: [
      "# Enviar para servidor\nscp -r . usuario@SEU_IP:/var/www/meu-site",
      "# OU usar Docker\ndocker-compose up -d",
      "# OU rodar localmente\npython3 -m http.server 3000",
    ],
  },
  {
    id: "backup",
    label: "Backup Limpo",
    icon: "💾",
    color: "purple",
    desc: "ZIP limpo só com os arquivos do projeto — sem node_modules, sem .git",
    extraFiles: (_files, name) => ({
      "LEIA-ME.txt": `Projeto: ${name}\nData do backup: ${new Date().toLocaleString("pt-BR")}\n\nEste ZIP contém todos os arquivos do projeto.\nPara restaurar:\n1. Extraia o ZIP numa pasta\n2. Abra o terminal na pasta\n3. Se tiver package.json: npm install\n4. Para rodar: npm start (ou node index.js, ou python3 app.py)\n\nPara importar de volta no SK Editor:\n1. Abra o SK Editor\n2. Painel de Arquivos → ··· → Importar ZIP\n3. Selecione este arquivo\n`,
    }),
    instructions: [
      "Este é um backup completo do seu projeto",
      "Guarde em local seguro (HD externo, Google Drive, etc.)",
      "Para restaurar: importe o ZIP no SK Editor (Painel de Arquivos → ···)",
      "Ou extraia manualmente e use em qualquer editor (VS Code, etc.)",
    ],
  },
];

// ─── Gerador de ZIP puro em JavaScript (sem dependências externas) ────────────

function uint32LE(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}
function uint16LE(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff];
}

function crc32(data: Uint8Array): number {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...uint16LE(20),
      ...uint16LE(0),
      ...uint16LE(0),
      ...uint16LE(0), ...uint16LE(0),
      ...uint32LE(crc),
      ...uint32LE(entry.data.length),
      ...uint32LE(entry.data.length),
      ...uint16LE(nameBytes.length),
      ...uint16LE(0),
      ...nameBytes,
      ...entry.data,
    ]);
    offsets.push(offset);
    localHeaders.push(local);
    offset += local.length;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const cd = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      ...uint16LE(20), ...uint16LE(20),
      ...uint16LE(0), ...uint16LE(0), ...uint16LE(0),
      ...uint16LE(0), ...uint16LE(0),
      ...uint32LE(crc),
      ...uint32LE(entry.data.length),
      ...uint32LE(entry.data.length),
      ...uint16LE(nameBytes.length),
      ...uint16LE(0), ...uint16LE(0), ...uint16LE(0), ...uint16LE(0),
      ...uint32LE(0),
      ...uint32LE(offsets[i]),
      ...nameBytes,
    ]);
    centralDirs.push(cd);
  }

  const centralDirOffset = offset;
  const centralDirSize = centralDirs.reduce((s, b) => s + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...uint16LE(0), ...uint16LE(0),
    ...uint16LE(entries.length), ...uint16LE(entries.length),
    ...uint32LE(centralDirSize),
    ...uint32LE(centralDirOffset),
    ...uint16LE(0),
  ]);

  const parts = [...localHeaders, ...centralDirs, eocd];
  const total = parts.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

function buildZipBlob(files: Record<string, string>, extraFiles: Record<string, string>): { blob: Blob; base64: string } {
  const enc = new TextEncoder();
  const allFiles = { ...files, ...extraFiles };
  const SKIP = ["node_modules", ".git/", ".DS_Store", "Thumbs.db"];

  const entries: { name: string; data: Uint8Array }[] = [];
  for (const [name, content] of Object.entries(allFiles)) {
    if (SKIP.some(s => name.includes(s))) continue;
    if (!content && content !== "") continue;
    entries.push({ name, data: enc.encode(content) });
  }

  const zipBytes = buildZip(entries);
  const blob = new Blob([zipBytes], { type: "application/zip" });
  
  // Converter para base64 para enviar ao Electron
  let binary = "";
  zipBytes.forEach(b => binary += String.fromCharCode(b));
  const base64 = btoa(binary);
  
  return { blob, base64 };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DeployPanel({ onClose, projectName, files }: DeployPanelProps) {
  const [selected, setSelected] = useState<Platform>("github-pages");
  const [status, setStatus] = useState<"idle" | "building" | "done" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [tab, setTab] = useState<"deploy" | "disk" | "git" | "guia">("guia");
  const [guiaOpen, setGuiaOpen] = useState<Record<string, boolean>>({
    preview: true, servidor: false, deploy_url: false, saas: false,
  });
  const [diskProjects, setDiskProjects] = useState<{ name: string; updatedAt: number; fileCount: number; filePath: string }[]>([]);
  const [diskLoading, setDiskLoading] = useState(false);
  const [diskStatus, setDiskStatus] = useState<string | null>(null);
  const [autoSaveOn, setAutoSaveOn] = useState(() => {
    try { return localStorage.getItem("sk-autosave-disk") === "1"; } catch { return false; }
  });

  const isElectron = !!(window as any).electronAPI?.isElectron;
  const electronFS = (window as any).electronAPI?.fs;

  const platform = PLATFORMS.find(p => p.id === selected)!;

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  // ─── Build e Download do ZIP ────────────────────────────────────────────────

  const handleBuild = useCallback(async () => {
    setStatus("building");
    setLog([]);
    setSavedPath(null);
    addLog(`🔨 Gerando ZIP para ${platform.label}...`);

    try {
      const fileCount = Object.keys(files).filter(f => !f.includes("node_modules") && !f.includes(".git/")).length;
      addLog(`📁 ${fileCount} arquivo(s) encontrado(s)`);

      const extraFiles = platform.extraFiles(files, projectName);
      const extraCount = Object.keys(extraFiles).length;
      if (extraCount > 0) addLog(`➕ Adicionando ${extraCount} arquivo(s) de configuração para ${platform.label}`);

      addLog("🗜️ Compactando...");
      const { blob, base64 } = buildZipBlob(files, extraFiles);
      addLog(`✅ ZIP gerado — ${(blob.size / 1024).toFixed(1)} KB`);

      // Se Electron: oferecer salvar no disco via diálogo nativo
      if (isElectron && electronFS) {
        addLog("💾 Abrindo diálogo para salvar no PC...");
        const result = await electronFS.exportZip(projectName, base64, platform.id);
        if (result.ok) {
          setSavedPath(result.path);
          addLog(`✅ Salvo em: ${result.path}`);
          setStatus("done");
        } else if (result.canceled) {
          addLog("⚠️ Cancelado pelo usuário");
          // Oferece baixar pelo navegador mesmo assim
          downloadBlob(blob);
          addLog("⬇️ Download iniciado pelo navegador");
          setStatus("done");
        } else {
          addLog(`❌ Erro ao salvar: ${result.error}`);
          downloadBlob(blob);
          addLog("⬇️ Fallback: download pelo navegador");
          setStatus("done");
        }
      } else {
        // Web: baixar direto
        downloadBlob(blob);
        addLog("⬇️ Download iniciado");
        setStatus("done");
      }
    } catch (e: any) {
      addLog(`❌ Erro: ${e.message}`);
      setStatus("error");
    }
  }, [files, projectName, platform, isElectron, electronFS]);

  function downloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = projectName.replace(/[^a-zA-Z0-9_\-]/g, "_");
    a.href = url;
    a.download = `${safeName}-${selected}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ─── Aba Disco — Salvar/Carregar projetos no PC ─────────────────────────────

  const loadDiskProjects = useCallback(async () => {
    if (!electronFS) return;
    setDiskLoading(true);
    const result = await electronFS.listProjects();
    setDiskProjects(result.projects || []);
    setDiskLoading(false);
  }, [electronFS]);

  const handleSaveToDisk = useCallback(async () => {
    if (!electronFS) return;
    setDiskStatus("Salvando...");
    const result = await electronFS.saveProject(projectName, files);
    if (result.ok) {
      setDiskStatus(`✅ Salvo em: ${result.path}`);
      loadDiskProjects();
    } else {
      setDiskStatus(`❌ Erro: ${result.error}`);
    }
  }, [electronFS, projectName, files, loadDiskProjects]);

  const toggleAutoSave = useCallback(() => {
    const next = !autoSaveOn;
    setAutoSaveOn(next);
    try { localStorage.setItem("sk-autosave-disk", next ? "1" : "0"); } catch {}
  }, [autoSaveOn]);

  const colorMap: Record<string, string> = {
    gray: "border-gray-500/40 bg-gray-800/20 text-gray-300",
    blue: "border-blue-500/40 bg-blue-900/20 text-blue-300",
    teal: "border-teal-500/40 bg-teal-900/20 text-teal-300",
    amber: "border-amber-500/40 bg-amber-900/20 text-amber-300",
    purple: "border-purple-500/40 bg-purple-900/20 text-purple-300",
  };

  const activeColor = colorMap[platform.color] || colorMap.gray;

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0d0d0d] border-t-2 border-green-700/40 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">

          {/* Header */}
          <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <Rocket size={16} className="text-green-400" />
              <p className="text-[15px] font-bold text-white">Deploy & Backup</p>
              <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">{projectName}</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-600"><X size={17} /></button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700/30 shrink-0 overflow-x-auto">
            {[
              { id: "guia", label: "📖 Guia", icon: <BookOpen size={13} /> },
              { id: "deploy", label: "🚀 Deploy", icon: <Globe size={13} /> },
              { id: "disk", label: "💾 Disco", icon: <HardDrive size={13} />, onlyElectron: true },
              { id: "git", label: "🐙 Git", icon: <GitBranch size={13} /> },
            ].map(t => (
              (!t.onlyElectron || isElectron) && (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-bold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? "border-green-500 text-green-300" : "border-transparent text-gray-500 hover:text-gray-300"}`}
                >
                  {t.icon}{t.label}
                </button>
              )
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ═══ ABA GUIA COMPLETO ══════════════════════════════════════════════ */}
            {tab === "guia" && (() => {
              const toggle = (k: string) => setGuiaOpen(prev => ({ ...prev, [k]: !prev[k] }));
              const Section = ({ id, icon, title, badge, children }: { id: string; icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) => (
                <div className="border border-gray-700/40 rounded-xl overflow-hidden">
                  <button onClick={() => toggle(id)} className="w-full flex items-center gap-2 px-4 py-3 bg-[#0d1309] hover:bg-[#111f0a] transition-colors text-left">
                    <span className="text-green-400 shrink-0">{icon}</span>
                    <span className="flex-1 text-[13px] font-bold text-gray-200">{title}</span>
                    {badge && <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-700/30 text-green-400 font-bold border border-green-600/30">{badge}</span>}
                    {guiaOpen[id] ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
                  </button>
                  {guiaOpen[id] && <div className="px-4 pb-4 pt-2 bg-[#0a1007] space-y-3">{children}</div>}
                </div>
              );
              const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
                <div className="flex gap-2.5 text-[11px] text-gray-300 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-green-700/40 border border-green-600/30 text-green-400 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                  <span className="flex-1">{children}</span>
                </div>
              );
              const Tip = ({ children }: { children: React.ReactNode }) => (
                <div className="flex gap-2 bg-blue-950/30 border border-blue-700/30 rounded-lg px-3 py-2">
                  <span className="text-blue-400 text-[11px] shrink-0">💡</span>
                  <p className="text-[10px] text-gray-400 leading-relaxed">{children}</p>
                </div>
              );
              const Warn = ({ children }: { children: React.ReactNode }) => (
                <div className="flex gap-2 bg-amber-950/20 border border-amber-700/30 rounded-lg px-3 py-2">
                  <span className="text-amber-400 text-[11px] shrink-0">⚠️</span>
                  <p className="text-[10px] text-gray-400 leading-relaxed">{children}</p>
                </div>
              );
              const Link = ({ href, label }: { href: string; label: string }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-400 underline hover:text-blue-300">
                  <ExternalLink size={10} /> {label}
                </a>
              );
              return (
                <div className="p-4 space-y-3">
                  {/* Cabeçalho */}
                  <div className="bg-gradient-to-r from-gray-800/30 to-blue-900/20 border border-green-700/30 rounded-xl p-4">
                    <p className="text-[15px] font-bold text-white mb-1">📖 Guia Completo de Ponta a Ponta</p>
                    <p className="text-[11px] text-gray-400">Tudo que você precisa saber: preview, servidor, deploy com URL e versão SaaS. Clique em cada seção para expandir.</p>
                  </div>

                  {/* 1. PREVIEW */}
                  <Section id="preview" icon={<Eye size={15} />} title="1. Como visualizar / fazer preview do app" badge="Comece aqui">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Existem 3 formas de ver o app rodando antes de publicar:
                    </p>
                    <div className="space-y-3">
                      <div className="bg-[#111f0a] border border-green-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-green-300 mb-1.5">🖥️ Opção A — Rodar pelo terminal (mais fácil)</p>
                        <p className="text-[10px] text-gray-400 mb-2">Ideal para quem tem Node.js instalado no PC. Extraia o ZIP do projeto e:</p>
                        <CodeBlock label="Terminal na pasta do projeto" code={`npm install\nnpm run dev\n# O terminal vai mostrar: http://localhost:5173\n# Abra esse endereço no navegador`} />
                        <div className="mt-2 space-y-1.5">
                          <Tip>Se não tiver Node.js: baixe em <Link href="https://nodejs.org" label="nodejs.org" /> — versão LTS.</Tip>
                        </div>
                      </div>
                      <div className="bg-[#0d0d1f] border border-blue-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-blue-300 mb-1.5">🌐 Opção B — Deploy de teste gratuito (Vercel)</p>
                        <p className="text-[10px] text-gray-400 mb-2">Coloca o app online em 2 minutos para você ver e compartilhar:</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Crie conta grátis em <Link href="https://vercel.com" label="vercel.com" /></Step>
                          <Step n={2}>Clique em "Add New Project" → "Import from GitHub"</Step>
                          <Step n={3}>Conecte seu GitHub e selecione o repositório</Step>
                          <Step n={4}>Clique em Deploy — pronto, URL gerada em ~1 min</Step>
                        </div>
                        <Tip>Vercel gera uma URL tipo <strong>seu-projeto.vercel.app</strong> — funciona de verdade, pode compartilhar.</Tip>
                      </div>
                      <div className="bg-[#1a1008] border border-amber-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-amber-300 mb-1.5">📱 Opção C — App Desktop (Electron)</p>
                        <p className="text-[10px] text-gray-400">Baixe o executável na aba Downloads. O próprio app abre e você vê tudo funcionando sem instalar nada extra. O Terminal dentro do app tem acesso real ao PC.</p>
                      </div>
                    </div>
                  </Section>

                  {/* 2. SERVIDOR/BACKEND */}
                  <Section id="servidor" icon={<Server size={15} />} title="2. Como conectar a um servidor / banco de dados" badge="Backend">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      O app que você cria aqui é o <strong className="text-gray-200">frontend</strong> (o que o usuário vê). Para salvar dados, fazer login, etc., você precisa de um <strong className="text-gray-200">backend/servidor</strong>.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-[#0d1a0d] border border-green-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-green-300 mb-2">🗄️ Banco de Dados — Neon (PostgreSQL gratuito)</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Crie conta grátis em <Link href="https://neon.tech" label="neon.tech" /></Step>
                          <Step n={2}>Crie um banco e copie a "Connection String"</Step>
                          <Step n={3}>Cole a string no painel "Banco de Dados" do SK Editor</Step>
                          <Step n={4}>Execute SQL direto pelo painel — sem precisar de servidor</Step>
                        </div>
                        <Tip>O SK Editor tem um painel de banco de dados integrado. Clique no ícone 🗄️ na barra lateral.</Tip>
                      </div>
                      <div className="bg-[#0d0d1f] border border-purple-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-purple-300 mb-2">⚡ API própria — Servidor Node.js/Express</p>
                        <p className="text-[10px] text-gray-400 mb-2">Para fazer um backend completo com suas regras de negócio:</p>
                        <CodeBlock label="Instale e crie o servidor" code={`npm install express cors dotenv\n# Crie o arquivo server.js na raiz do projeto`} />
                        <CodeBlock label="server.js básico" code={`const express = require('express');\nconst cors = require('cors');\nconst app = express();\n\napp.use(cors());\napp.use(express.json());\n\n// Sua rota de API\napp.get('/api/dados', (req, res) => {\n  res.json({ mensagem: 'Servidor funcionando!' });\n});\n\napp.listen(3001, () => console.log('Servidor na porta 3001'));`} />
                        <CodeBlock label="No seu React, chamar a API" code={`const resposta = await fetch('http://localhost:3001/api/dados');\nconst dados = await resposta.json();\nconsole.log(dados.mensagem);`} />
                      </div>
                      <div className="bg-[#1a0d0d] border border-red-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-red-300 mb-2">🔴 Supabase — banco + autenticação + storage tudo junto</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Crie conta em <Link href="https://supabase.com" label="supabase.com" /> — grátis</Step>
                          <Step n={2}>Crie um projeto, copie a URL e a chave anon</Step>
                          <Step n={3}><code className="text-[10px] bg-black/30 px-1 rounded">npm install @supabase/supabase-js</code></Step>
                          <Step n={4}>Configure no seu app e use login, banco e arquivos prontos</Step>
                        </div>
                        <CodeBlock label="Configurar Supabase no React" code={`import { createClient } from '@supabase/supabase-js';\n\nconst supabase = createClient(\n  'https://XXXX.supabase.co',\n  'sua-chave-anon'\n);\n\n// Buscar dados\nconst { data } = await supabase\n  .from('tabela')\n  .select('*');`} />
                        <Tip>Supabase é a opção mais rápida para ter login + banco funcionando em menos de 30 min.</Tip>
                      </div>
                    </div>
                  </Section>

                  {/* 3. DEPLOY COM URL PRÓPRIA */}
                  <Section id="deploy_url" icon={<Globe size={15} />} title="3. Publicar com URL própria (domínio real)" badge="Online">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Para ter seu app em <strong className="text-gray-200">seusite.com.br</strong> ou similar, você precisa de hospedagem + domínio.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-[#0d1a0d] border border-green-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-green-300 mb-2">✅ Caminho Recomendado — Vercel + Registro.br</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Compre um domínio .com.br em <Link href="https://registro.br" label="registro.br" /> (≈ R$ 40/ano) ou .com em <Link href="https://namecheap.com" label="namecheap.com" /> (≈ R$ 50/ano)</Step>
                          <Step n={2}>Faça deploy do seu app na Vercel (gratuito)</Step>
                          <Step n={3}>Na Vercel: Settings → Domains → Add → digite seu domínio</Step>
                          <Step n={4}>No painel do registro.br: adicione um registro DNS tipo CNAME apontando para <code className="text-[10px] bg-black/30 px-1 rounded">cname.vercel-dns.com</code></Step>
                          <Step n={5}>Aguarde até 24h para o DNS propagar — seu site vai estar no ar com HTTPS automático</Step>
                        </div>
                        <Tip>Vercel dá HTTPS (cadeado) grátis e automático. Você só paga o domínio.</Tip>
                      </div>
                      <div className="bg-[#0d0d1f] border border-blue-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-blue-300 mb-2">🌐 Netlify — alternativa à Vercel (também gratuita)</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Crie conta em <Link href="https://netlify.com" label="netlify.com" /></Step>
                          <Step n={2}>Arraste a pasta do projeto para o site do Netlify (drag & drop)</Step>
                          <Step n={3}>URL gerada em segundos. Clique em "Domain settings" para adicionar domínio próprio</Step>
                        </div>
                        <Tip>Netlify aceita arrastar e soltar a pasta — nem precisa de GitHub.</Tip>
                      </div>
                      <div className="bg-[#1a0d1a] border border-pink-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-pink-300 mb-2">🖥️ VPS — para apps com backend (servidor próprio)</p>
                        <p className="text-[10px] text-gray-400 mb-2">Se você tem um servidor Node.js/Express que precisa rodar 24h:</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Contrate VPS na <Link href="https://hostinger.com.br" label="Hostinger" /> (≈ R$ 20/mês) ou <Link href="https://digitalocean.com" label="DigitalOcean" /> (US$ 4/mês)</Step>
                          <Step n={2}>Suba o código via Git: <code className="text-[10px] bg-black/30 px-1 rounded">git clone</code> no servidor</Step>
                          <Step n={3}>Instale PM2 para manter o servidor rodando: <code className="text-[10px] bg-black/30 px-1 rounded">npm install -g pm2 && pm2 start server.js</code></Step>
                          <Step n={4}>Configure Nginx como proxy reverso e o certbot para HTTPS</Step>
                        </div>
                        <Warn>VPS exige conhecimento de Linux. Para iniciantes, prefira Vercel/Netlify.</Warn>
                      </div>
                    </div>
                  </Section>

                  {/* 4. SAAS */}
                  <Section id="saas" icon={<CreditCard size={15} />} title="4. Transformar em SaaS — login + planos pagos" badge="Netflix-style">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      SaaS (Software as a Service) é um app como Netflix: usuários pagam mensalidade e acessam pela web. Veja como montar isso:
                    </p>
                    <div className="space-y-3">
                      <div className="bg-[#0d1a0d] border border-green-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-green-300 mb-2">🔐 Passo 1 — Sistema de Login (Autenticação)</p>
                        <p className="text-[10px] text-gray-400 mb-2">Use Supabase Auth — já vem pronto, suporta email+senha, Google, GitHub:</p>
                        <CodeBlock label="Login com Supabase" code={`// Cadastro\nawait supabase.auth.signUp({\n  email: 'usuario@email.com',\n  password: 'senha123'\n});\n\n// Login\nawait supabase.auth.signInWithPassword({\n  email: 'usuario@email.com',\n  password: 'senha123'\n});\n\n// Verificar se está logado\nconst { data: { user } } = await supabase.auth.getUser();`} />
                        <Tip>Supabase Auth é gratuito para até 50.000 usuários.</Tip>
                      </div>
                      <div className="bg-[#0d0d1f] border border-blue-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-blue-300 mb-2">💳 Passo 2 — Pagamentos (Stripe)</p>
                        <p className="text-[10px] text-gray-400 mb-2">Stripe é o padrão global para cobrar em BRL. Funciona com cartão, boleto e Pix:</p>
                        <div className="space-y-1.5">
                          <Step n={1}>Crie conta em <Link href="https://stripe.com/br" label="stripe.com/br" /> — grátis, paga 3,5% por transação</Step>
                          <Step n={2}>Crie um produto e um plano (ex: R$ 29/mês)</Step>
                          <Step n={3}>Instale no seu backend: <code className="text-[10px] bg-black/30 px-1 rounded">npm install stripe</code></Step>
                          <Step n={4}>Crie uma rota <code className="text-[10px] bg-black/30 px-1 rounded">/api/criar-checkout</code> que gera o link de pagamento</Step>
                          <Step n={5}>Após o pagamento, o Stripe envia um webhook confirmando — libere o acesso</Step>
                        </div>
                        <CodeBlock label="Backend — criar sessão de pagamento" code={`const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);\n\napp.post('/api/criar-checkout', async (req, res) => {\n  const session = await stripe.checkout.sessions.create({\n    mode: 'subscription',\n    payment_method_types: ['card'],\n    line_items: [{ price: 'price_ID_DO_PLANO', quantity: 1 }],\n    success_url: 'https://seusite.com/sucesso',\n    cancel_url: 'https://seusite.com/cancelado',\n  });\n  res.json({ url: session.url });\n});`} />
                        <CodeBlock label="Frontend — redirecionar para pagar" code={`const res = await fetch('/api/criar-checkout', { method: 'POST' });\nconst { url } = await res.json();\nwindow.location.href = url; // Redireciona para o Stripe`} />
                      </div>
                      <div className="bg-[#1a0d0d] border border-red-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-red-300 mb-2">🔒 Passo 3 — Proteger conteúdo por plano</p>
                        <CodeBlock label="Verificar assinatura antes de liberar" code={`// No backend: middleware que verifica se o usuário tem plano ativo\nasync function verificarAssinatura(req, res, next) {\n  const usuario = await buscarUsuario(req.headers.authorization);\n  if (!usuario.assinaturaAtiva) {\n    return res.status(403).json({ erro: 'Assine um plano para acessar' });\n  }\n  next();\n}\n\n// Rota protegida\napp.get('/api/conteudo-premium', verificarAssinatura, (req, res) => {\n  res.json({ conteudo: 'Acesso exclusivo para assinantes!' });\n});`} />
                      </div>
                      <div className="bg-[#0d1a10] border border-teal-700/20 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-teal-300 mb-2">📦 Stack completa recomendada para SaaS</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Frontend", value: "React + Vite (esse app)" },
                            { label: "Backend/API", value: "Node.js + Express" },
                            { label: "Banco de dados", value: "Supabase (PostgreSQL)" },
                            { label: "Autenticação", value: "Supabase Auth" },
                            { label: "Pagamentos", value: "Stripe" },
                            { label: "Hospedagem", value: "Vercel (frontend) + Railway/Render (backend)" },
                            { label: "Domínio", value: "Registro.br ou Namecheap" },
                            { label: "Email", value: "Resend ou SendGrid (grátis)" },
                          ].map(item => (
                            <div key={item.label} className="bg-black/20 rounded-lg px-2 py-1.5">
                              <p className="text-[9px] text-gray-600 font-bold uppercase">{item.label}</p>
                              <p className="text-[10px] text-gray-300">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 space-y-1">
                          <Link href="https://railway.app" label="Railway — hospedar backend Node.js (US$ 5/mês)" />
                          <br />
                          <Link href="https://render.com" label="Render — alternativa gratuita para backend" />
                          <br />
                          <Link href="https://resend.com" label="Resend — enviar emails transacionais (grátis)" />
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-green-950/40 to-blue-950/20 border border-green-700/30 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-white mb-1">💬 Peça para a IA montar o SaaS por você</p>
                        <p className="text-[10px] text-gray-400 mb-2">Copie e cole esse prompt no chat da IA do SK Editor:</p>
                        <CodeBlock code={`"Quero transformar este app em um SaaS.\nCrie:\n1. Páginas de login e cadastro com Supabase Auth\n2. Página de planos com botão de assinar\n3. Integração com Stripe para cobrança mensal\n4. Middleware que verifica assinatura antes de liberar o conteúdo\n5. Dashboard do usuário após login\nUse React + Supabase + Stripe. Backend em Node.js/Express.\nExplique cada arquivo criado."`} />
                      </div>
                    </div>
                  </Section>

                  {/* Resumo rápido */}
                  <div className="bg-[#0d1309] border border-gray-700/30 rounded-xl p-4">
                    <p className="text-[12px] font-bold text-gray-200 mb-2">⚡ Resumo Rápido</p>
                    <div className="space-y-1.5">
                      {[
                        { q: "Ver o app rodando", a: "npm run dev → localhost:5173" },
                        { q: "Banco de dados grátis", a: "Neon.tech (PostgreSQL) ou Supabase" },
                        { q: "Colocar online grátis", a: "Vercel ou Netlify" },
                        { q: "Domínio .com.br", a: "registro.br ≈ R$ 40/ano" },
                        { q: "Login de usuários", a: "Supabase Auth (grátis até 50k users)" },
                        { q: "Cobrar mensalidade", a: "Stripe (3,5% por transação)" },
                        { q: "Backend/servidor", a: "Railway ou Render (gratuito no início)" },
                      ].map(item => (
                        <div key={item.q} className="flex gap-2 text-[10px]">
                          <span className="text-gray-500 shrink-0">→</span>
                          <span className="text-gray-400 w-40 shrink-0">{item.q}:</span>
                          <span className="text-gray-200 font-medium">{item.a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ═══ ABA DEPLOY ════════════════════════════════════════════════════ */}
            {tab === "deploy" && (
              <div className="p-4 space-y-4">

                {/* Seletor de plataforma */}
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Plataforma de Destino</p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {PLATFORMS.map(p => (
                      <button key={p.id} onClick={() => { setSelected(p.id); setStatus("idle"); setLog([]); setSavedPath(null); }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${selected === p.id ? colorMap[p.color] + " border-opacity-100" : "border-gray-700/40 bg-[#0d1309] text-gray-500 hover:text-gray-300"}`}
                      >
                        <span className="text-base shrink-0">{p.icon}</span>
                        <span className="text-[11px] font-bold leading-tight">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info da plataforma */}
                <div className={`border rounded-xl p-3 space-y-3 ${activeColor}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-xl shrink-0">{platform.icon}</span>
                    <div>
                      <p className="text-[13px] font-bold text-gray-200">{platform.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{platform.desc}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Passo a Passo após o Download</p>
                    <ol className="space-y-1">
                      {platform.instructions.map((step, i) => (
                        <li key={i} className="flex gap-2 text-[11px] text-gray-300">
                          <span className="w-4 h-4 bg-white/10 text-gray-400 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                          <span className="flex-1 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {platform.terminalCmds && (
                    <CodeBlock
                      label="Comandos do Terminal (copie e cole)"
                      code={platform.terminalCmds.join("\n")}
                    />
                  )}

                  {platform.deployUrl && (
                    <a href={platform.deployUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 underline">
                      <ExternalLink size={11} /> Abrir {platform.label} no navegador
                    </a>
                  )}
                </div>

                {/* Botão Build */}
                <button
                  onClick={handleBuild}
                  disabled={status === "building"}
                  className={`w-full py-3.5 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all ${status === "building" ? "bg-gray-700/40 text-gray-500" : "bg-green-600/30 border border-green-500/50 text-green-300 hover:bg-green-600/40 active:scale-[0.98]"}`}
                >
                  {status === "building" ? (
                    <><RefreshCw size={15} className="animate-spin" /> Gerando ZIP...</>
                  ) : (
                    <><Download size={15} /> Gerar ZIP para {platform.label}</>
                  )}
                </button>

                {/* Log */}
                {log.length > 0 && (
                  <div className="bg-[#070d04] border border-gray-800/60 rounded-xl p-3 space-y-0.5">
                    {log.map((line, i) => (
                      <p key={i} className="text-[11px] font-mono text-gray-400 leading-relaxed">{line}</p>
                    ))}
                    {status === "done" && (
                      <p className="text-[12px] font-bold text-green-400 mt-1.5">
                        {savedPath ? `📂 Arquivo salvo no PC — siga os passos acima` : `📦 ZIP baixado — extraia e siga os passos acima`}
                      </p>
                    )}
                  </div>
                )}

                {/* Revelar no explorador */}
                {savedPath && isElectron && electronFS && (
                  <button onClick={() => electronFS.revealInExplorer(savedPath)}
                    className="flex items-center gap-2 text-[11px] text-blue-400 underline hover:text-blue-300">
                    <FolderOpen size={13} /> Mostrar arquivo no Explorador
                  </button>
                )}

                {/* Info extra */}
                <div className="bg-amber-950/20 border border-amber-700/30 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-400">
                      O ZIP gerado contém <strong className="text-gray-200">apenas os arquivos do seu projeto</strong>, sem node_modules nem .git. Arquivos de configuração para a plataforma são adicionados automaticamente.
                      {isElectron && " No aplicativo desktop, você escolhe onde salvar no seu PC."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ ABA DISCO ══════════════════════════════════════════════════════ */}
            {tab === "disk" && isElectron && (
              <div className="p-4 space-y-4">
                <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
                  <p className="text-[13px] font-bold text-gray-200 mb-1">💾 Salvar Projeto no Disco do PC</p>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Projetos salvos no disco sobrevivem ao fechar o app — ficam em{" "}
                    <span className="font-mono text-gray-400">~/MaikonJuridicoPro/projetos/</span>
                  </p>

                  <div className="flex gap-2 mb-3">
                    <button onClick={handleSaveToDisk}
                      className="flex-1 py-2.5 bg-green-600/30 border border-green-500/40 rounded-xl text-[12px] text-green-300 font-bold hover:bg-green-600/40 flex items-center justify-center gap-1.5">
                      <HardDrive size={13} /> Salvar Projeto Agora
                    </button>
                    {electronFS && (
                      <button onClick={() => electronFS.openProjectsDir()}
                        className="px-3 py-2.5 bg-blue-700/20 border border-blue-600/30 rounded-xl text-[11px] text-blue-300 hover:bg-blue-700/30 flex items-center gap-1">
                        <FolderOpen size={13} /> Abrir Pasta
                      </button>
                    )}
                  </div>

                  {diskStatus && (
                    <p className={`text-[11px] font-mono mb-2 ${diskStatus.startsWith("✅") ? "text-green-400" : diskStatus.startsWith("❌") ? "text-red-400" : "text-gray-400"}`}>
                      {diskStatus}
                    </p>
                  )}

                  <div className="flex items-center gap-2 p-2 bg-[#0d0d0d] border border-gray-700/30 rounded-xl">
                    <button onClick={toggleAutoSave}
                      className={`w-9 h-5 rounded-full transition-all ${autoSaveOn ? "bg-green-500" : "bg-gray-700"} relative shrink-0`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${autoSaveOn ? "left-4" : "left-0.5"}`} />
                    </button>
                    <div>
                      <p className="text-[11px] text-gray-300 font-bold">Auto-save no disco</p>
                      <p className="text-[10px] text-gray-600">Salva automaticamente a cada alteração</p>
                    </div>
                  </div>
                </div>

                {/* Lista de projetos salvos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Projetos no Disco</p>
                    <button onClick={loadDiskProjects} className="text-[10px] text-blue-400 underline flex items-center gap-1">
                      {diskLoading ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />} Atualizar
                    </button>
                  </div>

                  {diskProjects.length === 0 ? (
                    <div className="py-6 text-center">
                      <HardDrive size={24} className="text-gray-700 mx-auto mb-2" />
                      <p className="text-[12px] text-gray-600">Nenhum projeto salvo ainda</p>
                      <p className="text-[10px] text-gray-700 mt-1">Clique em "Salvar Projeto Agora" acima</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {diskProjects.map(proj => (
                        <div key={proj.filePath} className="flex items-center gap-3 p-3 bg-[#0d1309] border border-gray-700/30 rounded-xl">
                          <FileCode size={14} className="text-green-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-gray-200 font-semibold truncate">{proj.name}</p>
                            <p className="text-[10px] text-gray-600">
                              {new Date(proj.updatedAt).toLocaleString("pt-BR")} · {proj.fileCount} arquivo(s)
                            </p>
                          </div>
                          <button onClick={() => electronFS?.revealInExplorer(proj.filePath)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-900/20">
                            <Folder size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ ABA GIT ══════════════════════════════════════════════════════ */}
            {tab === "git" && (
              <div className="p-4 space-y-4">
                <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
                  <p className="text-[13px] font-bold text-gray-200 mb-1">🐙 Git via Terminal do PC</p>
                  <p className="text-[11px] text-gray-500 mb-3">
                    {isElectron
                      ? "Com o app desktop, você tem acesso total ao git real do computador. Use o Terminal (🖥️) para executar os comandos abaixo."
                      : "Para usar git, baixe o ZIP do projeto, extraia numa pasta e execute os comandos no terminal do seu PC."}
                  </p>
                </div>

                {[
                  {
                    title: "🆕 Novo Repositório (do zero)",
                    cmds: [
                      "git init",
                      "git add .",
                      'git commit -m "primeiro commit"',
                      "git branch -M main",
                      "git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git",
                      "git push -u origin main",
                    ],
                  },
                  {
                    title: "🔄 Atualizar Repositório Existente",
                    cmds: [
                      "git add .",
                      'git commit -m "atualização"',
                      "git push",
                    ],
                  },
                  {
                    title: "📥 Clonar / Baixar Repositório Existente",
                    cmds: [
                      "git clone https://github.com/SEU_USUARIO/SEU_REPO.git",
                      "cd SEU_REPO",
                      "npm install",
                      "npm start",
                    ],
                  },
                  {
                    title: "🌐 Publicar no GitHub Pages",
                    cmds: [
                      "git add .",
                      'git commit -m "deploy"',
                      "git push origin main",
                      "# Então: GitHub → Settings → Pages → Source: main branch",
                    ],
                  },
                  {
                    title: "🔐 Configurar Token de Acesso (necessário uma vez)",
                    cmds: [
                      "# 1. Crie um token em: github.com → Settings → Developer Settings → Personal Access Tokens",
                      "# 2. Ao fazer git push, use o TOKEN como senha:",
                      "git remote set-url origin https://SEU_USUARIO:SEU_TOKEN@github.com/SEU_USUARIO/SEU_REPO.git",
                      "# Agora o push funciona sem pedir senha toda hora:",
                      "git push",
                    ],
                  },
                ].map(section => (
                  <CodeBlock key={section.title} label={section.title} code={section.cmds.join("\n")} />
                ))}

                <div className="bg-blue-950/20 border border-blue-700/30 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-blue-300 mb-1">💡 Dica para o Terminal do SK Editor</p>
                  <p className="text-[10px] text-gray-400">
                    {isElectron
                      ? "O terminal do app tem acesso total ao git instalado no seu PC. Se git não estiver instalado, baixe em git-scm.com e instale — depois reinicie o app."
                      : "No app desktop (Electron), o terminal 🖥️ tem acesso real ao git do seu computador. Baixe o executável na aba Downloads."}
                  </p>
                  <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-400 underline mt-1.5">
                    <ExternalLink size={10} /> Baixar Git — git-scm.com
                  </a>
                </div>

                <div className="bg-amber-950/20 border border-amber-700/30 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-amber-300 mb-1">🤖 Peça para a IA fazer</p>
                  <CodeBlock code={`"Configure meu projeto para git.\nCrie o .gitignore correto,\nfaça o commit inicial e me dê os comandos\npara publicar no GitHub Pages."`} />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
