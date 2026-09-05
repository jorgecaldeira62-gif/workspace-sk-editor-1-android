import { useState, useCallback, useEffect, useRef } from "react";
import {
  GitBranch, Upload, Plus, Loader2, ExternalLink,
  Lock, Unlock, CheckCircle2, ChevronRight, KeyRound,
  RefreshCw, Download, X, AlertCircle, Monitor, Terminal, Globe,
} from "lucide-react";
import {
  GitHubCredentials,
  loadGitHubCredentials,
  saveGitHubCredentials,
  listRepos,
  cloneRepo,
  pushAllFiles,
  createRepo,
  enableGitHubPages,
  makeRepoPublic,
} from "@/lib/github-service";

interface GitHubPanelProps {
  files: Record<string, string>;
  onImport: (files: Record<string, string>) => void;
  projectName: string;
  defaultView?: "home" | "push-new" | "push-existing" | "clone" | "pages-deploy";
}

// ─── Tela 1: Configurar Token ─────────────────────────────────────────────
function SetupScreen({ onSaved }: { onSaved: (creds: GitHubCredentials) => void }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token.trim()}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error("Token inválido ou sem permissão");
      const user = await res.json();
      const creds: GitHubCredentials = { token: token.trim(), username: user.login };
      saveGitHubCredentials(creds);
      onSaved(creds);
    } catch (e: any) {
      setError(e.message || "Não foi possível conectar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-5 space-y-5">
      {/* Header */}
      <div className="text-center pb-2">
        <div className="w-14 h-14 mx-auto mb-3 bg-[#141414] border border-gray-700/50 rounded-2xl flex items-center justify-center">
          <GitBranch size={26} className="text-green-400" />
        </div>
        <h2 className="text-base font-bold text-white">Conectar ao GitHub</h2>
        <p className="text-xs text-gray-500 mt-1">Faça isso uma vez só — salva automaticamente</p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {[
          {
            n: "1", title: "Abra o GitHub no navegador",
            desc: "Clique no link abaixo para ir direto para a página de criação de token",
            action: (
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=SK+Code+Editor"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 mt-2 px-3 py-2 bg-[#141414] border border-gray-700/40 rounded-xl text-xs text-green-400 font-semibold hover:border-green-500/40 transition-colors"
              >
                <ExternalLink size={13} />
                Criar Token no GitHub →
              </a>
            ),
          },
          {
            n: "2", title: "Gere o token",
            desc: 'Na página que abrir, role até o fim e clique em "Generate token". Copie o código que aparecer (começa com ghp_).',
          },
          {
            n: "3", title: "Cole o token aqui",
            desc: "O token só aparece uma vez — cole agora antes de fechar o GitHub.",
          },
        ].map(({ n, title, desc, action }) => (
          <div key={n} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {n}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-200">{title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              {action}
            </div>
          </div>
        ))}
      </div>

      {/* Token input */}
      <div className="space-y-2">
        <label className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Token</label>
        <div className="relative">
          <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleConnect()}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full pl-9 pr-4 py-3 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-green-500/50"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-[12px] text-red-400">{error}</p>
          </div>
        )}
        <button
          onClick={handleConnect}
          disabled={!token.trim() || loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 disabled:opacity-40 text-white rounded-xl font-bold text-[14px] hover:bg-green-500 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {loading ? "Verificando..." : "Conectar ao GitHub"}
        </button>
      </div>
    </div>
  );
}

