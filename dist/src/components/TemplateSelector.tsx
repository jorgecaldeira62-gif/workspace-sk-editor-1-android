import { useState, useRef, useCallback } from "react";
import { templates, Template } from "@/lib/templates";
import { Project, formatDate, getProjectStats } from "@/lib/projects";
import { exportAsZip } from "@/lib/zip-service";
import {
  Search, X, Wand2, GitBranch, Layers, Upload,
  FilePlus, Copy, Download, Trash2, FolderOpen, ChevronRight,
  Code2, Server, Globe, FileType, FolderPlus, Settings, Loader2,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { getActiveSlot, loadAISlots, sendAIMessage, parseAIResponse } from "@/lib/ai-service";
import { cloneRepo } from "@/lib/github-service";
import type { GitHubCredentials } from "@/lib/github-service";

interface TemplateSelectorProps {
  projects: Project[];
  onSelect: (template: Template) => void;
  onOpenProject: (project: Project) => void;
  onImportZip: () => void;
  onCreateFromAI?: (files: Record<string, string>, name: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (project: Project) => void;
  onOpenCampoLivre?: () => void;
  onOpenAssistenteJuridico?: () => void;
}

function projectColor(name: string): string {
  const colors = [
    "from-blue-600 to-indigo-700",
    "from-purple-600 to-pink-700",
    "from-green-600 to-emerald-700",
    "from-orange-500 to-red-600",
    "from-cyan-600 to-blue-700",
    "from-yellow-500 to-orange-600",
    "from-pink-600 to-rose-700",
    "from-indigo-600 to-purple-700",
    "from-teal-600 to-cyan-700",
    "from-red-600 to-pink-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function ProjectIcon({ name, size = 40 }: { name: string; size?: number }) {
  const letters = name.slice(0, 2).toUpperCase();
  const grad = projectColor(name);
  return (
    <div className={`bg-gradient-to-br ${grad} rounded-xl flex items-center justify-center shrink-0 font-bold text-white`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {letters}
    </div>
  );
}

function ProjectRow({ project, onOpen, onDelete, onDuplicate, onDownload, expanded, onToggle }: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDownload: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stats = getProjectStats(project.files);
  const time = formatDate(project.updatedAt);

  return (
    <div className="border-b border-gray-800/40 last:border-0">
      {/* Header row — clique expande/colapsa */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors ${expanded ? "bg-[#141414]" : "hover:bg-white/[0.03] active:bg-white/[0.06]"}`}
      >
        {/* Chevron indica estado */}
        <div className={`transition-transform duration-200 shrink-0 ${expanded ? "rotate-90" : ""}`}>
          <ChevronRight size={14} className="text-gray-600" />
        </div>
        <ProjectIcon name={project.name} size={40} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-gray-100 truncate">{project.name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{time} · {stats.count} arquivo{stats.count !== 1 ? "s" : ""}</p>
        </div>
        <span className="text-[10px] text-gray-700 shrink-0 mr-1">{expanded ? "fechar" : "abrir"}</span>
      </button>

      {/* Painel expandido — ações da pasta */}
      {expanded && (
        <div className="bg-[#0d0d0d] border-t border-gray-800/40 divide-y divide-gray-800/30">
          {/* Abrir */}
          <button
            onClick={onOpen}
            className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.08] text-left transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <FolderOpen size={15} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-200">Abrir Projeto</p>
              <p className="text-[11px] text-gray-600">Entrar no editor</p>
            </div>
          </button>

          {/* Duplicar */}
          <button
            onClick={() => { onDuplicate(); onToggle(); }}
            className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.08] text-left transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Copy size={15} className="text-purple-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-200">Duplicar Projeto</p>
              <p className="text-[11px] text-gray-600">Criar uma cópia independente</p>
            </div>
          </button>

          {/* Download ZIP */}
          <button
            onClick={() => { onDownload(); }}
            className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.04] active:bg-white/[0.08] text-left transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <Download size={15} className="text-green-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-200">Baixar como ZIP</p>
              <p className="text-[11px] text-gray-600">{stats.size} · todos os arquivos</p>
            </div>
          </button>

          {/* Excluir */}
          <button
            onClick={() => {
              if (confirm(`Excluir "${project.name}" permanentemente?`)) onDelete();
            }}
            className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-red-500/5 active:bg-red-500/10 text-left transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <Trash2 size={15} className="text-red-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-red-400">Excluir Projeto</p>
              <p className="text-[11px] text-red-900">Esta ação não pode ser desfeita</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  globe: <Globe size={22} className="text-blue-400" />,
  component: <Layers size={22} className="text-cyan-400" />,
  server: <Server size={22} className="text-green-400" />,
  code: <Code2 size={22} className="text-yellow-400" />,
  "file-type": <FileType size={22} className="text-blue-400" />,
  "folder-plus": <FolderPlus size={22} className="text-gray-400" />,
};

const AI_EXAMPLES = [
  "App de tarefas com React e localStorage",
  "API REST com Express, JWT e PostgreSQL",
  "Landing page moderna com animações CSS",
  "Bot de Telegram com Node.js",
  "Dashboard com gráficos e tabelas",
  "CRUD completo com Flask e SQLite",
  "Jogo Snake em JavaScript puro",
  "Portfolio pessoal responsivo",
];

export default function TemplateSelector({
  projects, onSelect, onOpenProject, onImportZip,
  onCreateFromAI, onDeleteProject, onDuplicateProject, onOpenCampoLivre,
  onOpenAssistenteJuridico,
}: TemplateSelectorProps) {
  const [tab, setTab] = useState<"tudo" | "recente" | "criar">("tudo");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiProgress, setAiProgress] = useState("");
  const [showPublicClone, setShowPublicClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneStatus, setCloneStatus] = useState<{ msg: string; ok?: boolean } | null>(null);

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => tab === "recente" ? now - p.updatedAt < sevenDays : true)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleCreateFromAI = useCallback(async () => {
    const desc = aiInput.trim();
    if (!desc || aiLoading) return;
    const slot = getActiveSlot(loadAISlots());
    if (!slot) {
      setAiError("Configure uma chave de IA ao abrir um projeto → painel IA → Configurações.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAiProgress("Analisando projeto...");
    try {
      setAiProgress("Gerando arquivos com IA...");
      const res = await sendAIMessage(
        [{ role: "user", content: `Crie um projeto completo: ${desc}` }],
        slot,
        `Crie um projeto COMPLETO. Formato obrigatório para cada arquivo:\n\`\`\`filepath:caminho/arquivo.ext\nconteúdo\n\`\`\`\nGere todos os arquivos necessários. Responda APENAS com os blocos de arquivo.`
      );
      setAiProgress("Aplicando arquivos...");
      const blocks = parseAIResponse(res);
      const files: Record<string, string> = {};
      for (const b of blocks) {
        if (b.type === "file" && b.filePath && b.content) files[b.filePath] = b.content;
      }
      if (Object.keys(files).length === 0) { setAiError("Nenhum arquivo gerado. Tente ser mais específico."); return; }
      onCreateFromAI?.(files, desc.length > 40 ? desc.slice(0, 40) + "..." : desc);
    } catch (err: any) {
      setAiError(`Erro: ${err.message}`);
    } finally {
      setAiLoading(false);
      setAiProgress("");
    }
  }, [aiInput, aiLoading, onCreateFromAI]);

  const handleDownloadProject = useCallback(async (project: Project) => {
    await exportAsZip(project.files, project.name.replace(/\s+/g, "-").toLowerCase());
  }, []);

  const handlePublicClone = useCallback(async () => {
    const clean = cloneUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const m = clean.match(/github\.com[/:]([^/]+)\/([^/]+)/);
    const parts = clean.split("/").filter(Boolean);
    const parsed = m ? { owner: m[1], repo: m[2] } : parts.length === 2 ? { owner: parts[0], repo: parts[1] } : null;
    if (!parsed) { setCloneStatus({ msg: "URL inválida. Use: github.com/usuario/repositorio" }); return; }
    setCloneLoading(true);
    setCloneStatus({ msg: `Baixando ${parsed.owner}/${parsed.repo}...` });
    try {
      const emptyCreds: GitHubCredentials = { token: "", username: "" };
      const imported = await cloneRepo(emptyCreds, parsed.owner, parsed.repo);
      if (Object.keys(imported).length === 0) throw new Error("Repositório não encontrado ou privado.");
      setCloneStatus({ msg: `✓ ${Object.keys(imported).length} arquivos importados de "${parsed.repo}"`, ok: true });
      setTimeout(() => {
        setShowPublicClone(false);
        setCloneUrl("");
        setCloneStatus(null);
        onCreateFromAI?.(imported, parsed.repo);
      }, 1200);
    } catch (e: any) {
      setCloneStatus({ msg: `Erro: ${e.message}` });
    } finally {
      setCloneLoading(false);
    }
  }, [cloneUrl, onCreateFromAI]);

  const CREATE_OPTIONS = [
    {
      icon: <FilePlus size={26} className="text-gray-300" />,
      label: "Criar projeto vazio",
      desc: "Comece com um projeto vazio sem modelos.",
      action: () => onSelect(templates[0]),
    },
    {
      icon: <GitBranch size={26} className="text-green-400" />,
      label: "Clonar Repositório Público",
      desc: "Baixar qualquer repositório público do GitHub sem token.",
      action: () => setShowPublicClone(true),
    },
    {
      icon: <Layers size={26} className="text-cyan-400" />,
      label: "Criar a partir de Modelo",
      desc: "Escolha entre vários modelos de projeto.",
      action: () => setShowTemplates(true),
    },
    {
      icon: <Wand2 size={26} className="text-purple-400" />,
      label: "Criar com IA",
      desc: "Descreva seu projeto e deixe a IA gerar os arquivos.",
      action: () => setShowAI(true),
    },
    {
      icon: <Upload size={26} className="text-yellow-400" />,
      label: "Importar do ZIP",
      desc: "Importar um projeto de um arquivo ZIP.",
      action: onImportZip,
    },
  ];

  return (
    <div className="h-screen bg-[#0d0d0d] flex flex-col text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 border-b border-gray-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Code2 size={16} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Projetos</h1>
        </div>
        <div className="flex items-center gap-1">
          {onOpenAssistenteJuridico && (
            <button onClick={onOpenAssistenteJuridico} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-800/20 border border-amber-600/30 text-amber-400 text-[11px] font-medium hover:bg-amber-800/30 transition-all" title="Assistente Jurídico — Jamile">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              Jurídico
            </button>
          )}
          {onOpenCampoLivre && (
            <button onClick={onOpenCampoLivre} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-green-700/20 border border-green-600/30 text-green-400 text-[11px] font-medium hover:bg-green-700/30 transition-all" title="Abrir Campo Livre — chat sem restrições">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Campo Livre
            </button>
          )}
          <button className="p-2 rounded-full hover:bg-white/5 text-gray-500">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2.5 border-b border-gray-800/40 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Procurar Nome do Projeto"
            className="w-full pl-9 pr-4 py-2.5 bg-[#141414] border border-gray-700/30 rounded-xl text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-blue-500/40"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-4 border-b border-gray-800/40 shrink-0">
        {[
          { id: "tudo", label: "TUDO" },
          { id: "recente", label: "RECENTE" },
          { id: "criar", label: "CRIAR" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`px-4 py-3 text-xs font-bold tracking-wider transition-all border-b-2 ${tab === id ? "border-blue-500 text-blue-400" : "border-transparent text-gray-600 hover:text-gray-400"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Project Lists */}
        {(tab === "tudo" || tab === "recente") && (
          <>
            {/* ── BARRA DE AÇÕES RÁPIDAS — sempre visível no topo da lista ── */}
            <div className="px-3 pt-3 pb-2 grid grid-cols-2 gap-2 border-b border-gray-800/40">
              <button onClick={onImportZip}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-yellow-500/10 border border-yellow-600/30 hover:bg-yellow-500/20 active:scale-95 transition-all text-left">
                <Upload size={20} className="text-yellow-400 shrink-0" />
                <div>
                  <p className="text-[13px] font-bold text-yellow-300">Importar ZIP</p>
                  <p className="text-[10px] text-gray-500">Abrir arquivo .zip</p>
                </div>
              </button>
              <button onClick={() => setTab("criar")}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-500/10 border border-green-600/30 hover:bg-green-500/20 active:scale-95 transition-all text-left">
                <FilePlus size={20} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-[13px] font-bold text-green-300">Novo Projeto</p>
                  <p className="text-[10px] text-gray-500">Criar ou clonar</p>
                </div>
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                <FolderOpen size={40} className="text-gray-700 mb-4" />
                <p className="text-base font-medium text-gray-500">
                  {search ? "Nenhum projeto encontrado" : tab === "recente" ? "Sem projetos recentes" : "Nenhum projeto ainda"}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  {!search && "Importe um ZIP ou crie um novo projeto acima"}
                </p>
                {!search && (
                  <button onClick={() => setTab("criar")} className="mt-6 px-6 py-2.5 bg-blue-600 rounded-xl text-sm font-medium text-white hover:bg-blue-500">
                    Criar Projeto
                  </button>
                )}
              </div>
            ) : (
              <div>
                {filtered.map(p => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    expanded={expandedId === p.id}
                    onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    onOpen={() => onOpenProject(p)}
                    onDelete={() => { onDeleteProject(p.id); setExpandedId(null); }}
                    onDuplicate={() => { onDuplicateProject(p); setExpandedId(null); }}
                    onDownload={() => handleDownloadProject(p)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Create options */}
        {tab === "criar" && (
          <div className="divide-y divide-gray-800/30">
            {CREATE_OPTIONS.map(({ icon, label, desc, action }) => (
              <button key={label} onClick={action} className="w-full flex items-center gap-4 px-5 py-5 hover:bg-white/4 active:bg-white/8 text-left transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-gray-700/30 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-gray-100">{label}</p>
                  <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
                <ChevronRight size={18} className="text-gray-700 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom count */}
      {(tab === "tudo" || tab === "recente") && filtered.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-800/30 shrink-0 text-center">
          <p className="text-[10px] text-gray-700">{filtered.length} projeto(s) · Salvo localmente</p>
        </div>
      )}

      {/* Templates Bottom Sheet */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end" onClick={() => setShowTemplates(false)}>
          <div className="w-full bg-[#141414] border-t border-gray-700/50 rounded-t-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/40 shrink-0">
              <h2 className="text-base font-bold text-white">Modelos de Projeto</h2>
              <button onClick={() => setShowTemplates(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-800/40 pb-safe-bottom pb-6">
              {templates.map(t => (
                <button key={t.id} onClick={() => { onSelect(t); setShowTemplates(false); }}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 text-left transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-gray-700/30 flex items-center justify-center shrink-0">
                    {TEMPLATE_ICONS[t.icon] || <Code2 size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-200">{t.name}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">{t.description}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-700 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Public Clone Bottom Sheet */}
      {showPublicClone && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end" onClick={() => { if (!cloneLoading) { setShowPublicClone(false); setCloneUrl(""); setCloneStatus(null); } }}>
          <div className="w-full bg-[#141414] border-t border-green-500/30 rounded-t-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/40">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-green-400" />
                <h2 className="text-base font-bold text-white">Clonar Repositório Público</h2>
              </div>
              {!cloneLoading && (
                <button onClick={() => { setShowPublicClone(false); setCloneUrl(""); setCloneStatus(null); }}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500"><X size={18} /></button>
              )}
            </div>
            <div className="p-5 pb-safe-bottom space-y-4">
              <p className="text-[12px] text-gray-500 leading-relaxed">
                Cole o link de qualquer repositório público do GitHub. Nenhum token necessário.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Link do Repositório</label>
                <input
                  autoFocus
                  value={cloneUrl}
                  onChange={e => { setCloneUrl(e.target.value); setCloneStatus(null); }}
                  onKeyDown={e => e.key === "Enter" && !cloneLoading && handlePublicClone()}
                  placeholder="github.com/usuario/repositorio"
                  className="w-full px-3 py-3 bg-[#0d0d0d] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-green-500/50"
                  disabled={cloneLoading}
                />
              </div>
              {cloneStatus && (
                <div className={`px-3 py-2.5 rounded-xl border text-[12px] flex items-start gap-2 ${cloneStatus.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                  {cloneStatus.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                  <span className="leading-relaxed">{cloneStatus.msg}</span>
                </div>
              )}
              <button
                onClick={handlePublicClone}
                disabled={!cloneUrl.trim() || cloneLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 disabled:opacity-40 text-white rounded-2xl font-bold text-[15px] hover:bg-green-500 transition-colors"
              >
                {cloneLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {cloneLoading ? "Baixando..." : "Baixar Repositório"}
              </button>
              <p className="text-[11px] text-gray-700 text-center">
                Funciona apenas com repositórios públicos · Seu token não é necessário
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Create Bottom Sheet */}
      {showAI && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end" onClick={() => { if (!aiLoading) setShowAI(false); }}>
          <div className="w-full bg-[#141414] border-t border-purple-500/30 rounded-t-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/40">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-purple-400" />
                <h2 className="text-base font-bold text-white">Criar com IA</h2>
              </div>
              {!aiLoading && <button onClick={() => { setShowAI(false); setAiError(""); setAiInput(""); }} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500"><X size={18} /></button>}
            </div>

            <div className="p-5 pb-safe-bottom">
              {aiLoading ? (
                <div className="text-center py-10">
                  <div className="w-14 h-14 mx-auto mb-4 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 animate-spin" />
                    <Wand2 size={22} className="absolute inset-0 m-auto text-purple-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-300">{aiProgress}</p>
                  <p className="text-[11px] text-gray-600 mt-1">15–30 segundos...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-3">Descreva o projeto que a IA vai criar:</p>
                  <textarea
                    autoFocus
                    value={aiInput}
                    onChange={e => { setAiInput(e.target.value); setAiError(""); }}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreateFromAI(); }}
                    placeholder="Ex: API com Express, JWT e banco PostgreSQL..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[#0d0d0d] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-purple-500/50 resize-none mb-3"
                  />
                  {aiError && (
                    <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">{aiError}</div>
                  )}
                  <button onClick={handleCreateFromAI} disabled={!aiInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 disabled:opacity-40 text-white rounded-2xl font-semibold text-[15px] hover:opacity-90 mb-5">
                    <Wand2 size={16} /> Gerar Projeto Completo
                  </button>
                  <p className="text-[11px] text-gray-600 mb-2.5 uppercase tracking-wider font-semibold">Exemplos</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {AI_EXAMPLES.map(ex => (
                      <button key={ex} onClick={() => setAiInput(ex)}
                        className="w-full text-left px-3.5 py-2.5 bg-gray-800/40 hover:bg-gray-700/50 rounded-xl text-[12px] text-gray-400 hover:text-gray-300 border border-gray-700/20">
                        {ex}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