// ─── Tela 2: Painel principal ─────────────────────────────────────────────
function MainPanel({
  creds, files, projectName, onImport, onDisconnect, defaultView,
}: {
  creds: GitHubCredentials;
  files: Record<string, string>;
  projectName: string;
  onImport: (files: Record<string, string>) => void;
  onDisconnect: () => void;
  defaultView?: "home" | "push-new" | "push-existing" | "clone" | "pages-deploy";
}) {
  const [repos, setRepos] = useState<any[]>([]);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok?: boolean } | null>(null);
  const [view, setView] = useState<"home" | "push-new" | "push-existing" | "clone" | "pages-deploy">(defaultView || "home");
  const [pushedRepo, setPushedRepo] = useState<{ owner: string; name: string } | null>(null);

  // Push para repo novo
  const [newName, setNewName] = useState(projectName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, ""));
  const [newDesc, setNewDesc] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [commitMsg, setCommitMsg] = useState(`Enviado pelo SK Code Editor - ${new Date().toLocaleDateString("pt-BR")}`);

  // Push para repo existente
  const [selectedRepo, setSelectedRepo] = useState<any>(null);

  // GitHub Pages deploy
  const [pagesRepo, setPagesRepo] = useState("sk-editor");
  const [pagesLogs, setPagesLogs] = useState<string[]>([]);
  const [pagesRunning, setPagesRunning] = useState(false);
  const [pagesUrl, setPagesUrl] = useState("");
  const [pagesError, setPagesError] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pagesLogs]);

  const fileCount = Object.keys(files).length;

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listRepos(creds);
      setRepos(list);
      setReposLoaded(true);
    } catch (e: any) {
      setStatus({ msg: `Erro ao buscar repositórios: ${e.message}` });
    } finally {
      setLoading(false);
    }
  }, [creds]);

  useEffect(() => {
    if ((view === "push-existing" || view === "clone") && !reposLoaded) loadRepos();
  }, [view, reposLoaded, loadRepos]);

  const handlePushNew = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      setStatus({ msg: "Criando repositório..." });
      await createRepo(creds, newName.trim(), newDesc, newPrivate);
      setStatus({ msg: "Enviando arquivos..." });
      const result = await pushAllFiles(creds, creds.username, newName.trim(), files, commitMsg);
      setPushedRepo({ owner: creds.username, name: newName.trim() });
      setStatus({
        msg: `✓ Enviado! ${result.success} arquivo(s) no repositório "${newName}"`,
        ok: true,
      });
    } catch (e: any) {
      setStatus({ msg: `Erro: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handlePushExisting = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setStatus(null);
    try {
      setStatus({ msg: `Enviando para ${selectedRepo.full_name}...` });
      const result = await pushAllFiles(
        creds, selectedRepo.owner.login, selectedRepo.name, files, commitMsg
      );
      setPushedRepo({ owner: selectedRepo.owner.login, name: selectedRepo.name });
      setStatus({
        msg: `✓ Enviado! ${result.success} arquivo(s) atualizados em "${selectedRepo.full_name}"`,
        ok: true,
      });
    } catch (e: any) {
      setStatus({ msg: `Erro: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (repo: any) => {
    setLoading(true);
    setStatus({ msg: `Baixando ${repo.full_name}...` });
    try {
      const imported = await cloneRepo(creds, repo.owner.login, repo.name);
      onImport(imported);
      setStatus({ msg: `✓ ${Object.keys(imported).length} arquivos importados de "${repo.name}"`, ok: true });
    } catch (e: any) {
      setStatus({ msg: `Erro: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handlePagesDeploy = async () => {
    if (!pagesRepo.trim()) return;
    const repo = pagesRepo.trim();
    setPagesRunning(true);
    setPagesLogs(["Iniciando publicação…"]);
    setPagesUrl("");
    setPagesError("");
    const log = (msg: string) => setPagesLogs(l => [...l, msg]);
    try {
      // 1. Tenta via servidor (se disponível)
      try {
        const res = await fetch("/api/pages/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: creds.token, username: creds.username, repoName: repo }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split("\n\n");
            buf = parts.pop() || "";
            for (const part of parts) {
              const line = part.replace(/^data: /, "").trim();
              if (!line) continue;
              try {
                const evt = JSON.parse(line);
                if (evt.type === "log") log(evt.msg);
                else if (evt.type === "done") { setPagesUrl(evt.url); log(evt.msg); return; }
                else if (evt.type === "error") { setPagesError(evt.msg); log(`❌ ${evt.msg}`); return; }
              } catch {}
            }
          }
          return;
        }
      } catch { /* servidor indisponível — continua com modo direto */ }

      // 2. Modo direto via GitHub API (sem servidor)
      log("🔧 Modo direto via GitHub API…");
      const owner = creds.username;

      // Cria repositório (ignora erro se já existe)
      log(`📁 Verificando repositório "${repo}"…`);
      try {
        await createRepo(creds, repo, "Publicado pelo SK Code Editor", false);
        log("✅ Repositório criado.");
      } catch (e: any) {
        if (e.message?.includes("422") || e.message?.includes("already exists")) {
          log("ℹ️ Repositório já existe — usando existente.");
        } else { throw e; }
      }

      // Garante que é público (GitHub Pages grátis exige)
      await makeRepoPublic(creds, owner, repo);
      log("🌐 Repositório público confirmado.");

      // Adiciona workflow de build/deploy + arquivos do projeto
      const workflowYml = `name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install & Build
        run: |
          npm install 2>/dev/null || true
          npm run build 2>/dev/null || true
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
`;
      // Push dos arquivos do projeto
      log(`📤 Enviando ${Object.keys(files).length} arquivo(s)…`);
      const allFiles: Record<string, string> = {
        ...files,
        ".github/workflows/deploy.yml": workflowYml,
      };
      const result = await pushAllFiles(creds, owner, repo, allFiles, "Publicado pelo SK Code Editor");
      log(`✅ ${result.success} arquivo(s) enviados.`);

      // Ativa GitHub Pages
      log("🌐 Ativando GitHub Pages…");
      const pagesUrl = await enableGitHubPages(creds, owner, repo, "main", "/");
      log("✅ GitHub Pages ativado! Pode demorar 1-2 min para ficar online.");
      log(`🔗 ${pagesUrl}`);
      setPagesUrl(pagesUrl);
    } catch (e: any) {
      setPagesError(e.message || String(e));
    } finally {
      setPagesRunning(false);
    }
  };

  // ── Botões "Abrir no VS Code" ─────────────────────────────────────────
  const OpenInVSCode = ({ owner, name }: { owner: string; name: string }) => (
    <div className="space-y-2 pt-1">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold px-1">Abrir no VS Code</p>
      <a
        href={`https://github.dev/${owner}/${name}`}
        target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/15 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
          <Monitor size={17} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-blue-300">VS Code Web</p>
          <p className="text-[11px] text-gray-500">Editor completo no navegador, grátis</p>
        </div>
        <ExternalLink size={13} className="text-gray-600 shrink-0" />
      </a>
      <a
        href={`https://stackblitz.com/github/${owner}/${name}`}
        target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600/10 border border-purple-500/30 rounded-xl hover:bg-purple-600/15 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
          <Terminal size={17} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-purple-300">StackBlitz — Terminal completo</p>
          <p className="text-[11px] text-gray-500">VS Code + Node.js + npm install, grátis</p>
        </div>
        <ExternalLink size={13} className="text-gray-600 shrink-0" />
      </a>
      <a
        href={`https://gitpod.io/#https://github.com/${owner}/${name}`}
        target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center gap-3 px-4 py-3 bg-orange-600/10 border border-orange-500/30 rounded-xl hover:bg-orange-600/15 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
          <Terminal size={17} className="text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-orange-300">Gitpod — Terminal Linux completo</p>
          <p className="text-[11px] text-gray-500">Java, Python, Node — qualquer linguagem</p>
        </div>
        <ExternalLink size={13} className="text-gray-600 shrink-0" />
      </a>
      <p className="text-[10px] text-gray-600 px-1 pt-1 leading-relaxed">
        Após editar lá, use o painel GitHub do app para puxar as alterações de volta.
      </p>
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div className="h-full flex flex-col">
      {/* User badge */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141414] border-b border-gray-700/30">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-400" />
          <span className="text-xs font-semibold text-gray-300">@{creds.username}</span>
          <span className="text-[10px] text-gray-600">conectado</span>
        </div>
        <button onClick={onDisconnect} className="text-[10px] text-gray-700 hover:text-gray-500">
          Desconectar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Projeto atual */}
        <div className="px-3 py-2.5 bg-[#141414] border border-gray-700/30 rounded-xl">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-0.5">Projeto atual</p>
          <p className="text-sm font-bold text-white truncate">{projectName}</p>
          <p className="text-[11px] text-gray-500">{fileCount} arquivo{fileCount !== 1 ? "s" : ""}</p>
        </div>

        {/* Ação principal: Enviar */}
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2 px-1">Enviar para GitHub</p>
          <button
            onClick={() => setView("push-new")}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-green-600/10 border border-green-500/30 rounded-xl hover:bg-green-600/15 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0">
              <Plus size={17} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-green-400">Criar repositório novo e enviar</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Cria um repo novo e sobe todos os arquivos</p>
            </div>
            <ChevronRight size={15} className="text-gray-600 shrink-0" />
          </button>

          <button
            onClick={() => setView("push-existing")}
            className="w-full flex items-center gap-3 px-4 py-3 mt-2 bg-[#141414] border border-gray-700/40 rounded-xl hover:border-gray-600/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Upload size={16} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-200">Enviar para repo existente</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Atualiza um repositório que já existe</p>
            </div>
            <ChevronRight size={15} className="text-gray-600 shrink-0" />
          </button>
        </div>

        {/* Importar */}
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2 px-1">Baixar do GitHub</p>
          <button
            onClick={() => setView("clone")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[#141414] border border-gray-700/40 rounded-xl hover:border-gray-600/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Download size={16} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-200">Importar repositório</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Baixa um repositório para editar aqui</p>
            </div>
            <ChevronRight size={15} className="text-gray-600 shrink-0" />
          </button>
        </div>

        {/* Publicar GitHub Pages */}
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2 px-1">Publicar app gratuitamente</p>
          <button
            onClick={() => setView("pages-deploy")}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-blue-600/10 border border-blue-500/30 rounded-xl hover:bg-blue-600/15 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Globe size={17} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-blue-300">Publicar no GitHub Pages — Grátis</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Este editor online, sem pagar Replit, para sempre</p>
            </div>
            <ChevronRight size={15} className="text-gray-600 shrink-0" />
          </button>
        </div>
      </div>

      {status && (
        <div className={`mx-4 mb-4 px-3 py-2.5 rounded-xl border text-[12px] flex items-start gap-2 ${status.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {status.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{status.msg}</span>
        </div>
      )}
    </div>
  );

  // ── PUSH NOVO REPO ────────────────────────────────────────────────────
  if (view === "push-new") return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#141414] border-b border-gray-700/30">
        <button onClick={() => { setView("home"); setStatus(null); }} className="p-1 rounded-lg hover:bg-white/10 text-gray-500">
          <X size={15} />
        </button>
        <span className="text-sm font-bold text-white">Criar repositório e enviar</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Nome do Repositório</label>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, ""))}
            placeholder="meu-projeto"
            className="w-full px-3 py-2.5 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-green-500/50"
          />
          <p className="text-[10px] text-gray-600">Será criado como: github.com/{creds.username}/{newName || "..."}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Descrição (opcional)</label>
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Descrição do projeto..."
            className="w-full px-3 py-2.5 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-green-500/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Mensagem do envio</label>
          <input
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 outline-none focus:border-green-500/50"
          />
        </div>
        <button
          onClick={() => setNewPrivate(!newPrivate)}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border w-full text-left transition-colors ${newPrivate ? "bg-yellow-500/10 border-yellow-500/30" : "bg-[#141414] border-gray-700/40"}`}
        >
          {newPrivate ? <Lock size={15} className="text-yellow-400" /> : <Unlock size={15} className="text-green-400" />}
          <div>
            <p className="text-[13px] font-semibold text-gray-200">{newPrivate ? "Repositório Privado" : "Repositório Público"}</p>
            <p className="text-[11px] text-gray-500">{newPrivate ? "Só você vê" : "Qualquer pessoa pode ver"}</p>
          </div>
        </button>

        {status && (
          <div className={`px-3 py-2.5 rounded-xl border text-[12px] flex items-start gap-2 ${status.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            {status.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{status.msg}</span>
          </div>
        )}

        {status?.ok && pushedRepo && <OpenInVSCode owner={pushedRepo.owner} name={pushedRepo.name} />}

        {!status?.ok && (
          <div className="text-[11px] text-gray-600 px-1">
            {fileCount} arquivo{fileCount !== 1 ? "s" : ""} serão enviados
          </div>
        )}
      </div>
      {!status?.ok && (
        <div className="px-4 pb-5 pt-2">
          <button
            onClick={handlePushNew}
            disabled={!newName.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-green-600 disabled:opacity-40 text-white rounded-xl font-bold text-[15px] hover:bg-green-500 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading ? "Enviando..." : "Criar e Enviar"}
          </button>
        </div>
      )}
    </div>
  );

  // ── PUSH REPO EXISTENTE ───────────────────────────────────────────────
  if (view === "push-existing") return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#141414] border-b border-gray-700/30">
        <button onClick={() => { setView("home"); setStatus(null); setSelectedRepo(null); }} className="p-1 rounded-lg hover:bg-white/10 text-gray-500">
          <X size={15} />
        </button>
        <span className="text-sm font-bold text-white">Enviar para repositório</span>
        <button onClick={loadRepos} disabled={loading} className="ml-auto p-1 rounded-lg hover:bg-white/10 text-gray-500">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!reposLoaded && loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Buscando repositórios...
          </div>
        )}
        {reposLoaded && (
          <div className="px-4 py-3 space-y-2">
            {selectedRepo && (
              <div className="space-y-2 pb-2 border-b border-gray-800/50">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  <span className="text-[12px] text-green-400 font-semibold truncate">{selectedRepo.full_name}</span>
                  <button onClick={() => setSelectedRepo(null)} className="ml-auto text-gray-600 hover:text-gray-400 shrink-0"><X size={13} /></button>
                </div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold block">Mensagem do envio</label>
                <input
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 outline-none focus:border-green-500/50"
                />
                {status && (
                  <div className={`px-3 py-2.5 rounded-xl border text-[12px] flex items-start gap-2 ${status.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                    {status.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                    <span className="leading-relaxed">{status.msg}</span>
                  </div>
                )}
                {status?.ok && pushedRepo && <OpenInVSCode owner={pushedRepo.owner} name={pushedRepo.name} />}
                {!status?.ok && (
                  <button
                    onClick={handlePushExisting}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 disabled:opacity-40 text-white rounded-xl font-bold text-[14px] hover:bg-green-500 transition-colors"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    {loading ? "Enviando..." : `Enviar ${fileCount} arquivo(s)`}
                  </button>
                )}
              </div>
            )}
            {!selectedRepo && (
              <p className="text-[11px] text-gray-600 pb-1">Escolha o repositório de destino:</p>
            )}
            {repos.map(repo => (
              <button
                key={repo.id}
                onClick={() => setSelectedRepo(repo)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${selectedRepo?.id === repo.id ? "bg-green-500/10 border-green-500/30" : "bg-[#141414] border-gray-700/30 hover:border-gray-600/50"}`}
              >
                {repo.private ? <Lock size={12} className="text-yellow-500 shrink-0" /> : <Unlock size={12} className="text-gray-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-300 truncate">{repo.full_name}</p>
                  {repo.description && <p className="text-[10px] text-gray-600 truncate">{repo.description}</p>}
                </div>
                {selectedRepo?.id === repo.id && <CheckCircle2 size={14} className="text-green-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── CLONE ─────────────────────────────────────────────────────────────
  if (view === "clone") return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#141414] border-b border-gray-700/30">
        <button onClick={() => { setView("home"); setStatus(null); }} className="p-1 rounded-lg hover:bg-white/10 text-gray-500">
          <X size={15} />
        </button>
        <span className="text-sm font-bold text-white">Importar repositório</span>
        <button onClick={loadRepos} disabled={loading} className="ml-auto p-1 rounded-lg hover:bg-white/10 text-gray-500">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!reposLoaded && loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Buscando repositórios...
          </div>
        )}
        {reposLoaded && (
          <div className="px-4 py-3 space-y-2">
            {status && (
              <div className={`px-3 py-2.5 rounded-xl border text-[12px] flex items-start gap-2 mb-2 ${status.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                {status.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                <span className="leading-relaxed">{status.msg}</span>
              </div>
            )}
            <p className="text-[11px] text-gray-600 pb-1">Escolha o repositório para importar:</p>
            {repos.map(repo => (
              <button
                key={repo.id}
                onClick={() => handleClone(repo)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#141414] border border-gray-700/30 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-colors text-left disabled:opacity-50"
              >
                {repo.private ? <Lock size={12} className="text-yellow-500 shrink-0" /> : <Unlock size={12} className="text-gray-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-300 truncate">{repo.full_name}</p>
                  {repo.description && <p className="text-[10px] text-gray-600 truncate">{repo.description}</p>}
                </div>
                <Download size={13} className="text-purple-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── PUBLICAR NO GITHUB PAGES ──────────────────────────────────────────
  if (view === "pages-deploy") return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#141414] border-b border-gray-700/30">
        <button onClick={() => { setView("home"); setPagesLogs([]); setPagesUrl(""); setPagesError(""); setPagesRunning(false); }} className="p-1 rounded-lg hover:bg-white/10 text-gray-500">
          <X size={15} />
        </button>
        <Globe size={14} className="text-blue-400" />
        <span className="text-sm font-bold text-white">Publicar no GitHub Pages</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Explicação */}
        <div className="px-3 py-3 bg-blue-500/8 border border-blue-500/20 rounded-xl space-y-1.5">
          <p className="text-[12px] font-bold text-blue-300">O que isso faz?</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Compila este editor e publica ele no GitHub Pages — um endereço tipo <span className="text-blue-300 font-mono">{creds.username}.github.io/{pagesRepo || "sk-editor"}</span> que funciona para sempre, sem pagar nada.
          </p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Edição de arquivos e integração com GitHub funcionam sem o servidor. Só a Jasmim e o terminal online precisam do servidor.
          </p>
        </div>

        {/* Nome do repositório */}
        {!pagesRunning && !pagesUrl && (
          <div className="space-y-1.5">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Nome do repositório</label>
            <input
              value={pagesRepo}
              onChange={e => setPagesRepo(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, ""))}
              placeholder="sk-editor"
              className="w-full px-3 py-2.5 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-blue-500/50"
            />
            <p className="text-[10px] text-gray-600">Será publicado em: {creds.username}.github.io/{pagesRepo || "..."}</p>
          </div>
        )}

        {/* Logs de progresso */}
        {pagesLogs.length > 0 && (
          <div className="bg-black/40 border border-gray-700/40 rounded-xl p-3 max-h-48 overflow-y-auto font-mono">
            {pagesLogs.map((log, i) => (
              <p key={i} className="text-[11px] text-gray-300 leading-relaxed">{log}</p>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* Sucesso */}
        {pagesUrl && (
          <div className="space-y-3">
            <div className="px-3 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
              <p className="text-[12px] font-bold text-green-400 mb-1">✅ Publicado com sucesso!</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">O GitHub Pages pode demorar 1-2 minutos para ficar online na primeira vez.</p>
            </div>
            <a
              href={pagesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-blue-600/15 border border-blue-500/30 rounded-xl hover:bg-blue-600/20 transition-colors"
            >
              <Globe size={17} className="text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-blue-300">Abrir o app publicado</p>
                <p className="text-[11px] text-gray-500 truncate">{pagesUrl}</p>
              </div>
              <ExternalLink size={13} className="text-gray-600 shrink-0" />
            </a>

            {/* Gerar APK */}
            <div className="px-3 py-3 bg-orange-500/8 border border-orange-500/20 rounded-xl space-y-2">
              <p className="text-[12px] font-bold text-orange-300">📱 Transformar em APK (grátis)</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Com o app publicado, você pode gerar um APK Android usando o <strong className="text-orange-300">PWABuilder</strong> — gratuito, sem precisar do Android Studio.
              </p>
              <a
                href={`https://www.pwabuilder.com/generate?url=${encodeURIComponent(pagesUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-orange-500/15 border border-orange-500/30 rounded-xl hover:bg-orange-500/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[15px]">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-orange-300">Gerar APK no PWABuilder</p>
                  <p className="text-[10px] text-gray-500">Clica → baixa o APK → instala no celular</p>
                </div>
                <ExternalLink size={13} className="text-gray-600 shrink-0" />
              </a>
              <p className="text-[10px] text-gray-600 leading-relaxed px-0.5">
                No PWABuilder: clique em "Package for stores" → "Android" → "Generate APK" → baixe o arquivo .apk e instale no celular habilitando "fontes desconhecidas".
              </p>
            </div>

            <p className="text-[10px] text-gray-600 px-1 leading-relaxed">
              Para atualizar o app no futuro, clique em "Publicar no GitHub Pages" de novo — o APK instalado atualiza automaticamente pelo navegador.
            </p>
          </div>
        )}

        {/* Erro */}
        {pagesError && !pagesUrl && (
          <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
            <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-400 leading-relaxed">{pagesError}</p>
          </div>
        )}
      </div>

      {/* Botão */}
      {!pagesUrl && (
        <div className="px-4 pb-5 pt-2">
          <button
            onClick={handlePagesDeploy}
            disabled={!pagesRepo.trim() || pagesRunning}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 disabled:opacity-40 text-white rounded-xl font-bold text-[15px] hover:bg-blue-500 transition-colors"
          >
            {pagesRunning ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            {pagesRunning ? "Publicando... (pode demorar 2 min)" : "Publicar Grátis no GitHub Pages"}
          </button>
        </div>
      )}
    </div>
  );

  return null;
}

// ─── Clone Público (sem token) ────────────────────────────────────────────
function PublicCloneScreen({ onImport, onBack }: { onImport: (f: Record<string,string>) => void; onBack: () => void }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok?: boolean } | null>(null);

  const parseRepo = (url: string): { owner: string; repo: string } | null => {
    const clean = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const m = clean.match(/github\.com[/:]([^/]+)\/([^/]+)/);
    if (m) return { owner: m[1], repo: m[2] };
    const parts = clean.split("/").filter(Boolean);
    if (parts.length === 2) return { owner: parts[0], repo: parts[1] };
    return null;
  };

  const handleClone = async () => {
    const parsed = parseRepo(repoUrl);
    if (!parsed) { setStatus({ msg: "URL inválida. Use: github.com/usuario/repositorio" }); return; }
    setLoading(true);
    setStatus({ msg: `Baixando ${parsed.owner}/${parsed.repo}...` });
    try {
      const emptyCreds: GitHubCredentials = { token: "", username: "" };
      const imported = await cloneRepo(emptyCreds, parsed.owner, parsed.repo);
      if (Object.keys(imported).length === 0) throw new Error("Nenhum arquivo encontrado. O repositório é privado ou não existe.");
      onImport(imported);
      setStatus({ msg: `✓ ${Object.keys(imported).length} arquivos importados de "${parsed.repo}"`, ok: true });
    } catch (e: any) {
      setStatus({ msg: `Erro: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-white/10 text-gray-500"><X size={15} /></button>
        <h2 className="text-sm font-bold text-white">Clonar Repositório Público</h2>
      </div>
      <p className="text-[12px] text-gray-500 leading-relaxed">
        Repositórios públicos podem ser baixados sem precisar de token. Cole o link do GitHub abaixo.
      </p>
      <div className="space-y-1.5">
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Link do Repositório</label>
        <input
          value={repoUrl}
          onChange={e => { setRepoUrl(e.target.value); setStatus(null); }}
          onKeyDown={e => e.key === "Enter" && handleClone()}
          placeholder="github.com/usuario/repositorio"
          className="w-full px-3 py-2.5 bg-[#141414] border border-gray-700/50 rounded-xl text-sm text-gray-300 placeholder-gray-700 outline-none focus:border-purple-500/50"
        />
      </div>
      {status && (
        <div className={`px-3 py-2.5 rounded-xl border text-[12px] flex items-start gap-2 ${status.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {status.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
          <span className="leading-relaxed">{status.msg}</span>
        </div>
      )}
      <button
        onClick={handleClone}
        disabled={!repoUrl.trim() || loading}
        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 disabled:opacity-40 text-white rounded-xl font-bold text-[14px] hover:bg-purple-500 transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {loading ? "Baixando..." : "Baixar Repositório"}
      </button>
    </div>
  );
}

// ─── Componente raiz ──────────────────────────────────────────────────────
export default function GitHubPanel({ files, onImport, projectName, defaultView }: GitHubPanelProps) {
  const [creds, setCreds] = useState<GitHubCredentials | null>(() => {
    const saved = loadGitHubCredentials();
    return saved.token ? saved : null;
  });
  const [publicClone, setPublicClone] = useState(false);

  const handleDisconnect = () => {
    saveGitHubCredentials({ token: "", username: "" });
    setCreds(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0d0d] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/50 bg-[#141414] shrink-0">
        <GitBranch size={15} className="text-green-400" />
        <span className="text-xs font-bold text-gray-300">GitHub</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {publicClone ? (
          <PublicCloneScreen onImport={onImport} onBack={() => setPublicClone(false)} />
        ) : !creds ? (
          <>
            <SetupScreen onSaved={setCreds} />
            {/* Opção sem token */}
            <div className="px-4 pb-5 shrink-0">
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-gray-700/40" />
                <span className="text-[10px] text-gray-600">ou</span>
                <div className="flex-1 h-px bg-gray-700/40" />
              </div>
              <button
                onClick={() => setPublicClone(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-purple-700/40 bg-purple-900/10 text-purple-400 rounded-xl text-[13px] font-semibold hover:bg-purple-900/20 transition-colors"
              >
                <Download size={14} />
                Baixar repositório público (sem token)
              </button>
            </div>
          </>
        ) : (
          <MainPanel
            creds={creds}
            files={files}
            projectName={projectName}
            onImport={onImport}
            onDisconnect={handleDisconnect}
            defaultView={defaultView}
          />
        )}
      </div>
    </div>
  );
}
