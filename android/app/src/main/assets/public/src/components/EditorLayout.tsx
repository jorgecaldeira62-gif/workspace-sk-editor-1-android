import { useState, useCallback, useRef, useEffect } from "react";
import DatabasePanel from "./DatabasePanel";
import DeployPanel from "./DeployPanel";
import {
  Files, Terminal as TerminalIcon, Eye, GitBranch,
  Menu, X, Plus, Download, Upload, FolderOpen, Save, FileCode,
  Undo2, Redo2, Play, Package, ChevronDown, Trash2,
  ChevronLeft, ChevronRight, BookOpen, Search, MoreHorizontal,
  Bot, Settings2, FilePlus, FolderPlus, Scale, MessageSquare, Mic,
  Camera, History, CheckSquare, RotateCcw, Clock, Maximize2, Globe, HardDrive,
  RefreshCw,
} from "lucide-react";

// ─── Tipos de Checkpoint e Taski ─────────────────────────────────────────────
interface Checkpoint {
  id: string;
  label: string;
  timestamp: number;
  files: Record<string, string>;
  fileCount: number;
}

interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

// ─── Modal de nome de arquivo/pasta ──────────────────────────────────────────
function NameInputModal({
  title, placeholder, defaultValue, icon, confirmLabel = "Criar", onConfirm, onCancel,
}: {
  title: string;
  placeholder: string;
  defaultValue: string;
  icon: React.ReactNode;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      // Seleciona o texto existente (útil no renomear)
      inputRef.current?.select();
    }, 80);
    return () => clearTimeout(t);
  }, []);
  const submit = () => { const v = value.trim(); if (v) onConfirm(v); };
  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
        <div className="bg-[#222e18] border-t border-gray-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/30">
            <div className="flex items-center gap-2.5">
              {icon}
              <p className="text-base font-bold text-white">{title}</p>
            </div>
            <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-600">
              <X size={17} />
            </button>
          </div>
          <div className="px-5 pt-4 pb-6 space-y-4">
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-4 py-3.5 bg-[#0d0d0d] border border-gray-700/50 rounded-2xl text-[16px] text-gray-200 placeholder-gray-700 outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/20"
            />
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-white/5 border border-gray-700/40 text-gray-400 rounded-2xl text-[15px] font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!value.trim()}
                className="flex-1 py-3 bg-green-600 disabled:opacity-40 text-white rounded-2xl text-[15px] font-bold hover:bg-green-500 transition-colors"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
import { VirtualFileSystem, getLanguageFromPath } from "@/lib/virtual-fs";
import { cloneRepo } from "@/lib/github-service";
import { templates } from "@/lib/templates";
import FileTree from "./FileTree";
import CodeEditor, { CodeEditorHandle } from "./CodeEditor";
import WebContainerTerminal from "./WebContainerTerminal";
import ElectronTerminal from "./ElectronTerminal";
import Preview from "./Preview";
import AIChat, { AIScope } from "./AIChat";
import GitHubPanel from "./GitHubPanel";
import PackageSearch from "./PackageSearch";
import DriveBackupPanel from "./DriveBackupPanel";
import Manual from "./Manual";
import CombinarApps from "./CombinarApps";
import SystemStatusPanel from "./SystemStatusPanel";
import SiteExtractor from "./SiteExtractor";
import BuildPanel from "./BuildPanel";
import FileScanner from "./FileScanner";
import { exportAsZip, importFromZip } from "@/lib/zip-service";

interface EditorLayoutProps {
  vfs: VirtualFileSystem;
  projectName: string;
  onNewProject: () => void;
  onSaveProject?: (name: string) => void;
  onOpenCampoLivre?: () => void;
  onOpenAssistenteJuridico?: () => void;
  onBackToProjects?: () => void;
}

const ENCODINGS = ["UTF-8", "UTF with BOM", "UTF-16 LE", "UTF-16 BE", "Latin-1"];
const LANGUAGES = [
  "plaintext", "javascript", "typescript", "html", "css", "json",
  "python", "java", "cpp", "c", "csharp", "go", "rust", "ruby",
  "php", "swift", "kotlin", "yaml", "markdown", "sql", "graphql",
  "shell", "dockerfile", "xml", "scss",
];

// ─── Gerador de árvore ASCII ──────────────────────────────────────────────────
function buildAsciiTree(files: string[]): string {
  type TNode = { [k: string]: TNode };
  const root: TNode = {};
  files.forEach(f => {
    const parts = f.split("/");
    let cur = root;
    parts.forEach(p => { if (!cur[p]) cur[p] = {}; cur = cur[p]; });
  });

  function sortKeys(subtree: TNode): string[] {
    return Object.keys(subtree).sort((a, b) => {
      const aDir = Object.keys(subtree[a]).length > 0;
      const bDir = Object.keys(subtree[b]).length > 0;
      if (aDir && !bDir) return -1;
      if (!aDir && bDir) return 1;
      return a.localeCompare(b);
    });
  }

  // subtree = o nó atual; name = nome a exibir; prefix = linhas do pai; isLast = ultimo filho?
  function render(subtree: TNode, prefix: string, name: string, isLast: boolean): string {
    const connector = isLast ? "└── " : "├── ";
    const childKeys = sortKeys(subtree);
    const isDir = childKeys.length > 0;
    let result = prefix + connector + name + (isDir ? "/" : "") + "\n";
    childKeys.forEach((child, i) => {
      const childIsLast = i === childKeys.length - 1;
      result += render(subtree[child], prefix + (isLast ? "    " : "│   "), child, childIsLast);
    });
    return result;
  }

  const topKeys = sortKeys(root);
  return topKeys.map((k, i) => render(root[k], "", k, i === topKeys.length - 1).trimEnd()).join("\n");
}

// ─── Gerador principal de documentação/plano ─────────────────────────────────
function generateDocs(vfs: VirtualFileSystem, projectName: string): string {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const allFiles = vfs.listFiles();
  const readSafe = (path: string) => { try { return vfs.readFile(path) || ""; } catch { return ""; } };

  // ── Detectar stack ──────────────────────────────────────────────────────────
  const pkgRaw = readSafe("package.json");
  let pkg: any = {};
  try { pkg = JSON.parse(pkgRaw); } catch { /* ignora */ }
  const deps: Record<string, string> = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const depNames = Object.keys(deps);

  const hasReact     = depNames.includes("react") || allFiles.some(f => f.endsWith(".tsx") || f.endsWith(".jsx"));
  const hasVite      = depNames.includes("vite") || allFiles.some(f => f === "vite.config.ts" || f === "vite.config.js");
  const hasNextJs    = depNames.includes("next");
  const hasExpress   = depNames.includes("express");
  const hasFlask     = allFiles.some(f => f.endsWith(".py")) && (readSafe("requirements.txt") + readSafe("app.py")).includes("flask");
  const hasPython    = allFiles.some(f => f.endsWith(".py"));
  const hasTypeScript = depNames.includes("typescript") || allFiles.some(f => f.endsWith(".ts") || f.endsWith(".tsx"));
  const hasTailwind  = depNames.includes("tailwindcss");
  const hasPrisma    = depNames.includes("prisma") || depNames.includes("@prisma/client");
  const hasDrizzle   = depNames.includes("drizzle-orm");
  const hasPostgres  = depNames.includes("pg") || depNames.includes("postgres") || depNames.includes("@neondatabase/serverless");
  const hasMongo     = depNames.includes("mongoose") || depNames.includes("mongodb");
  const hasSQLite    = depNames.includes("better-sqlite3") || depNames.includes("sqlite3");
  const hasHTML      = allFiles.some(f => f.endsWith(".html"));

  // Stack label
  const frontStack: string[] = [];
  if (hasNextJs) frontStack.push("Next.js");
  else if (hasReact) frontStack.push("React" + (hasVite ? " + Vite" : ""));
  if (hasTypeScript) frontStack.push("TypeScript");
  if (hasTailwind) frontStack.push("Tailwind CSS");
  if (hasPython && hasFlask) frontStack.push("Python + Flask");
  else if (hasPython) frontStack.push("Python");
  if (hasHTML && !hasReact && !hasPython) frontStack.push("HTML + CSS + JavaScript");

  const backStack: string[] = [];
  if (hasExpress) backStack.push("Node.js + Express");
  if (hasPostgres) backStack.push("PostgreSQL" + (depNames.includes("@neondatabase/serverless") ? " (Neon)" : ""));
  if (hasMongo) backStack.push("MongoDB");
  if (hasSQLite) backStack.push("SQLite");
  if (hasPrisma) backStack.push("Prisma ORM");
  if (hasDrizzle) backStack.push("Drizzle ORM");

  // Tipo do app
  const appType = hasNextJs ? "Aplicacao Web Full-Stack (Next.js)"
    : (hasReact && hasExpress) ? "Full-Stack (React + Express)"
    : hasReact ? "Aplicacao Web Frontend (React)"
    : hasExpress ? "Backend/API (Node.js + Express)"
    : hasFlask ? "Backend/API (Python + Flask)"
    : hasHTML ? "Site/Pagina Web (HTML/CSS/JS)"
    : hasPython ? "Script / Aplicacao Python"
    : "Projeto de Codigo";

  // ── Detectar rotas da API ───────────────────────────────────────────────────
  const apiRoutes: string[] = [];
  const routeRegex = /(?:router|app)\.(get|post|put|patch|delete|use)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  allFiles.filter(f => f.endsWith(".ts") || f.endsWith(".js")).forEach(f => {
    const content = readSafe(f);
    let m: RegExpExecArray | null;
    const re = new RegExp(routeRegex.source, "gi");
    while ((m = re.exec(content)) !== null) {
      const method = m[1].toUpperCase().padEnd(6);
      const path = m[2];
      if (!path.includes("{{") && path !== "/") {
        apiRoutes.push(`${method} ${path}  (em ${f})`);
      }
    }
  });

  // ── Detectar variáveis de ambiente ─────────────────────────────────────────
  const envVars = new Set<string>();
  const envRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
  allFiles.filter(f => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".py")).forEach(f => {
    const content = readSafe(f);
    let m: RegExpExecArray | null;
    const re = new RegExp(envRegex.source, "g");
    while ((m = re.exec(content)) !== null) {
      if (m[1] !== "NODE_ENV") envVars.add(m[1]);
    }
  });
  // .env files
  [".env", ".env.example", ".env.local"].forEach(ef => {
    readSafe(ef).split("\n").forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (m) envVars.add(m[1]);
    });
  });

  // ── Scripts npm ────────────────────────────────────────────────────────────
  const scripts = pkg.scripts || {};

  // ── Arquivos principais ────────────────────────────────────────────────────
  const mainFiles = allFiles.filter(f =>
    ["index.ts","index.js","main.ts","main.tsx","app.ts","app.js","app.py","main.py",
     "server.ts","server.js","App.tsx","App.jsx","index.tsx","index.html"].includes(f.split("/").pop() || "")
  ).slice(0, 10);

  // ── Contagem de linhas totais ──────────────────────────────────────────────
  const totalLines = allFiles.reduce((sum, f) => sum + (readSafe(f).split("\n").length), 0);

  // ── Arvore ASCII ───────────────────────────────────────────────────────────
  const asciiTree = buildAsciiTree(allFiles);

  // ── Função: explicar arquivo pelo nome/extensão ─────────────────────────
  function explainFile(filePath: string): string {
    const name = filePath.split("/").pop() || filePath;
    const nameLower = name.toLowerCase();
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const base = name.replace(/\.[^.]+$/, "").toLowerCase();
    // Configurações e infra
    if (name === "package.json") return "Registro de dependencias e scripts do projeto. Aqui ficam os comandos (npm run dev, npm start) e os pacotes instalados.";
    if (name === "tsconfig.json") return "Configuracao do TypeScript. Diz para o computador como interpretar o codigo .ts e .tsx.";
    if (name === "vite.config.ts" || name === "vite.config.js") return "Configuracao do Vite (servidor de desenvolvimento). Define a porta, alias de caminhos e plugins usados.";
    if (name === "tailwind.config.ts" || name === "tailwind.config.js") return "Configuracao do Tailwind CSS — a biblioteca de estilos visuais usada no projeto.";
    if (name === "postcss.config.js" || name === "postcss.config.cjs") return "Configuracao do PostCSS, necessaria para o Tailwind processar os estilos.";
    if (name === ".env" || name === ".env.local" || name === ".env.example") return "Arquivo de variaveis secretas (senhas, chaves de API). NUNCA suba este arquivo para o GitHub.";
    if (name === "Dockerfile") return "Instrucoes para criar um container Docker do projeto (para deploy em servidores).";
    if (name === "docker-compose.yml") return "Define multiplos containers Docker que rodam juntos (ex: app + banco de dados).";
    if (name === ".gitignore") return "Lista de arquivos/pastas que o Git deve IGNORAR (nao versionar). Ex: node_modules, .env";
    if (name === "README.md") return "Documentacao principal do projeto. Explica o que o projeto faz e como rodar.";
    if (name === "PLANO.md") return "Este documento! Gerado automaticamente pelo SK Code Editor com toda a estrutura do projeto.";
    if (name === "MANUAL.md") return "Manual explicativo em linguagem simples, feito para entender o projeto sem precisar de conhecimento tecnico profundo.";
    if (name === "schema.prisma") return "Esquema do banco de dados (tabelas, colunas, relacoes) escrito em linguagem Prisma.";
    if (name === "drizzle.config.ts") return "Configuracao do Drizzle ORM — gerencia a conexao e migracao do banco de dados.";
    if (name === "index.html") return "Pagina HTML raiz do projeto. E o ponto de entrada que o browser carrega primeiro.";
    // Extensoes
    if (ext === "md") return "Arquivo de documentacao em Markdown (texto formatado com #titulos, **negrito**, listas).";
    if (ext === "sql") return "Script SQL — contem comandos para criar tabelas, inserir ou consultar dados no banco.";
    if (ext === "csv") return "Planilha de dados em formato texto (valores separados por virgula).";
    if (ext === "json") {
      if (base.includes("manifest")) return "Manifesto do PWA — define nome, icone e configuracoes para instalar o app no celular.";
      return "Arquivo de dados ou configuracao no formato JSON (chave: valor).";
    }
    if (ext === "css" || ext === "scss" || ext === "sass") return "Arquivo de estilos visuais — cores, tamanhos, fontes, espacamentos da interface.";
    if (ext === "svg") return "Imagem vetorial (icone ou ilustracao que nao perde qualidade ao ampliar).";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") return "Arquivo de imagem.";
    if (ext === "py") {
      if (nameLower.includes("model")) return "Modelos de dados Python (classes que representam entidades como Usuario, Produto...).";
      if (nameLower.includes("route") || nameLower.includes("view")) return "Rotas/views do backend Python — define quais URLs o servidor responde.";
      if (nameLower.includes("test")) return "Arquivo de testes automatizados em Python.";
      if (nameLower.includes("config")) return "Configuracoes do projeto Python.";
      return "Arquivo Python — codigo de logica ou script de automacao.";
    }
    // Componentes React
    if (ext === "tsx" || ext === "jsx") {
      if (base === "app" || base === "App") return "Componente RAIZ do frontend — e o pai de todos os outros componentes. Aqui ficam as rotas principais.";
      if (base === "main" || base === "index") return "Ponto de entrada do React — monta o componente App na pagina HTML.";
      // Nomes especificos
      if (base.toLowerCase().includes("layout")) return "Componente de LAYOUT — define a estrutura visual da pagina (cabecalho, sidebar, rodape). Envolve outros componentes.";
      if (base.toLowerCase().includes("card")) return "Componente CARD (cartao) — exibe uma informacao em um bloco visual com borda e sombra. Muito usado para listas de items.";
      if (base.toLowerCase().includes("modal")) return "Componente MODAL — janela/popup que aparece sobre a tela pedindo uma acao ou mostrando uma informacao importante.";
      if (base.toLowerCase().includes("button") || base.toLowerCase().includes("btn")) return "Componente de BOTAO — elemento clicavel reutilizavel com estilo padrao do projeto.";
      if (base.toLowerCase().includes("header") || base.toLowerCase().includes("navbar") || base.toLowerCase().includes("nav")) return "Componente de NAVEGACAO/CABECALHO — barra superior com logo, menu e links de navegacao.";
      if (base.toLowerCase().includes("footer")) return "Componente de RODAPE — parte inferior da pagina com links, copyright e informacoes extras.";
      if (base.toLowerCase().includes("sidebar")) return "Componente de BARRA LATERAL — menu ou painel que aparece na lateral da tela.";
      if (base.toLowerCase().includes("form")) return "Componente de FORMULARIO — campos de entrada de dados (texto, selecao, etc.) com validacao.";
      if (base.toLowerCase().includes("input")) return "Componente de CAMPO DE ENTRADA — elemento de input com estilo personalizado.";
      if (base.toLowerCase().includes("table")) return "Componente de TABELA — exibe dados em linhas e colunas.";
      if (base.toLowerCase().includes("list")) return "Componente de LISTA — exibe uma colecao de items de forma organizada.";
      if (base.toLowerCase().includes("item")) return "Componente de ITEM — representa um elemento individual dentro de uma lista ou colecao.";
      if (base.toLowerCase().includes("page") || base.toLowerCase().includes("screen") || base.toLowerCase().includes("view")) return "Componente de PAGINA/TELA — representa uma tela completa navegavel no app.";
      if (base.toLowerCase().includes("dashboard")) return "Componente de PAINEL DE CONTROLE — tela principal com resumo de dados e acesso rapido as funcoes.";
      if (base.toLowerCase().includes("chart") || base.toLowerCase().includes("graph")) return "Componente de GRAFICO — visualizacao de dados em forma de grafico (barras, linhas, pizza...).";
      if (base.toLowerCase().includes("login") || base.toLowerCase().includes("auth") || base.toLowerCase().includes("signin")) return "Componente de LOGIN/AUTENTICACAO — tela de entrada com usuario e senha.";
      if (base.toLowerCase().includes("register") || base.toLowerCase().includes("signup") || base.toLowerCase().includes("cadastro")) return "Componente de CADASTRO — formulario para criar nova conta de usuario.";
      if (base.toLowerCase().includes("profile") || base.toLowerCase().includes("perfil")) return "Componente de PERFIL — exibe e edita informacoes do usuario logado.";
      if (base.toLowerCase().includes("search") || base.toLowerCase().includes("busca")) return "Componente de BUSCA — campo e logica para filtrar/encontrar conteudo.";
      if (base.toLowerCase().includes("toast") || base.toLowerCase().includes("notification") || base.toLowerCase().includes("alert")) return "Componente de NOTIFICACAO/ALERTA — mensagem temporaria que aparece na tela (ex: 'Salvo com sucesso!').";
      if (base.toLowerCase().includes("loading") || base.toLowerCase().includes("spinner")) return "Componente de CARREGAMENTO — animacao visual que aparece enquanto dados estao sendo buscados.";
      if (base.toLowerCase().includes("empty") || base.toLowerCase().includes("placeholder")) return "Componente de ESTADO VAZIO — exibido quando nao ha dados para mostrar (ex: 'Nenhum resultado encontrado').";
      if (base.toLowerCase().includes("error") || base.toLowerCase().includes("erro")) return "Componente de ERRO — exibido quando algo da errado, com mensagem explicativa.";
      if (base.toLowerCase().includes("provider")) return "Componente PROVIDER — 'fornece' dados/funcoes para todos os componentes filhos via Context API do React.";
      if (base.toLowerCase().includes("context")) return "CONTEXT do React — mecanismo para compartilhar dados entre componentes sem passar por props.";
      if (base.toLowerCase().includes("icon")) return "Componente de ICONE — imagem/simbolo visual pequeno reutilizavel.";
      if (base.toLowerCase().includes("avatar")) return "Componente AVATAR — foto ou iniciais do usuario em formato circular.";
      if (base.toLowerCase().includes("badge")) return "Componente BADGE (etiqueta) — pequeno indicador com numero ou status (ex: '3 novas mensagens').";
      if (base.toLowerCase().includes("tag") || base.toLowerCase().includes("chip")) return "Componente TAG/CHIP — rotulo pequeno para categorizar ou classificar um item.";
      if (base.toLowerCase().includes("menu") || base.toLowerCase().includes("dropdown")) return "Componente de MENU/DROPDOWN — lista de opcoes que aparece ao clicar em um botao.";
      if (base.toLowerCase().includes("dialog")) return "Componente DIALOG — caixa de dialogo que exige resposta do usuario (confirmar, cancelar...).";
      if (base.toLowerCase().includes("tabs") || base.toLowerCase().includes("tab")) return "Componente de ABAS — permite alternar entre diferentes secoes de conteudo com clique.";
      if (base.toLowerCase().includes("accordion")) return "Componente ACCORDION — secoes que abrem/fecham ao clicar, economizando espaco na tela.";
      if (base.toLowerCase().includes("stepper") || base.toLowerCase().includes("wizard")) return "Componente WIZARD/STEPPER — guia o usuario por multiplos passos em sequencia.";
      if (base.toLowerCase().includes("map")) return "Componente de MAPA — exibe mapa geografico (geralmente Google Maps ou Leaflet).";
      if (base.toLowerCase().includes("editor")) return "Componente EDITOR — area de edicao de texto, codigo ou conteudo rico.";
      if (base.toLowerCase().includes("preview")) return "Componente PREVIEW — exibe uma visualizacao de algo antes de salvar/publicar.";
      if (base.toLowerCase().includes("upload")) return "Componente UPLOAD — permite selecionar e enviar arquivos.";
      if (base.toLowerCase().includes("settings") || base.toLowerCase().includes("config") || base.toLowerCase().includes("configuracao")) return "Componente de CONFIGURACOES — tela onde o usuario ajusta preferencias do app.";
      if (base.toLowerCase().includes("home") || base.toLowerCase().includes("inicio")) return "Componente HOME — pagina/tela inicial do app.";
      if (base.toLowerCase().includes("product") || base.toLowerCase().includes("produto")) return "Componente de PRODUTO — exibe informacoes de um produto (nome, preco, imagem...).";
      if (base.toLowerCase().includes("order") || base.toLowerCase().includes("pedido")) return "Componente de PEDIDO — gerencia ou exibe informacoes de um pedido/compra.";
      if (base.toLowerCase().includes("cart") || base.toLowerCase().includes("carrinho")) return "Componente CARRINHO — lista de produtos selecionados para compra.";
      if (base.toLowerCase().includes("payment") || base.toLowerCase().includes("checkout") || base.toLowerCase().includes("pagamento")) return "Componente de PAGAMENTO/CHECKOUT — tela de finalizacao de compra.";
      if (base.toLowerCase().includes("chat") || base.toLowerCase().includes("message") || base.toLowerCase().includes("mensagem")) return "Componente de CHAT/MENSAGENS — interface de conversa em tempo real.";
      if (base.toLowerCase().includes("comment") || base.toLowerCase().includes("comentario")) return "Componente de COMENTARIOS — exibe e permite adicionar comentarios a um conteudo.";
      if (base.toLowerCase().includes("calendar") || base.toLowerCase().includes("agenda")) return "Componente CALENDARIO/AGENDA — visualizacao e selecao de datas e eventos.";
      return "Componente React — parte visual reutilizavel da interface do usuario.";
    }
    // Hooks React
    if ((ext === "ts" || ext === "tsx") && (base.startsWith("use") || base.toLowerCase().startsWith("use"))) {
      const hookName = base.replace(/^use/i, "");
      if (hookName.toLowerCase().includes("auth")) return "HOOK de autenticacao — gerencia o estado de login/logout do usuario.";
      if (hookName.toLowerCase().includes("fetch") || hookName.toLowerCase().includes("api") || hookName.toLowerCase().includes("data")) return "HOOK de dados — busca informacoes da API e gerencia estado de carregamento e erro.";
      if (hookName.toLowerCase().includes("local") || hookName.toLowerCase().includes("storage")) return "HOOK de armazenamento local — salva e recupera dados do localStorage do browser.";
      if (hookName.toLowerCase().includes("theme") || hookName.toLowerCase().includes("dark")) return "HOOK de tema — gerencia modo claro/escuro da interface.";
      if (hookName.toLowerCase().includes("modal")) return "HOOK de modal — controla abertura e fechamento de janelas modais.";
      if (hookName.toLowerCase().includes("form")) return "HOOK de formulario — gerencia valores, validacao e submissao de formularios.";
      if (hookName.toLowerCase().includes("window") || hookName.toLowerCase().includes("resize") || hookName.toLowerCase().includes("screen")) return "HOOK de tela — detecta o tamanho da janela para layouts responsivos.";
      if (hookName.toLowerCase().includes("debounce")) return "HOOK debounce — atrasa a execucao de uma funcao para evitar chamadas excessivas (ex: busca ao digitar).";
      if (hookName.toLowerCase().includes("click") || hookName.toLowerCase().includes("outside")) return "HOOK de clique externo — detecta quando o usuario clica fora de um elemento.";
      return `HOOK React personalizado para gerenciar estado/comportamento de '${hookName || "funcionalidade especifica"}'.`;
    }
    // TS/JS puro
    if (ext === "ts" || ext === "js") {
      if (base.toLowerCase().includes("util") || base.toLowerCase().includes("helper")) return "Funcoes UTILITARIAS — ferramentas reutilizaveis de uso geral no projeto.";
      if (base.toLowerCase().includes("api") || base.toLowerCase().includes("service") || base.toLowerCase().includes("client")) return "Arquivo de SERVICO/API — funcoes para comunicar com o servidor ou API externa.";
      if (base.toLowerCase().includes("route") || base.toLowerCase().includes("router")) return "Arquivo de ROTAS — define as URLs/enderecos respondidos pelo servidor.";
      if (base.toLowerCase().includes("middleware")) return "MIDDLEWARE — funcao que processa requisicoes antes de chegar na rota final (ex: verificar login).";
      if (base.toLowerCase().includes("model") || base.toLowerCase().includes("schema")) return "Arquivo de MODELO — define a estrutura dos dados (tabelas, campos, tipos).";
      if (base.toLowerCase().includes("controller")) return "CONTROLLER — logica de negocio que processa as requisicoes e retorna respostas.";
      if (base.toLowerCase().includes("store") || base.toLowerCase().includes("state")) return "STORE de estado — gerencia o estado global do app (dados compartilhados entre telas).";
      if (base.toLowerCase().includes("type") || base.toLowerCase().includes("interface") || base.toLowerCase().includes("dto")) return "Arquivo de TIPOS — define as estruturas de dados (interfaces TypeScript) usadas no projeto.";
      if (base.toLowerCase().includes("constant") || base.toLowerCase().includes("config")) return "Arquivo de CONSTANTES/CONFIGURACAO — valores fixos usados em varios lugares do projeto.";
      if (base.toLowerCase().includes("test") || base.toLowerCase().includes("spec")) return "Arquivo de TESTES — verifica automaticamente se o codigo funciona corretamente.";
      if (base.toLowerCase().includes("seed")) return "Arquivo SEED — popula o banco de dados com dados iniciais/de teste.";
      if (base.toLowerCase().includes("migration")) return "MIGRACAO de banco de dados — altera a estrutura do banco (adiciona tabelas, colunas...).";
      if (base === "index") return "Arquivo INDEX — ponto de entrada da pasta, exporta tudo que esta dentro.";
      return "Arquivo TypeScript/JavaScript — logica, funcoes ou modulo do projeto.";
    }
    return `Arquivo ${ext.toUpperCase()} — parte do projeto.`;
  }

  function explainFolder(folder: string): string {
    const f = folder.toLowerCase();
    if (f === "src") return "Codigo-fonte principal do projeto. Nao apague esta pasta.";
    if (f === "components") return "Pecas visuais reutilizaveis da interface (botoes, cards, formularios...).";
    if (f === "pages" || f === "screens" || f === "views") return "Telas completas do app — cada arquivo aqui e uma pagina navegavel.";
    if (f === "routes" || f === "router") return "Definicao das URLs e navegacao do app.";
    if (f === "hooks") return "Hooks React customizados — logica reutilizavel de estado e efeitos.";
    if (f === "lib" || f === "utils" || f === "helpers") return "Funcoes auxiliares reutilizaveis em varios lugares do projeto.";
    if (f === "api" || f === "services") return "Comunicacao com servidor, banco de dados ou APIs externas.";
    if (f === "store" || f === "context" || f === "state") return "Gerenciamento de estado global — dados compartilhados entre telas.";
    if (f === "types" || f === "interfaces" || f === "dto") return "Definicoes de tipos TypeScript — contratos de dados.";
    if (f === "assets" || f === "public" || f === "static") return "Arquivos estaticos: imagens, icones, fontes, arquivos publicos.";
    if (f === "styles" || f === "css" || f === "scss") return "Arquivos de estilo visual — cores, fontes, layout.";
    if (f === "config") return "Arquivos de configuracao do projeto.";
    if (f === "middleware") return "Funcoes intermediarias que processam requisicoes antes das rotas.";
    if (f === "models" || f === "entities") return "Modelos de dados — representacao das tabelas do banco de dados.";
    if (f === "controllers") return "Controladores — logica de negocios para cada rota da API.";
    if (f === "tests" || f === "__tests__" || f === "test") return "Testes automatizados — verificam se o codigo funciona corretamente.";
    if (f === "migrations") return "Historico de alteracoes do banco de dados.";
    if (f === "seeds") return "Dados iniciais para popular o banco em desenvolvimento.";
    if (f === "dist" || f === "build" || f === "out") return "Codigo compilado/gerado automaticamente — NAO edite diretamente.";
    if (f === "node_modules") return "Pacotes instalados pelo npm — NAO edite e NAO envie para o GitHub.";
    if (f === "prisma") return "Arquivos do Prisma ORM: schema do banco e migracoes.";
    if (f === "drizzle") return "Arquivos do Drizzle ORM: schema e migracoes do banco.";
    if (f === "ui") return "Componentes de UI (interface) basicos e genericos.";
    if (f === "layouts") return "Estruturas de layout — esqueletos de pagina com cabecalho, sidebar, etc.";
    if (f === "icons") return "Icones do projeto.";
    return `Pasta '${folder}' — agrupamento de arquivos relacionados.`;
  }

  // ── Construir guia de pastas e arquivos ────────────────────────────────────
  const folderMap = new Map<string, string[]>();
  allFiles.forEach(f => {
    const parts = f.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "(raiz)";
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder)!.push(f);
  });
  // Ordena: raiz primeiro, depois pastas por profundidade
  const sortedFolders = [...folderMap.keys()].sort((a, b) => {
    if (a === "(raiz)") return -1;
    if (b === "(raiz)") return 1;
    return a.split("/").length - b.split("/").length || a.localeCompare(b);
  });

  // ── Montar documento ────────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`# PLANO DO PROJETO: ${projectName}`);
  lines.push("");
  lines.push(`> Gerado automaticamente pelo SK Code Editor em ${now}`);
  lines.push(`> **${allFiles.length} arquivo(s)** | **~${totalLines.toLocaleString("pt-BR")} linhas de codigo**`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## RESUMO EXECUTIVO");
  lines.push("");
  lines.push(`- **Tipo de aplicacao:** ${appType}`);
  if (frontStack.length) lines.push(`- **Frontend / Stack principal:** ${frontStack.join(", ")}`);
  if (backStack.length) lines.push(`- **Backend / Dados:** ${backStack.join(", ")}`);
  if (pkg.version) lines.push(`- **Versao:** ${pkg.version}`);
  if (pkg.description) lines.push(`- **Descricao:** ${pkg.description}`);
  lines.push("");

  // Comando para rodar
  lines.push("**Para rodar o projeto:**");
  lines.push("```bash");
  if (scripts.dev)     lines.push("npm install && npm run dev");
  else if (scripts.start) lines.push("npm install && npm start");
  else if (hasPython)  lines.push("pip install -r requirements.txt && python main.py");
  else if (hasHTML)    lines.push("# Abra index.html no Preview (botao Play)");
  else                 lines.push("npm install");
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");

  // Arvore
  lines.push("## ESTRUTURA DE ARQUIVOS");
  lines.push("");
  lines.push("```");
  lines.push(projectName + "/");
  lines.push(asciiTree);
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");

  // Stack detalhado
  lines.push("## STACK TECNOLOGICO DETECTADO");
  lines.push("");
  if (frontStack.length) lines.push(`- **Frontend:** ${frontStack.join(", ")}`);
  if (backStack.length)  lines.push(`- **Backend:** ${backStack.join(", ")}`);
  if (depNames.length) {
    const allDepsStr = depNames.join(", ");
    lines.push(`- **Todos os pacotes (${depNames.length}):** ${allDepsStr}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Rotas
  if (apiRoutes.length > 0) {
    lines.push("## ROTAS DA API (endpoints detectados automaticamente)");
    lines.push("");
    lines.push("```");
    apiRoutes.forEach(r => lines.push(r));
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Scripts
  if (Object.keys(scripts).length > 0) {
    lines.push("## SCRIPTS DISPONIVEIS (package.json)");
    lines.push("");
    lines.push("```bash");
    Object.entries(scripts).forEach(([k, v]) => lines.push(`npm run ${k.padEnd(12)}  # ${v}`));
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Variaveis de ambiente
  if (envVars.size > 0) {
    lines.push("## VARIAVEIS DE AMBIENTE NECESSARIAS");
    lines.push("");
    lines.push("Crie um arquivo `.env` na raiz com estas variaveis:");
    lines.push("");
    lines.push("```env");
    [...envVars].forEach(v => lines.push(`${v}=seu_valor_aqui`));
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Arquivos principais
  if (mainFiles.length > 0) {
    lines.push("## ARQUIVOS PRINCIPAIS");
    lines.push("");
    mainFiles.forEach(f => {
      const desc = f.includes("server") || f === "app.ts" || f === "app.js" ? "Ponto de entrada do backend"
        : f.includes("App.tsx") || f.includes("App.jsx") ? "Componente raiz do frontend"
        : f === "index.html" ? "Pagina HTML principal"
        : f === "main.py" || f === "app.py" ? "Aplicacao Python principal"
        : "Arquivo principal";
      lines.push(`- \`${f}\` — ${desc}`);
    });
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // ── GUIA COMPLETO — pasta por pasta, arquivo por arquivo ──────────────────
  lines.push("## GUIA COMPLETO — O QUE CADA PARTE DO PROJETO FAZ");
  lines.push("");
  lines.push("> Esta secao explica, em linguagem simples, o que e para que serve cada pasta e cada arquivo.");
  lines.push("");

  sortedFolders.forEach(folder => {
    const folderFiles = folderMap.get(folder)!;
    // Titulo da pasta
    if (folder === "(raiz)") {
      lines.push("### 📁 Raiz do Projeto (pasta principal)");
      lines.push("> Arquivos de configuracao e pontos de entrada ficam aqui.");
    } else {
      const folderLeaf = folder.split("/").pop() || folder;
      lines.push(`### 📁 \`${folder}/\``);
      lines.push(`> ${explainFolder(folderLeaf)}`);
    }
    lines.push("");
    // Listar arquivos com explicacao
    folderFiles.forEach(filePath => {
      const fileName = filePath.split("/").pop() || filePath;
      const explanation = explainFile(filePath);
      const lineCount = readSafe(filePath).split("\n").length;
      lines.push(`**\`${fileName}\`** _(${lineCount} linha${lineCount !== 1 ? "s" : ""})_`);
      lines.push(`${explanation}`);
      lines.push("");
    });
    lines.push("---");
    lines.push("");
  });

  // Contexto para IA
  lines.push("## CONTEXTO PARA IA (copie e cole para continuar o projeto)");
  lines.push("");
  lines.push("> Use este bloco para explicar o projeto para qualquer IA ou desenvolvedor:");
  lines.push("");
  lines.push("```");
  lines.push(`Projeto: ${projectName}`);
  lines.push(`Tipo: ${appType}`);
  if (frontStack.length) lines.push(`Stack: ${[...frontStack, ...backStack].join(", ")}`);
  lines.push(`Arquivos: ${allFiles.length} | Linhas: ~${totalLines.toLocaleString("pt-BR")}`);
  if (apiRoutes.length) lines.push(`Rotas API: ${apiRoutes.length} endpoint(s) detectado(s)`);
  if (envVars.size) lines.push(`Variaveis de ambiente necessarias: ${[...envVars].join(", ")}`);
  lines.push("");
  lines.push("Estrutura principal:");
  allFiles.forEach(f => lines.push(`  ${f}`));
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`*Plano gerado pelo SK Code Editor — ${now}*`);

  return lines.join("\n");
}

function generateSystemInfo(projectName: string, fileCount: number): string {
  const now = new Date().toLocaleString("pt-BR");
  return `# SK Code Editor — Informações do Sistema

> Gerado em: ${now}
> Projeto: **${projectName}** · ${fileCount} arquivo(s)

---

## Terminal

O terminal executa JavaScript real no browser e simula comandos de sistema:

### O que funciona:
- \`node <arquivo.js>\` — executa JavaScript **real** (async/await suportado!)
- \`fetch("https://api.exemplo.com")\` — **acesso à internet funcionando** para APIs com CORS
- \`require('node-fetch')\` ou \`require('axios')\` → usa fetch nativo do browser automaticamente
- \`require('fs')\` — lê e escreve arquivos do projeto virtual
- \`npm install <pacote>\` — atualiza package.json do projeto
- \`ls\`, \`cat\`, \`mkdir\`, \`touch\`, \`rm\`, \`cp\`, \`mv\` — operações de arquivo
- \`echo\`, \`pwd\`, \`clear\`, \`env\` — utilitários
- \`git status\`, \`git log\` — informações do projeto

### Sobre acesso à internet:
- ✅ APIs públicas com CORS habilitado: OpenAI, GitHub, JSONPlaceholder, etc.
- ✅ \`fetch("https://api.github.com/users/nome")\` funciona direto
- ⚠️  Algumas APIs bloqueiam chamadas do browser (CORS) — nesses casos use um backend real
- ❌ WebSockets e streams em tempo real não funcionam no modo browser

### Sobre Python:
- \`python <arquivo.py>\` — **simulado** (mostra prints estáticos)
- Para Python real: use Replit, Google Colab, ou instale localmente

---

## Assistente IA

### Escopos de contexto:
| Escopo | O que é enviado | Tokens estimados |
|--------|----------------|-----------------|
| Projeto | Até 60 arquivos (10k chars cada, total 80k) | ~40.000–200.000 |
| Pasta | Arquivos da pasta atual (12k chars cada) | ~3.000–30.000 |
| Arquivo | Só o arquivo ativo (40k chars) | ~500–10.000 |
| Nenhum | Apenas sua mensagem | ~100–500 |

### Limites por modelo (tokens de entrada):
| Modelo | Limite entrada | Limite saída |
|--------|--------------|-------------|
| GPT-4o | 128.000 tokens | 16.384 tokens |
| GPT-4o-mini | 128.000 tokens | 16.384 tokens |
| GPT-3.5-turbo | 16.385 tokens | 4.096 tokens |
| Claude 3.5 Sonnet | 200.000 tokens | 8.096 tokens |
| Claude 3 Haiku | 200.000 tokens | 4.096 tokens |
| Gemini 1.5 Pro | 1.000.000 tokens | 8.192 tokens |
| Gemini 1.5 Flash | 1.000.000 tokens | 8.192 tokens |

> 1 token ≈ 4 caracteres em inglês / ≈ 3 caracteres em português

### Comandos que a IA entende:
- \`filepath:caminho/arquivo.ext\` — cria/atualiza arquivo no projeto
- Blocos \`\`\`bash\`\`\` — exibe botão "Executar no Terminal"
- Você pode pedir: "crie", "corrija", "explique", "refatore", "adicione testes"

---

## Atalhos do Editor

| Ação | Atalho |
|------|--------|
| Salvar | Ctrl+S / ⌘S |
| Desfazer | Ctrl+Z |
| Refazer | Ctrl+Y / Ctrl+Shift+Z |
| Buscar | Ctrl+F |
| Substituir | Ctrl+H |
| Ir para linha | Ctrl+G |
| Formatar | Shift+Alt+F |
| Comentar linha | Ctrl+/ |
| Duplicar linha | Shift+Alt+↓ |
| Mover linha | Alt+↑/↓ |
| Selecionar tudo | Ctrl+A |

---

## Armazenamento

- **Índice de projetos:** \`localStorage['sk-editor-projects']\` (apenas metadados)
- **Arquivos de cada projeto:** \`localStorage['sk-proj-files-{id}']\` (chave separada por projeto)
- **Projeto atual:** \`localStorage['sk-editor-current']\`
- **Auto-save:** a cada 8 segundos e em cada mudança de arquivo
- **Capacidade:** projetos grandes suportados — cada projeto tem sua própria cota de armazenamento
- **Backup seguro:** use ☁️ Backup no Google Drive para projetos maiores que 5MB
- **Exportar tudo:** Painel de Arquivos → ··· na raiz → Exportar como ZIP

---

## Versão

SK Code Editor · Editor de código mobile-first em português  
Monaco Editor + WebAssembly Terminal + IA integrada  
`;
}

export default function EditorLayout({ vfs, projectName, onNewProject, onSaveProject, onOpenCampoLivre, onOpenAssistenteJuridico, onBackToProjects }: EditorLayoutProps) {
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileHistory, setFileHistory] = useState<string[]>([]);
  const [fileHistoryIndex, setFileHistoryIndex] = useState(-1);

  // Overlay panel states (mobile-first)
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [githubDefaultView, setGithubDefaultView] = useState<"home" | "push-new" | "push-existing" | "clone" | "pages-deploy" | undefined>();
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [bottomPanel, setBottomPanel] = useState<"terminal" | "preview">("terminal");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [terminalRunningCmd, setTerminalRunningCmd] = useState<string>("");
  const [serverInfo, setServerInfo] = useState<{ running: boolean; port: number } | null>(null);
  const [previewBig, setPreviewBig] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDrivePanel, setShowDrivePanel] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [showCheckpointPanel, setShowCheckpointPanel] = useState(false);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(() => {
    try {
      const raw = localStorage.getItem("sk-checkpoints") || "[]";
      const all: Checkpoint[] = JSON.parse(raw);
      // Limita automaticamente a 5 checkpoints para proteger a cota
      return Array.isArray(all) ? all.slice(0, 5) : [];
    } catch { return []; }
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { return JSON.parse(localStorage.getItem("sk-tasks") || "[]"); } catch { return []; }
  });
  const [newTaskText, setNewTaskText] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showEncoding, setShowEncoding] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showPrefsPanel, setShowPrefsPanel] = useState(false);
  const [triggerVoice, setTriggerVoice] = useState(false);
  const [triggerPreviewFullscreen, setTriggerPreviewFullscreen] = useState(false);
  const [showPreviewToast, setShowPreviewToast] = useState(false);
  const [showNewAppWizard, setShowNewAppWizard] = useState(false);
  const [showDBPanel, setShowDBPanel] = useState(false);
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [showManualPanel, setShowManualPanel] = useState(false);
  const [showCombinarAppsPanel, setShowCombinarAppsPanel] = useState(false);
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [showSiteExtractor, setShowSiteExtractor] = useState(false);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showFileScanner, setShowFileScanner] = useState(false);
  const [dbConnectionString, setDbConnectionString] = useState<string>(() => localStorage.getItem("sk-db-url") || "");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [dbSQLInput, setDbSQLInput] = useState("SELECT NOW();");
  const [dbQueryResult, setDbQueryResult] = useState<{ rows: any[]; rowCount: number; command: string; error?: string } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [newAppCreatedToast, setNewAppCreatedToast] = useState<string | null>(null);

  const [tree, setTree] = useState(vfs.getTree());
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [packageInput, setPackageInput] = useState("");
  const [packageType, setPackageType] = useState<"npm" | "pip">("npm");
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("sk-theme") !== "light"; } catch { return true; }
  });
  const [pendingTermCmd, setPendingTermCmd] = useState<string | undefined>();
  const [terminalTab, setTerminalTab] = useState<1 | 2 | 3>(1);
  const [wcExternalCommand, setWcExternalCommand] = useState<string | undefined>();
  const [useWebContainer, setUseWebContainer] = useState(() => {
    try { return localStorage.getItem("sk-use-wc") === "1"; } catch { return false; }
  });
  const [externalAIMsg, setExternalAIMsg] = useState<string | undefined>();
  // Captura output do terminal para enviar à IA como contexto
  const [lastTermOutput, setLastTermOutput] = useState<{ cmd: string; output: string; ok: boolean } | undefined>();
  const [terminalBuffer, setTerminalBuffer] = useState<string>("");
  const [termHasError, setTermHasError] = useState(false);
  // ── Modo do Terminal:
  //    "online"  = usa servidor (Replit) — bash de verdade, mas precisa do server.
  //    "offline" = JavaScript simulado — não precisa de nada, instala simulado.
  //    "real"    = WebContainer — Node.js de verdade rodando no navegador, instala de verdade.
  const [terminalMode, setTerminalMode] = useState<"online" | "offline" | "real">(() => {
    try {
      const saved = localStorage.getItem("sk-terminal-mode");
      if (saved === "online" || saved === "offline" || saved === "real") return saved;
    } catch {}
    // Auto-detecta: se for PWA instalado (standalone) ou APK → tenta REAL primeiro (Node.js de verdade)
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // @ts-expect-error iOS Safari
        window.navigator.standalone === true ||
        window.location.protocol === "file:";
      if (isStandalone) {
        // Se o navegador suporta WebContainer (cross-origin isolated), usa real; senão cai no offline
        const supportsReal = typeof SharedArrayBuffer !== "undefined" && (window as any).crossOriginIsolated;
        return supportsReal ? "real" : "offline";
      }
    }
    return "online";
  });
  useEffect(() => {
    try { localStorage.setItem("sk-terminal-mode", terminalMode); } catch {}
  }, [terminalMode]);
  const [encoding, setEncoding] = useState("UTF-8");
  const [forcedLanguage, setForcedLanguage] = useState<string | undefined>();
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["__root__"]));
  const [aiScope, setAiScope] = useState<AIScope>("project");
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [, setTick] = useState(0);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<CodeEditorHandle>(null);

  // Modal de nomear arquivo/pasta (substitui prompt() que não funciona bem no PWA)
  const [nameModal, setNameModal] = useState<{
    title: string;
    placeholder: string;
    defaultValue: string;
    icon: React.ReactNode;
    confirmLabel?: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  const openNameModal = useCallback((opts: {
    title: string;
    placeholder: string;
    defaultValue?: string;
    icon: React.ReactNode;
    confirmLabel?: string;
    onConfirm: (value: string) => void;
  }) => {
    setNameModal({ defaultValue: "", ...opts });
  }, []);

  useEffect(() => {
    const unsub = vfs.onChange(() => { setTree(vfs.getTree()); setTick(t => t + 1); });
    return () => { unsub(); };
  }, [vfs]);

  const autoExpandPath = useCallback((filePath: string) => {
    const parts = filePath.split("/");
    if (parts.length > 1) {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        let cur = "";
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur ? `${cur}/${parts[i]}` : parts[i];
          next.add(cur);
        }
        return next;
      });
    }
  }, []);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleFileSelect = useCallback((path: string) => {
    const content = vfs.readFile(path);
    if (content === undefined) return;
    if (!openFiles.includes(path)) {
      // Limite de 3 abas — fecha a mais antiga ao abrir nova
      setOpenFiles(prev => {
        const next = [...prev, path];
        return next.length > 3 ? next.slice(-3) : next;
      });
    }
    setActiveFile(path);
    setFileContents(prev => ({ ...prev, [path]: content }));
    setForcedLanguage(undefined);
    autoExpandPath(path);
    setShowFilePanel(false);

    setFileHistory(prev => {
      const trimmed = prev.slice(0, fileHistoryIndex + 1);
      if (trimmed[trimmed.length - 1] === path) return prev;
      return [...trimmed, path];
    });
    setFileHistoryIndex(prev => prev + 1);
  }, [openFiles, vfs, autoExpandPath, fileHistoryIndex]);

  const navigateBack = useCallback(() => {
    if (fileHistoryIndex > 0) {
      const path = fileHistory[fileHistoryIndex - 1];
      setFileHistoryIndex(prev => prev - 1);
      const content = vfs.readFile(path);
      if (content !== undefined) {
        if (!openFiles.includes(path)) setOpenFiles(prev => [...prev, path]);
        setActiveFile(path);
        setFileContents(prev => ({ ...prev, [path]: content }));
      }
    }
  }, [fileHistory, fileHistoryIndex, vfs, openFiles]);

  const navigateForward = useCallback(() => {
    if (fileHistoryIndex < fileHistory.length - 1) {
      const path = fileHistory[fileHistoryIndex + 1];
      setFileHistoryIndex(prev => prev + 1);
      const content = vfs.readFile(path);
      if (content !== undefined) {
        if (!openFiles.includes(path)) setOpenFiles(prev => [...prev, path]);
        setActiveFile(path);
        setFileContents(prev => ({ ...prev, [path]: content }));
      }
    }
  }, [fileHistory, fileHistoryIndex, vfs, openFiles]);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles(prev => prev.filter(f => f !== path));
    if (activeFile === path) {
      const remaining = openFiles.filter(f => f !== path);
      setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  }, [activeFile, openFiles]);

  const handleEditorChange = useCallback((value: string) => {
    if (!activeFile) return;
    vfs.writeFile(activeFile, value);
    setFileContents(prev => ({ ...prev, [activeFile]: value }));
  }, [activeFile, vfs]);

  const handleCreateFile = useCallback((parentPath: string) => {
    openNameModal({
      title: "Novo Arquivo",
      placeholder: "ex: index.html, App.tsx, main.py",
      icon: <FilePlus size={18} className="text-blue-400" />,
      onConfirm: (name) => {
        const path = parentPath ? `${parentPath}/${name}` : name;
        vfs.writeFile(path, "");
        handleFileSelect(path);
        setNameModal(null);
      },
    });
  }, [vfs, handleFileSelect, openNameModal]);

  const handleCreateFolder = useCallback((parentPath: string) => {
    openNameModal({
      title: "Nova Pasta",
      placeholder: "ex: src, components, pages",
      icon: <FolderPlus size={18} className="text-amber-400" />,
      onConfirm: (name) => {
        const path = parentPath ? `${parentPath}/${name}` : name;
        vfs.writeFile(`${path}/.gitkeep`, "");
        setExpandedDirs(prev => new Set([...prev, path]));
        setNameModal(null);
      },
    });
  }, [vfs, openNameModal]);

  const handleDeleteNode = useCallback((path: string) => {
    if (!confirm(`Excluir "${path}"?`)) return;
    vfs.deleteFile(path);
    setOpenFiles(prev => prev.filter(f => !f.startsWith(path)));
    if (activeFile?.startsWith(path)) setActiveFile(null);
  }, [vfs, activeFile]);

  const handleRenameNode = useCallback((path: string) => {
    const parts = path.split("/");
    const currentName = parts[parts.length - 1];
    const isDir = !currentName.includes(".");
    openNameModal({
      title: "Renomear",
      placeholder: currentName,
      defaultValue: currentName,
      icon: isDir
        ? <FolderPlus size={18} className="text-amber-400" />
        : <FilePlus size={18} className="text-blue-400" />,
      confirmLabel: "Renomear",
      onConfirm: (newName) => {
        if (newName === currentName) { setNameModal(null); return; }
        parts[parts.length - 1] = newName;
        const newPath = parts.join("/");
        vfs.renameFile(path, newPath);
        setOpenFiles(prev => prev.map(f => f === path ? newPath : f));
        if (activeFile === path) setActiveFile(newPath);
        setNameModal(null);
      },
    });
  }, [vfs, activeFile, openNameModal]);

  const handleDuplicateNode = useCallback((path: string) => {
    const content = vfs.readFile(path);
    if (content === undefined) return;
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const ext = name.includes(".") ? "." + name.split(".").pop() : "";
    const base = ext ? name.slice(0, -ext.length) : name;
    parts[parts.length - 1] = `${base}-copia${ext}`;
    vfs.writeFile(parts.join("/"), content);
  }, [vfs]);

  const getFileContent = useCallback((path: string) => vfs.readFile(path), [vfs]);
  const getAllFilesUnder = useCallback((prefix: string) => {
    return vfs.listFiles().filter(f => f === prefix || f.startsWith(prefix + "/")).map(p => ({ path: p, content: vfs.readFile(p) || "" }));
  }, [vfs]);

  const handleRunInTerminal = useCallback((cmd: string) => {
    // Abre o terminal MAS mantém Raquel aberta — Saulo precisa ver os dois ao mesmo tempo
    setShowBottomPanel(true);
    setBottomPanel("terminal");
    setTimeout(() => setPendingTermCmd(cmd), 120);
  }, []);

  const handleAnalyzeWithAI = useCallback((path: string, isDir: boolean) => {
    // Monta prompt com o conteúdo do arquivo ou pasta
    let prompt = "";
    if (path === "/" || isDir) {
      const prefix = path === "/" ? "" : path;
      const files = vfs.listFiles().filter(f => prefix === "" || f === prefix || f.startsWith(prefix + "/"));
      const contents = files.slice(0, 20).map(f => {
        const c = vfs.readFile(f) || "";
        return `\n--- ${f} ---\n${c.slice(0, 8000)}`;
      }).join("");
      prompt = `Analise a ${path === "/" ? "pasta raiz do projeto" : `pasta "${path}"`} e dê um diagnóstico completo: estrutura, possíveis bugs, melhorias, e próximos passos recomendados.\n\nARQUIVOS:${contents}`;
    } else {
      const content = vfs.readFile(path) || "";
      prompt = `Analise o arquivo "${path}" detalhadamente: aponte bugs, problemas de lógica, boas práticas que faltam, sugestões de melhoria, e se necessário corrija o código.\n\n--- ${path} ---\n${content.slice(0, 40000)}`;
    }
    setShowAIPanel(true);
    setShowFilePanel(false);
    // Pequeno delay para garantir que o painel IA esteja montado
    setTimeout(() => setExternalAIMsg(prompt), 200);
  }, [vfs]);

  // ── Sincroniza arquivos do editor → workspace do servidor ────────────────────
  // Envia só o arquivo ativo para o servidor (leve, sem risco de 413)
  const syncActiveFileToServer = useCallback(async (filePath: string): Promise<boolean> => {
    try {
      const content = vfs.readFile(filePath) || "";
      const resp = await fetch("/api/workspace/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath.replace(/^\//, ""), content }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }, [vfs]);

  // Sync manual completo — exclui node_modules, .git e arquivos > 500 KB
  const syncFilesToServer = useCallback(async (): Promise<boolean> => {
    setSyncStatus("syncing");
    try {
      const paths = vfs.listFiles();
      const files = paths
        .filter(p => {
          if (p.includes("node_modules") || p.includes("/.git/")) return false;
          const content = vfs.readFile(p) || "";
          return content.length <= 500_000; // pula arquivos > 500 KB
        })
        .map(p => ({ path: p.replace(/^\//, ""), content: vfs.readFile(p) || "" }));
      const resp = await fetch("/api/workspace/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      setSyncStatus(resp.ok ? "ok" : "error");
      setTimeout(() => setSyncStatus("idle"), 6000);
      return resp.ok;
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
      return false;
    }
  }, [vfs]);

  const handleInstallPackage = useCallback(() => {
    const pkg = packageInput.trim();
    if (!pkg) return;
    // No terminal (que agora começa no workspace), npm install funciona de verdade
    if (packageType === "npm") {
      handleRunInTerminal(`npm install ${pkg}`);
    } else {
      handleRunInTerminal(`pip3 install ${pkg}`);
    }
    setPackageInput("");
    setShowPackages(false);
  }, [packageInput, packageType, handleRunInTerminal]);

  const handleRun = useCallback(async () => {
    if (!activeFile) return;
    const ext = activeFile.split(".").pop()?.toLowerCase() ?? "";
    // Tipos que renderizam visualmente no Preview
    const previewTypes = ["html", "htm", "svg", "json", "md", "markdown", "css", "scss", "js", "ts", "mjs", "cjs"];
    if (previewTypes.includes(ext)) {
      setShowBottomPanel(true);
      setBottomPanel("preview");
      return;
    }
    // Envia só o arquivo ativo para o servidor ANTES de executar (evita 413)
    setShowBottomPanel(true);
    setBottomPanel("terminal");
    // Terminal proxy/Termux não precisa de sync com servidor
    // Agora o terminal está no workspace e encontra os arquivos
    const filename = activeFile.replace(/^\//, "");
    let cmd = "";
    if (ext === "py") cmd = `python3 "${filename}"`;
    else if (ext === "sh") cmd = `bash "${filename}"`;
    else if (["js", "mjs", "cjs"].includes(ext)) cmd = `node "${filename}"`;
    else if (ext === "ts") cmd = `node --experimental-strip-types "${filename}" 2>/dev/null || npx ts-node "${filename}"`;
    else { setShowBottomPanel(true); setBottomPanel("preview"); return; }
    handleRunInTerminal(cmd);
  }, [activeFile, handleRunInTerminal, syncActiveFileToServer, terminalMode]);

  const handleApplyCode = useCallback((path: string, content: string) => {
    vfs.writeFile(path, content);
    handleFileSelect(path);
    autoExpandPath(path);
    // Se aplicou um HTML, mostra toast de preview
    if (path.endsWith(".html") || path === "index.html") {
      setBottomPanel("preview");
      setShowBottomPanel(true);
      setShowPreviewToast(true);
      setTimeout(() => setShowPreviewToast(false), 5000);
    }
  }, [vfs, handleFileSelect, autoExpandPath]);

  const handleImportFromGitHub = useCallback((files: Record<string, string>) => {
    vfs.clear(); vfs.fromJSON(files);
    setOpenFiles([]); setActiveFile(null); setFileContents({});
    setShowGitHub(false);
  }, [vfs]);

  const handleGitClone = useCallback(async (owner: string, repo: string) => {
    const imported = await cloneRepo({ token: "", username: "" }, owner, repo);
    if (Object.keys(imported).length === 0) throw new Error("Nenhum arquivo encontrado. O repositório é privado ou não existe.");
    vfs.clear(); vfs.fromJSON(imported);
    setOpenFiles([]); setActiveFile(null); setFileContents({});
  }, [vfs]);

  const handleGenerateDocs = useCallback(() => {
    const content = generateDocs(vfs, projectName);
    vfs.writeFile("PLANO.md", content);
    handleFileSelect("PLANO.md");
    setShowMoreMenu(false);
  }, [vfs, projectName, handleFileSelect]);

  const handleOpenRaquelPerfil = useCallback(() => {
    const existing = vfs.readFile(".sk/perfil-raquel.md");
    if (!existing) {
      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const initial = `# 🧠 Perfil de Aprendizado — Raquel
> Criado em: ${now}
> Este arquivo é mantido e atualizado pela própria Raquel conforme aprende sobre Saulo e o projeto.
> Você pode editar, corrigir ou adicionar informações aqui a qualquer momento.

---

## Sobre Você

- **Profissão:** Advogado
- **Limitação física:** Deficiência nos membros superiores — usa principalmente comandos de voz
- **Estilo de comunicação:** Prefere respostas curtas e diretas, em português simples
- **Como confirma ações:** Costuma dizer "pode", "pode continuar", "ok", "vai"
- **O que evitar:** Jargão técnico sem explicação, respostas muito longas para ler

---

## Preferências de Trabalho

- Gosta de saber o que foi feito sem precisar ler tudo
- Prefere que a conversa tenha continuidade natural
- Aprecia quando a IA sugere o próximo passo
- Usa o editor principalmente para projetos pessoais e jurídicos

---

## Sobre o Projeto Atual

> (Raquel vai preencher esta seção conforme aprende sobre o projeto)

---

## O que Raquel Aprendeu até Agora

> (Atualizado automaticamente pela Raquel ao longo das conversas)
`;
      // Garante que a pasta .sk existe criando o arquivo diretamente
      vfs.writeFile(".sk/perfil-raquel.md", initial);
    }
    handleFileSelect(".sk/perfil-raquel.md");
    setShowFilePanel(false);
  }, [vfs, handleFileSelect]);

  const handleGenerateManual = useCallback(() => {
    const manual = `# 📖 Manual do Desenvolvedor — SK Code Editor
> Guia em linguagem simples para entender o que cada coisa significa.
> Sem jargão técnico. Feito para você, Saulo.

---

## 🗂️ O que significa cada pasta aqui no Replit

### 📁 \`artifacts/\`
É a pasta principal do projeto. Dentro dela ficam as duas partes do aplicativo:

- **\`api-server/\`** → O **servidor** (o "motor" que roda por trás das cenas).
  Ele é quem executa comandos no terminal, faz conexão com banco de dados, e responde as chamadas do app.
  Pense nele como a **cozinha de um restaurante** — o cliente não vê, mas é ele que faz tudo funcionar.

- **\`code-editor/\`** → A **interface visual** (o que você vê na tela).
  É o editor de código, os painéis, os botões, a Raquel, o terminal, o preview.
  Pense nele como o **salão do restaurante** — o que o cliente vê e usa.

---

### 📁 \`src/\` (dentro de cada artifact)
Significa **"source"** = código-fonte. É onde fica o código que você escreve/edita.
Nunca apague essa pasta — é o coração do projeto.

---

### 📁 \`src/components/\`
São as **peças visuais** da tela. Cada arquivo aqui é um "pedaço" da interface:
- \`EditorLayout.tsx\` → A tela principal do editor (organiza tudo)
- \`AIChat.tsx\` → O painel da Raquel (assistente IA)
- \`RealTerminal.tsx\` → O terminal (onde você roda comandos)
- \`Preview.tsx\` → O painel de visualização do site/app
- \`FileTree.tsx\` → A árvore de arquivos (painel esquerdo)
- \`GitHubPanel.tsx\` → O painel de integração com o GitHub

---

### 📁 \`src/routes/\` (só no api-server)
São os **endereços** que o servidor responde. Como as "portas" de entrada do servidor.
Exemplos:
- \`/api/exec\` → Roda um comando no terminal
- \`/api/db/query\` → Faz uma consulta no banco de dados
- \`/api/ai/chat\` → Conversa com a IA (Raquel)
- \`/api/ws/terminal\` → Abre o terminal ao vivo

---

### 📁 \`src/lib/\`
São **funções utilitárias** — ferramentas pequenas usadas em vários lugares do código.
Exemplo: \`virtual-fs.ts\` é o sistema de arquivos virtual (salva seus arquivos na memória do browser).

---

### 📁 \`public/\`
Arquivos **públicos** que o browser pode acessar diretamente:
- \`manifest.json\` → Configuração do PWA (ícone, nome, cor do app)
- \`icons/\` → Os ícones do app (aparecem na tela inicial do celular)
- Imagens e arquivos estáticos

---

### 📁 \`node_modules/\`
**NÃO MEXA AQUI.** São as bibliotecas externas instaladas automaticamente.
É como a "despensa" do projeto — cheia de ingredientes prontos.
Gerada automaticamente pelo \`npm install\` / \`pnpm install\`.

---

### 📁 \`dist/\`
Versão **compilada** do código (gerada automaticamente ao fazer o build).
Você não edita nada aqui — é criado pelo sistema na hora de publicar.

---

## 📄 O que significa cada tipo de arquivo

| Arquivo | O que é |
|---------|---------|
| \`package.json\` | Lista de bibliotecas usadas e comandos disponíveis (npm start, npm run build, etc.) |
| \`pnpm-workspace.yaml\` | Diz ao gerenciador de pacotes quais pastas fazem parte do projeto |
| \`tsconfig.json\` | Configuração do TypeScript (linguagem que usamos) |
| \`vite.config.ts\` | Configuração do servidor de desenvolvimento (serve o app no browser) |
| \`.env\` | Variáveis secretas (senhas, chaves de API) — nunca compartilhe esse arquivo |
| \`*.tsx\` | Código React (interface visual com TypeScript) |
| \`*.ts\` | Código TypeScript puro (lógica, sem visual) |
| \`*.yaml\` / \`*.yml\` | Arquivos de configuração (como uma lista de instruções formatada) |
| \`*.md\` | Markdown — texto formatado (como este manual!) |
| \`index.ts\` / \`index.tsx\` | **Ponto de entrada** — onde o programa começa a rodar |

---

## 🪝 O que são "Hooks" (\`use*.ts\` / \`use*.tsx\`)
São funções especiais do React que **guardam estado** ou **executam ações**.
Sempre começam com a palavra \`use\`.
Exemplos:
- \`useState\` → Guarda um valor que muda (ex: se o painel está aberto ou fechado)
- \`useEffect\` → Executa algo quando a tela carrega ou um valor muda
- \`useCallback\` → Otimiza uma função para não recriar desnecessariamente

---

## 🎛️ Painéis do SK Code Editor

| Painel | Como abrir | O que faz |
|--------|-----------|----------|
| **Arquivos** | Botão 📁 no rodapé | Mostra todos os arquivos do projeto |
| **Terminal** | Botão ⬛ no rodapé | Executa comandos (npm install, node server.js, etc.) |
| **Preview** | Botão 🌐 no rodapé | Mostra o site/app rodando ao vivo |
| **Raquel (IA)** | Botão 🤖 no rodapé | Assistente de código com IA |
| **GitHub** | Menu ··· | Importa/exporta projetos do GitHub |
| **Banco de Dados** | Menu ··· | Conecta ao PostgreSQL/Neon e roda SQL |
| **Taski** | Menu ··· | Lista de tarefas do projeto |
| **Checkpoints** | Menu ··· | Histórico de versões salvas manualmente |

---

## 🧩 Glossário Rápido

| Termo | Significado simples |
|-------|-------------------|
| **API** | "Porta de comunicação" entre o app e o servidor |
| **WebSocket** | Conexão ao vivo (sem precisar ficar atualizando a página) |
| **PTY / Terminal** | Janela de linha de comando (como o Prompt do Windows, mas no Linux) |
| **VFS** | Sistema de arquivos virtual — os arquivos ficam na memória do browser |
| **PWA** | "Aplicativo instalável" — site que funciona como app no celular |
| **Build** | Processo de "empacotar" o código para publicar |
| **Deploy** | Publicar o app na internet |
| **Frontend** | A parte visual (o que o usuário vê) |
| **Backend** | A parte do servidor (o "motor" escondido) |
| **npm / pnpm** | Gerenciadores de pacotes — instalam bibliotecas externas |
| **Import** | Usar uma função/componente de outro arquivo |
| **Props** | Dados passados de um componente pai para um filho |
| **Estado (State)** | Valor que pode mudar e atualiza a tela automaticamente |
| **Render** | O processo de mostrar/atualizar a tela |

---

## 🔑 O que é o Replit (a plataforma)

O **Replit** é o ambiente onde o app roda durante o desenvolvimento. Ele fornece:
- Servidor Linux online (sem precisar de computador próprio)
- Editor de código no browser
- Gerenciamento de segredos (variáveis de ambiente)
- Publicação do app com um clique (Publish/Deploy)
- Checkpoints automáticos do código

---

*Manual gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} — SK Code Editor*
`;
    vfs.writeFile("MANUAL.md", manual);
    handleFileSelect("MANUAL.md");
    setShowMoreMenu(false);
    setShowFilePanel(false);
  }, [vfs, handleFileSelect]);

  const currentContent = activeFile ? (fileContents[activeFile] ?? vfs.readFile(activeFile) ?? "") : "";
  const currentLang = forcedLanguage || (activeFile ? getLanguageFromPath(activeFile) : "plaintext");
  const canBack = fileHistoryIndex > 0;
  const canForward = fileHistoryIndex < fileHistory.length - 1;

  // ── Checkpoint: salva snapshot completo do VFS ──────────────────────────────
  const saveCheckpoint = useCallback((labelOverride?: string) => {
    const files = vfs.toJSON() as Record<string, string>;
    const cp: Checkpoint = {
      id: Date.now().toString(),
      label: labelOverride || `Checkpoint ${new Date().toLocaleTimeString("pt-BR")}`,
      timestamp: Date.now(),
      files,
      fileCount: Object.keys(files).length,
    };
    const updated = [cp, ...checkpoints].slice(0, 5); // máx 5 para não estourar localStorage
    setCheckpoints(updated);

    // Salva com fallback progressivo caso a cota do localStorage estoure
    const tryPersist = (list: Checkpoint[]) => {
      try {
        localStorage.setItem("sk-checkpoints", JSON.stringify(list));
      } catch {
        if (list.length > 1) {
          tryPersist(list.slice(0, Math.floor(list.length / 2))); // reduz pela metade
        } else {
          // Último recurso: salva só metadados sem conteúdo de arquivo
          try {
            const slim = list.map(c => ({ ...c, files: {} }));
            localStorage.setItem("sk-checkpoints", JSON.stringify(slim));
          } catch { /* sem espaço nenhum — ignora silenciosamente */ }
        }
      }
    };
    tryPersist(updated);
    return cp;
  }, [vfs, checkpoints]);

  const restoreCheckpoint = useCallback((cp: Checkpoint) => {
    if (!confirm(`Restaurar checkpoint "${cp.label}"?\nIsso vai substituir todos os arquivos atuais.`)) return;
    vfs.clear();
    Object.entries(cp.files).forEach(([path, content]) => vfs.writeFile(path, content));
    setOpenFiles([]);
    setActiveFile(null);
    setFileContents({});
    setTree(vfs.getTree());
    setShowCheckpointPanel(false);
  }, [vfs]);

  const deleteCheckpoint = useCallback((id: string) => {
    const updated = checkpoints.filter(c => c.id !== id);
    setCheckpoints(updated);
    try { localStorage.setItem("sk-checkpoints", JSON.stringify(updated)); } catch { /* cota cheia */ }
  }, [checkpoints]);

  // ── Taski: gerencia lista de tarefas ─────────────────────────────────────────
  const addTask = useCallback((text: string) => {
    if (!text.trim()) return;
    const t: Task = { id: Date.now().toString(), text: text.trim(), done: false, createdAt: Date.now() };
    const updated = [...tasks, t];
    setTasks(updated);
    localStorage.setItem("sk-tasks", JSON.stringify(updated));
    setNewTaskText("");
  }, [tasks]);

  const toggleTask = useCallback((id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    localStorage.setItem("sk-tasks", JSON.stringify(updated));
  }, [tasks]);

  const deleteTask = useCallback((id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    localStorage.setItem("sk-tasks", JSON.stringify(updated));
  }, [tasks]);

  // ── Auto-save no disco via Electron ──────────────────────────────────────────
  const electronFS = (window as any).electronAPI?.fs;
  const isElectron = !!(window as any).electronAPI?.isElectron;

  useEffect(() => {
    if (!isElectron || !electronFS) return;
    const autoSaveOn = localStorage.getItem("sk-autosave-disk") === "1";
    if (!autoSaveOn) return;
    // Auto-save debounced a cada 15s quando há mudanças
    const timer = setInterval(() => {
      const files = vfs.toJSON() as Record<string, string>;
      if (Object.keys(files).length === 0) return;
      electronFS.saveProject(projectName, files).catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [isElectron, electronFS, vfs, projectName]);

  // ── Executar SQL no banco via API ─────────────────────────────────────────────
  const runDBQuery = useCallback(async (sql?: string) => {
    const s = sql || dbSQLInput;
    if (!dbConnectionString.trim()) { setDbQueryResult({ rows: [], rowCount: 0, command: "", error: "Configure a URL de conexão primeiro." }); return; }
    if (!s.trim()) return;
    setDbLoading(true); setDbQueryResult(null);
    try {
      const r = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: dbConnectionString.trim(), sql: s }),
      });
      const data = await r.json();
      if (!r.ok) setDbQueryResult({ rows: [], rowCount: 0, command: "", error: data.error || "Erro desconhecido" });
      else setDbQueryResult(data);
    } catch (e: any) {
      setDbQueryResult({ rows: [], rowCount: 0, command: "", error: e.message });
    } finally { setDbLoading(false); }
  }, [dbConnectionString, dbSQLInput]);

  // ── Aplicar template ao VFS ────────────────────────────────────────────────
  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    vfs.clear();
    Object.entries(tmpl.files).forEach(([p, c]) => vfs.writeFile(p, c));
    setOpenFiles([]);
    setActiveFile(null);
    setFileContents({});
    const firstFile = Object.keys(tmpl.files)[0];
    if (firstFile) setTimeout(() => handleFileSelect(firstFile), 100);
    setShowNewAppWizard(false);
    setNewAppCreatedToast(tmpl.name);
    setTimeout(() => setNewAppCreatedToast(null), 3500);
  }, [vfs]);

  const anyOverlay = showFilePanel || showGitHub || showMoreMenu;

  return (
    <div className={`h-[100dvh] flex flex-col bg-[#0d0d0d] text-white overflow-hidden${isDark ? "" : " sk-light-theme"}`}>
      <input ref={zipInputRef} type="file" accept=".zip,.tar,.tar.gz,.tgz,.apk,.aab,.ipa,.jar" onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        try {
          const imp = await importFromZip(f);
          vfs.clear(); vfs.fromJSON(imp); setOpenFiles([]); setActiveFile(null); setFileContents({});
          if (f.name.endsWith(".apk") || f.name.endsWith(".aab") || f.name.endsWith(".ipa")) {
            const fileCount = Object.keys(imp).length;
            const mainFiles = Object.keys(imp).filter(p => p.endsWith(".js") || p.endsWith(".ts") || p.endsWith(".html") || p.endsWith(".xml")).slice(0, 3).join(", ");
            alert(`✅ ${f.name} importado!\n${fileCount} arquivo(s) extraído(s).\n\nArquivos principais: ${mainFiles || "—"}\n\nUse o painel de Arquivos para explorar e a IA para analisar o código.`);
          }
        } catch (err: any) { alert(err.message); }
        e.target.value = "";
      }} className="hidden" />

      {/* ═══ TOP BAR ═══ */}
      <div className="h-11 flex items-center gap-1 px-2 bg-[#141414] border-b border-gray-700/40 shrink-0">
        {/* Left: menu + nav */}
        <button onClick={() => setShowFilePanel(true)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
          <Menu size={18} />
        </button>
        {onBackToProjects && (
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-700/30 hover:bg-green-700/50 border border-green-600/30 text-green-400 text-[11px] font-bold shrink-0"
            title="Voltar à lista de projetos"
          >
            <FolderOpen size={13} />
            <span>Projetos</span>
          </button>
        )}
        <button onClick={navigateBack} disabled={!canBack} className="p-1.5 rounded-lg disabled:opacity-25 text-gray-500 hover:bg-white/5 hover:text-gray-300">
          <ChevronLeft size={17} />
        </button>
        <button onClick={navigateForward} disabled={!canForward} className="p-1.5 rounded-lg disabled:opacity-25 text-gray-500 hover:bg-white/5 hover:text-gray-300">
          <ChevronRight size={17} />
        </button>

        {/* File indicator */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 px-1">
          {activeFile && <FileCode size={13} className="text-blue-400 shrink-0" />}
          <span className="text-sm font-medium text-gray-300 truncate">
            {activeFile ? activeFile.split("/").pop() : projectName}
          </span>
        </div>

        {/* Right: server indicator + search + run + more */}
        {serverInfo?.running && (
          <button
            onClick={() => { setShowBottomPanel(true); setBottomPanel("preview"); }}
            className="flex items-center gap-1.5 px-2 py-1 bg-green-600/20 border border-green-500/40 rounded-lg shrink-0 group"
            title="Servidor rodando — clique para abrir Preview"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-green-400 text-[11px] font-bold">:{serverInfo.port}</span>
          </button>
        )}
        <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-lg hover:bg-white/5 text-gray-500">
          <Search size={17} />
        </button>
        {activeFile && (
          <button onClick={() => void handleRun()} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-[12px] font-bold transition-all">
            <Play size={13} /> Rodar
          </button>
        )}
        {/* Botão Visualizar (Preview tela cheia) */}
        <button
          onClick={() => { setShowBottomPanel(true); setBottomPanel("preview"); setTriggerPreviewFullscreen(true); }}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg text-[12px] font-bold transition-all shrink-0"
          title="Abrir Preview — visualizar o projeto em tela cheia"
        >
          <Eye size={13} /> Visualizar
        </button>
        {/* Toggle tema claro/escuro */}
        <button
          onClick={() => {
            const next = !isDark;
            setIsDark(next);
            try { localStorage.setItem("sk-theme", next ? "dark" : "light"); } catch {}
          }}
          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
          title={isDark ? "Modo claro" : "Modo escuro"}
        >
          {isDark ? "☀️" : "🌑"}
        </button>
        <button onClick={() => { setShowMoreMenu(!showMoreMenu); }} className="p-2 rounded-lg hover:bg-white/5 text-gray-500">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* ═══ TAB BAR (máx 3 abas) ═══ */}
      {openFiles.length > 0 && (
        <div className="h-9 flex items-center bg-[#141414] border-b border-gray-700/30 shrink-0">
          <div className="flex-1 flex items-center overflow-x-auto scrollbar-none h-full">
            {openFiles.map(file => (
              <div key={file}
                className={`flex items-center gap-2 px-3 h-full text-[11px] cursor-pointer border-r border-gray-700/20 shrink-0 transition-colors select-none ${file === activeFile ? "bg-[#0d0d0d] text-gray-200 border-t-2 border-t-blue-500" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}
                onClick={() => handleFileSelect(file)}>
                <span className="max-w-[90px] truncate font-medium">{file.split("/").pop()}</span>
                {/* X bem visível para fechar */}
                <button
                  onClick={e => { e.stopPropagation(); handleCloseFile(file); }}
                  title="Fechar arquivo"
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-all shrink-0">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          {/* Fechar todos */}
          {openFiles.length > 1 && (
            <button
              onClick={() => { setOpenFiles([]); setActiveFile(null); }}
              title="Fechar todos os arquivos"
              className="px-3 h-full text-[10px] text-gray-600 hover:text-red-400 hover:bg-red-900/10 border-l border-gray-700/30 shrink-0 transition-colors whitespace-nowrap font-medium">
              Fechar todos
            </button>
          )}
        </div>
      )}

      {/* ═══ SPLIT WRAPPER: Editor (esquerda) + IA (direita) ═══ */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">

      {/* ── COLUNA ESQUERDA: Editor + Terminal + Barras ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

      {/* ═══ MAIN: Editor + Bottom Panel ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Code Editor */}
        <div className={!showBottomPanel ? "flex-1" : previewBig ? "h-[20%]" : "h-[50%]"}>
          {activeFile ? (
            <CodeEditor ref={editorRef} filePath={activeFile} content={currentContent} onChange={handleEditorChange} language={forcedLanguage}
              onCursorChange={(line, col) => setCursorPos({ line, col })} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-4">
              {/* Botão principal Iniciar Projeto */}
              <button
                onClick={() => {
                  const files = vfs.listFiles();
                  const hasPkg = files.some(f => f === "package.json" || f.endsWith("/package.json"));
                  const hasHtml = files.some(f => f === "index.html" || f.endsWith("/index.html"));
                  if (hasHtml && !hasPkg) {
                    // Projeto HTML estático — abre preview imediatamente
                    setShowBottomPanel(true); setBottomPanel("preview"); setPreviewBig(true);
                  } else if (hasPkg) {
                    // Projeto npm — usa WebContainer Terminal
                    const pkg = vfs.readFile("package.json") || "";
                    const cmd = pkg.includes('"dev"') ? "npm install && npm run dev"
                      : pkg.includes('"start"') ? "npm install && npm start"
                      : "npm install";
                    setUseWebContainer(true);
                    try { localStorage.setItem("sk-use-wc", "1"); } catch {}
                    setShowBottomPanel(true); setBottomPanel("terminal");
                    setTimeout(() => setWcExternalCommand(cmd), 300);
                  } else {
                    // Sem projeto — abre preview vazio com dica
                    setShowBottomPanel(true); setBottomPanel("preview"); setPreviewBig(true);
                  }
                }}
                className="flex flex-col items-center gap-3 px-8 py-6 bg-gradient-to-b from-amber-500/20 to-amber-600/10 border-2 border-amber-500/60 rounded-2xl hover:border-amber-400/80 hover:bg-amber-500/25 transition-all active:scale-[0.98] shadow-lg shadow-amber-900/20"
              >
                <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-center">
                  <Play size={28} className="text-amber-400 ml-1" />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-amber-300">▶ Iniciar Projeto</p>
                  <p className="text-[11px] text-amber-500/80 mt-0.5">npm install + rodar servidor + preview</p>
                </div>
              </button>

              <div className="flex gap-2">
                <button onClick={() => setShowFilePanel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] border border-gray-700/40 rounded-xl text-[12px] text-gray-300 hover:bg-white/5">
                  <Files size={13} /> Arquivos
                </button>
                <button onClick={() => { setShowBottomPanel(true); setBottomPanel("preview"); setTriggerPreviewFullscreen(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-[12px] text-blue-300 hover:bg-blue-600/30">
                  <Eye size={13} /> Visualizar
                </button>
                <button onClick={() => setShowAIPanel(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl text-[12px] text-purple-300 hover:bg-purple-600/30">
                  <Bot size={13} /> IA
                </button>
              </div>

              <p className="text-[10px] text-gray-700 max-w-[240px] leading-relaxed">
                Abra um arquivo para editar, ou clique em <strong className="text-gray-600">▶ Iniciar Projeto</strong> para rodar o servidor e ver o preview.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Panel (Terminal/Preview) */}
        {showBottomPanel && (
          <div className="flex-1 flex flex-col border-t border-gray-700/40 min-h-0">
            <div className="h-9 flex items-center gap-1 bg-[#141414] border-b border-gray-700/30 shrink-0 px-2">
              {(["terminal", "preview"] as const).map(p => (
                <button key={p} onClick={() => { setBottomPanel(p); if (p === "terminal") setPreviewBig(false); }}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${bottomPanel === p ? "bg-[#0d0d0d] text-gray-200" : "text-gray-600 hover:text-gray-400"}`}>
                  {p === "terminal" ? "⬛ Terminal" : "🌐 Preview"}
                </button>
              ))}
              {bottomPanel === "preview" && (
                <button
                  onClick={() => setPreviewBig(v => !v)}
                  className="px-2 py-0.5 rounded text-[11px] text-gray-500 hover:text-gray-300 border border-gray-700/30 hover:border-gray-600/50 transition-all"
                  title={previewBig ? "Reduzir preview" : "Ampliar preview"}
                >
                  {previewBig ? "⬇ Reduzir" : "⬆ Ampliar"}
                </button>
              )}
              <div className="flex-1" />
              {/* Botão Compilar */}
              <button
                onPointerDown={() => {
                  const files = vfs.listFiles();
                  const hasPkg = files.some(f => f === "package.json" || f.endsWith("/package.json"));
                  const hasPy  = files.some(f => f.endsWith(".py"));
                  const hasTs  = files.some(f => f.endsWith(".ts") || f.endsWith(".tsx"));
                  let cmd = "";
                  if (hasPkg) {
                    const pkg = vfs.readFile("package.json") || "";
                    if (pkg.includes('"build"'))      cmd = "npm run build";
                    else if (pkg.includes('"compile"')) cmd = "npm run compile";
                    else if (hasTs)                    cmd = "npx tsc --noEmit";
                    else                               cmd = "npm run build 2>&1 || echo 'Sem script de build'";
                  } else if (hasPy) {
                    cmd = "python -m py_compile $(find . -name '*.py' | head -5 | tr '\\n' ' ') && echo '✅ Python OK'";
                  } else if (hasTs) {
                    cmd = "npx tsc --noEmit";
                  } else {
                    cmd = "echo 'Nenhum projeto detectado para compilar'";
                  }
                  setBottomPanel("terminal");
                  setTimeout(() => setPendingTermCmd(cmd), 80);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[11px] font-bold hover:bg-blue-600/30 transition-all shrink-0"
                title="Compila/verifica o projeto e reporta erros"
              >
                <span className="text-[10px]">🔨</span>
                Compilar
              </button>
              {/* Botão Rodar */}
              <button
                onPointerDown={() => {
                  const files = vfs.listFiles();
                  const hasPkg = files.some(f => f === "package.json" || f.endsWith("/package.json"));
                  const hasPy  = files.some(f => f.endsWith(".py"));
                  let cmd = "npm start";
                  if (hasPkg) {
                    const pkg = vfs.readFile("package.json") || "";
                    if (pkg.includes('"dev"'))         cmd = "npm run dev";
                    else if (pkg.includes('"start"'))  cmd = "npm start";
                    else if (pkg.includes('"build"'))  cmd = "npm run build";
                    else                               cmd = "node index.js";
                  } else if (hasPy) {
                    const py = files.find(f => f === "app.py" || f === "main.py" || f.endsWith("/app.py"));
                    cmd = py ? `python ${py}` : "python main.py";
                  } else {
                    cmd = "ls -la";
                  }
                  setBottomPanel("terminal");
                  setTimeout(() => setPendingTermCmd(cmd), 80);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-[11px] font-bold hover:bg-green-600/30 transition-all shrink-0"
                title="Detecta automaticamente o melhor comando para rodar seu projeto"
              >
                <Play size={11} />
                Rodar
              </button>
              {/* Botão Preview */}
              <button
                onPointerDown={() => setBottomPanel("preview")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 text-[11px] font-bold hover:bg-purple-600/30 transition-all shrink-0"
                title="Abre o preview do projeto"
              >
                <span className="text-[10px]">🌐</span>
                Preview
              </button>
              {/* Botão Limpar Terminal */}
              {bottomPanel === "terminal" && (
                <button
                  onPointerDown={() => setPendingTermCmd("clear")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-700/30 border border-gray-600/30 text-gray-500 text-[11px] hover:text-red-400 hover:border-red-500/30 hover:bg-red-900/10 transition-all shrink-0"
                  title="Limpar terminal (Ctrl+L)"
                >
                  🗑 Limpar
                </button>
              )}
              {/* Botão Pedir Raquel — aparece quando tem erro ou quando clicado */}
              {bottomPanel === "terminal" && terminalBuffer && (
                <button
                  onPointerDown={() => {
                    setShowAIPanel(true);
                    const msg = termHasError
                      ? `❌ Erro no terminal — por favor analise e me diga o que aconteceu:\n\n\`\`\`\n${terminalBuffer.slice(-3000)}\n\`\`\`\n\nExplique o erro em linguagem simples e diga o que preciso fazer para corrigir.`
                      : `📋 Saída recente do terminal:\n\n\`\`\`\n${terminalBuffer.slice(-3000)}\n\`\`\`\n\nAnalise e me diga se está tudo certo ou se tem algo para melhorar.`;
                    setExternalAIMsg(msg);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${termHasError ? "bg-red-600/30 border border-red-500/50 text-red-300 animate-pulse" : "bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30"}`}
                  title={termHasError ? "Erro detectado — pedir Raquel para analisar" : "Enviar terminal para Raquel analisar"}
                >
                  {termHasError ? "❌ Pedir Raquel" : "🤖 Analisar"}
                </button>
              )}
              {/* Botão ▶ Iniciar no cabeçalho do terminal */}
              {bottomPanel === "terminal" && (
                <button
                  onClick={() => {
                    const files = vfs.listFiles();
                    const hasPkg = files.some(f => f === "package.json" || f.endsWith("/package.json"));
                    const hasHtml = files.some(f => f === "index.html" || f.endsWith("/index.html"));
                    if (hasHtml && !hasPkg) {
                      setBottomPanel("preview"); setPreviewBig(true);
                    } else {
                      const pkg = hasPkg ? (vfs.readFile("package.json") || "") : "";
                      const cmd = pkg.includes('"dev"') ? "npm install && npm run dev"
                        : pkg.includes('"start"') ? "npm install && npm start"
                        : "npm install";
                      setUseWebContainer(true);
                      try { localStorage.setItem("sk-use-wc", "1"); } catch {}
                      setTimeout(() => setWcExternalCommand(cmd), 100);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-all shrink-0"
                  title="npm install + npm run dev → abre preview"
                >
                  ▶ Iniciar
                </button>
              )}
              {/* Toggle WebContainer / SK Terminal */}
              {bottomPanel === "terminal" && (
                <button
                  onClick={() => {
                    const next = !useWebContainer;
                    setUseWebContainer(next);
                    try { localStorage.setItem("sk-use-wc", next ? "1" : "0"); } catch {}
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all shrink-0 ml-auto"
                  style={{ background: useWebContainer ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", borderColor: useWebContainer ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.1)", color: useWebContainer ? "#4ade80" : "#6b7280" }}
                  title={useWebContainer ? "Terminal real (WebContainer) — clique para voltar ao modo proxy" : "Terminal proxy — clique para ativar terminal real (WebContainer)"}
                >
                  {useWebContainer ? "🟢 Real" : "⬛ Proxy"}
                </button>
              )}
              <button onClick={() => setShowBottomPanel(false)} className="p-0.5 rounded hover:bg-white/5 text-gray-600 ml-1">
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
              {/* ── Terminal — WebContainer (real) ou SK (proxy) ── */}
              <div
                style={{ display: bottomPanel === "terminal" ? "flex" : "none" }}
                className="absolute inset-0 flex flex-col"
              >
                {/* ── Sub-abas de terminal (Term 1 / 2 / 3) ── */}
                <div className="flex items-center gap-0.5 px-2 h-7 bg-[#0d1117] border-b border-gray-700/30 shrink-0">
                  {([1, 2, 3] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTerminalTab(t)}
                      className="px-2.5 py-0.5 rounded text-[10px] font-mono transition-all"
                      style={{
                        background: terminalTab === t ? "rgba(34,197,94,0.15)" : "transparent",
                        color: terminalTab === t ? "#4ade80" : "#4b5563",
                        border: terminalTab === t ? "1px solid rgba(34,197,94,0.35)" : "1px solid transparent",
                      }}
                    >
                      ▪ Term {t}
                    </button>
                  ))}
                </div>
                {/* ── Instâncias de terminal ── */}
                {isElectron ? (
                  /* Electron: 3 terminais reais, cada um com seu próprio projectKey */
                  ([1, 2, 3] as const).map(t => (
                    <div key={t} style={{ display: terminalTab === t ? "flex" : "none" }} className="flex-1 min-h-0">
                      <ElectronTerminal
                        cwd={undefined}
                        projectKey={`${projectName || "default"}-t${t}`}
                        externalCommand={terminalTab === t ? wcExternalCommand : undefined}
                        onCmdConsumed={() => setWcExternalCommand(undefined)}
                        onServerDetected={(port) => {
                          setServerInfo({ running: true, port });
                          setBottomPanel("preview");
                          setPreviewBig(true);
                          setShowPreviewToast(true);
                          setTimeout(() => setShowPreviewToast(false), 6000);
                          setWcExternalCommand(undefined);
                        }}
                        onCommandDone={() => setWcExternalCommand(undefined)}
                      />
                    </div>
                  ))
                ) : (
                  /* Browser: Tab 1 = WebContainer, Tabs 2 e 3 = Terminal real (server.cjs) */
                  ([1, 2, 3] as const).map(t => (
                    <div key={t} style={{ display: terminalTab === t ? "flex" : "none" }} className="flex-1 min-h-0">
                      {t === 1 ? (
                        <WebContainerTerminal
                          vfs={vfs}
                          externalCommand={terminalTab === 1 ? wcExternalCommand : undefined}
                          onCommandExecuted={() => setWcExternalCommand(undefined)}
                          onServerToggle={(running, port) => {
                            setServerInfo(running && port ? { running, port } : null);
                            if (running && port) {
                              setBottomPanel("preview");
                              setPreviewBig(true);
                              setShowPreviewToast(true);
                              setTimeout(() => setShowPreviewToast(false), 6000);
                            }
                          }}
                        />
                      ) : (
                        <ElectronTerminal
                          projectKey={`browser-t${t}`}
                          externalCommand={terminalTab === t ? wcExternalCommand : undefined}
                          onCmdConsumed={() => setWcExternalCommand(undefined)}
                          onServerDetected={(port) => {
                            setServerInfo({ running: true, port });
                            setBottomPanel("preview");
                          }}
                          onCommandDone={() => setWcExternalCommand(undefined)}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
              {/* ── Preview — sempre montado, só escondido por CSS ── */}
              <div
                style={{ display: bottomPanel === "preview" ? "flex" : "none" }}
                className="absolute inset-0 flex flex-col"
              >
                <Preview
                  vfs={vfs}
                  activeFile={activeFile}
                  openFullscreen={triggerPreviewFullscreen}
                  onFullscreenOpened={() => setTriggerPreviewFullscreen(false)}
                  serverUrl={serverInfo?.running ? `/api/proxy/${serverInfo.port}/` : undefined}
                  serverPort={serverInfo?.port}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="h-8 flex items-center bg-[#141414] border-t border-gray-700/30 px-3 gap-2 shrink-0 overflow-x-auto scrollbar-none">
        {/* Cursor pos */}
        <span className="text-[11px] text-gray-500 shrink-0 font-mono">
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <div className="w-px h-3.5 bg-gray-700/50" />
        <span className="text-[11px] text-gray-600 shrink-0">Sp: 2</span>
        <div className="flex-1" />
        {/* Language — opens bottom sheet */}
        <button
          onClick={() => { setShowLang(true); setShowEncoding(false); }}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 hover:bg-white/8 px-2.5 py-1 rounded-md transition-colors font-medium"
        >
          {currentLang.toUpperCase()}
          <ChevronDown size={10} className="text-gray-600" />
        </button>
        <div className="w-px h-3.5 bg-gray-700/50" />
        <span className="text-[11px] text-gray-600 shrink-0 px-1">LF</span>
        <div className="w-px h-3.5 bg-gray-700/50" />
        {/* Encoding — opens bottom sheet */}
        <button
          onClick={() => { setShowEncoding(true); setShowLang(false); }}
          className="text-[11px] text-gray-400 hover:text-gray-200 hover:bg-white/8 px-2.5 py-1 rounded-md transition-colors font-medium"
        >
          {encoding}
        </button>
      </div>

      {/* Language picker bottom sheet */}
      {showLang && (
        <>
          <div className="fixed inset-0 z-[9980]" onClick={() => setShowLang(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9990] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#141414] border-t border-gray-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/30">
                <p className="text-sm font-bold text-white">Linguagem do Arquivo</p>
                <button onClick={() => setShowLang(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-600"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-3 max-h-64 overflow-y-auto pb-6">
                {LANGUAGES.map(lang => (
                  <button key={lang} onClick={() => { setForcedLanguage(lang === "auto" ? undefined : lang); setShowLang(false); }}
                    className={`px-2 py-2.5 rounded-xl text-[12px] font-medium text-center transition-all ${currentLang === lang ? "bg-blue-600/30 border border-blue-500/50 text-blue-300" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Encoding picker bottom sheet */}
      {showEncoding && (
        <>
          <div className="fixed inset-0 z-[9980]" onClick={() => setShowEncoding(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9990] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#141414] border-t border-gray-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/30">
                <p className="text-sm font-bold text-white">Codificação (Encoding)</p>
                <button onClick={() => setShowEncoding(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-600"><X size={16} /></button>
              </div>
              <div className="divide-y divide-gray-800/40 pb-8">
                {ENCODINGS.map(e => (
                  <button key={e} onClick={() => { setEncoding(e); setShowEncoding(false); }}
                    className={`w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 text-left transition-colors ${encoding === e ? "text-blue-400" : "text-gray-300"}`}>
                    <span className="text-[15px]">{e}</span>
                    {encoding === e && <span className="text-xs text-blue-500 font-semibold">✓ Ativo</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ BOTTOM TOOLBAR ═══ */}
      {(() => {
        const tb = (action: () => void) => ({
          onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); action(); },
        });
        return (
          <div className="flex flex-col bg-[#141414] border-t border-gray-700/50 shrink-0">
            {/* Linha 1 — teclas rápidas + botões de painel */}
            <div className="h-11 flex items-center px-1 gap-0.5">
              {/* Tab */}
              <button {...tb(() => editorRef.current?.insertText("  "))}
                className="px-3 py-2 rounded-lg active:bg-white/10 text-gray-500 active:text-gray-200 text-[13px] font-mono shrink-0 select-none">⇥</button>
              <div className="w-px h-6 bg-gray-700/50 mx-0.5 shrink-0" />
              {/* Setas */}
              {([["↑","up"],["↓","down"],["←","left"],["→","right"]] as [string,"up"|"down"|"left"|"right"][]).map(([label,dir]) => (
                <button key={dir} {...tb(() => editorRef.current?.moveCursor(dir))}
                  className="w-10 h-9 rounded-lg active:bg-white/10 text-gray-400 active:text-white text-[17px] font-bold flex items-center justify-center shrink-0 select-none">
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              {/* Terminal */}
              <button onPointerDown={() => { setShowBottomPanel(p => bottomPanel==="terminal"?!p:true); setBottomPanel("terminal"); }}
                className={`px-3 py-2 rounded-lg shrink-0 relative ${showBottomPanel&&bottomPanel==="terminal"?"bg-green-500/20 text-green-400":"text-gray-600 hover:bg-white/5"}`}
                title={terminalRunning ? `Rodando: ${terminalRunningCmd || "comando"}` : "Terminal"}>
                <TerminalIcon size={17} />
                {terminalRunning && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                )}
              </button>
              {/* Preview */}
              <button onPointerDown={() => { setShowBottomPanel(p => bottomPanel==="preview"?!p:true); setBottomPanel("preview"); }}
                className={`px-3 py-2 rounded-lg shrink-0 ${showBottomPanel&&bottomPanel==="preview"?"bg-blue-500/20 text-blue-400":"text-gray-600 hover:bg-white/5"}`}
                title="Preview">
                <Eye size={17} />
              </button>
              {/* Tela cheia preview */}
              <button onPointerDown={() => { setShowBottomPanel(true); setBottomPanel("preview"); setTriggerPreviewFullscreen(true); }}
                className="px-2 py-2 rounded-lg text-blue-500/60 hover:text-blue-400 shrink-0" title="Preview tela cheia">
                <Maximize2 size={15} />
              </button>
              <div className="w-px h-6 bg-gray-700/50 mx-0.5 shrink-0" />
              {/* Mic */}
              <button onPointerDown={() => { setShowAIPanel(true); setTriggerVoice(true); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 shrink-0"
                title="Falar com a Raquel">
                <Mic size={16} />
              </button>
              {/* Raquel */}
              <button onPointerDown={() => setShowAIPanel(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold shrink-0 transition-all ${showAIPanel?"bg-purple-600 text-white shadow-lg shadow-purple-900/50":"bg-gradient-to-r from-purple-600/30 to-blue-600/20 border border-purple-500/50 text-purple-300"}`}>
                <Bot size={15} />
                <span>Raquel</span>
              </button>
            </div>
            {/* Linha 2 — campo livre de comando */}
            <div className="h-10 flex items-center px-2 gap-1.5 border-t border-gray-700/30">
              <TerminalIcon size={13} className="text-gray-600 shrink-0" />
              <input
                type="text"
                placeholder="Digite um comando e pressione Enter…"
                className="flex-1 bg-transparent text-[12px] font-mono text-gray-300 placeholder-gray-600 outline-none"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (!val) return;
                    setShowBottomPanel(true);
                    setBottomPanel("terminal");
                    setTimeout(() => setPendingTermCmd(val), 80);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <span className="text-[10px] text-gray-700 shrink-0">↵</span>
            </div>
          </div>
        );
      })()}

      </div> {/* fecha coluna esquerda */}

      {/* ── COLUNA DIREITA: IA Chat inline — sempre montada, só esconde visualmente ── */}
      <div className={`flex flex-col border-l border-gray-700/50 bg-[#0d0d0d] shrink-0 transition-all duration-200 ${showAIPanel ? "w-[52%] max-w-[360px] min-w-[260px] md:w-[42%] md:max-w-[640px] md:min-w-[440px] lg:w-[40%] lg:max-w-[760px]" : "w-0 border-l-0 overflow-hidden"}`}>
        <div className="flex items-center justify-between px-3 py-2 bg-[#141414] border-b border-gray-700/40 shrink-0 min-w-[200px]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Bot size={13} className="text-white" />
            </div>
            <span className="text-[12px] font-bold text-gray-300">Raquel</span>
          </div>
          <button onClick={() => setShowAIPanel(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden min-w-[200px]">
          <AIChat
            vfs={vfs}
            activeFile={activeFile}
            onApplyCode={handleApplyCode}
            onRunInTerminal={(cmd) => { handleRunInTerminal(cmd); }}
            scope={aiScope}
            onScopeChange={setAiScope}
            autoVoice={triggerVoice}
            onAutoVoiceConsumed={() => setTriggerVoice(false)}
            externalMessage={externalAIMsg}
            onExternalMessageConsumed={() => setExternalAIMsg(undefined)}
            lastTermOutput={lastTermOutput}
            onTermOutputConsumed={() => setLastTermOutput(undefined)}
            terminalBuffer={terminalBuffer}
            terminalHasError={termHasError}
            dbConnectionString={dbConnectionString || undefined}
          />
        </div>
      </div>

      </div> {/* fecha split wrapper */}

      {/* ═══ TOAST: Preview Pronto ═══ */}
      {showPreviewToast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border border-green-500/40 bg-[#141414]"
          style={{ boxShadow: "0 0 30px rgba(74,222,128,0.25)" }}
        >
          <Globe size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-green-300">Preview pronto!</p>
            <p className="text-[11px] text-gray-400">Painel inferior → aba Preview</p>
          </div>
          <button
            onClick={() => { setShowPreviewToast(false); setBottomPanel("preview"); setShowBottomPanel(true); }}
            className="ml-2 px-3 py-1.5 rounded-xl bg-green-600 text-white text-[12px] font-bold active:scale-95 transition-all"
          >
            Ver →
          </button>
          <button onClick={() => setShowPreviewToast(false)} className="p-1 text-gray-600 hover:text-gray-400">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══ TOAST: Rodando em segundo plano ═══ */}
      {terminalRunning && (!showBottomPanel || bottomPanel !== "terminal") && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-yellow-600/40 bg-[#1e1a0d] max-w-[90vw]"
          style={{ boxShadow: "0 0 24px rgba(202,138,4,0.2)" }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-yellow-300">Rodando em segundo plano</p>
            <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{terminalRunningCmd || "comando em execução"}</p>
          </div>
          <button
            onClick={() => { setShowBottomPanel(true); setBottomPanel("terminal"); }}
            className="ml-1 px-3 py-1.5 rounded-xl bg-yellow-700/40 border border-yellow-600/40 text-yellow-300 text-[11px] font-bold active:scale-95 transition-all shrink-0"
          >
            Ver →
          </button>
        </div>
      )}

      {/* ═══ OVERLAYS ═══ */}

      {/* Backdrop */}
      {anyOverlay && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => { setShowFilePanel(false); setShowAIPanel(false); setShowGitHub(false); setShowMoreMenu(false); }} />
      )}

      {/* FILE PANEL — slides from left */}
      <div className={`fixed top-0 left-0 bottom-0 z-50 w-[80vw] max-w-xs bg-[#0d0d0d] border-r-2 border-gray-600/60 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${showFilePanel ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-[#141414] shrink-0">
          <div className="flex items-center gap-2">
            <Files size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Arquivos</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => handleCreateFile("")} className="p-1.5 rounded-lg hover:bg-white/5" title="Novo arquivo">
              <Plus size={15} className="text-gray-500" />
            </button>
            <button onClick={() => handleCreateFolder("")} className="p-1.5 rounded-lg hover:bg-white/5" title="Nova pasta">
              <FolderOpen size={15} className="text-gray-500" />
            </button>
            <button onClick={() => { setShowPackages(true); }} className="p-1.5 rounded-lg hover:bg-white/5" title="Bibliotecas">
              <Package size={15} className="text-gray-500" />
            </button>
            <button onClick={() => setShowFilePanel(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FileTree
            tree={tree}
            activeFile={activeFile}
            onFileSelect={handleFileSelect}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteNode={handleDeleteNode}
            onRenameNode={handleRenameNode}
            onDuplicateNode={handleDuplicateNode}
            getFileContent={getFileContent}
            getAllFilesUnder={getAllFilesUnder}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
            projectName={projectName}
            onExportZip={async () => { await exportAsZip(vfs.toJSON(), projectName.replace(/\s+/g, "-").toLowerCase()); }}
            onAnalyzeWithAI={handleAnalyzeWithAI}
          />
        </div>

        {/* ── MENU COMPLETO DE AÇÕES (rolável, fica na parte inferior do painel) ── */}
        <div className="shrink-0 border-t-2 border-gray-800/50 bg-[#0d0d0d] flex flex-col" style={{ maxHeight: "52vh" }}>
          {/* Cabeçalho fixo */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#1a2413] border-b border-gray-700/30 shrink-0">
            <span className="text-[11px] font-bold text-green-500 uppercase tracking-widest">⚡ Menu Completo</span>
            <span className="text-[9px] text-gray-600">role para ver mais ↕</span>
          </div>
          {/* Lista rolável */}
          <div className="overflow-y-auto divide-y divide-gray-800/40 pb-2">
            {[
              { icon: <Plus size={16} className="text-green-300" />,       label: "🆕 Criar Novo App",               sub: "Wizard com modelos prontos",       action: () => { setShowNewAppWizard(true); setShowFilePanel(false); } },
              { icon: <Upload size={16} className="text-yellow-400" />,    label: "📥 Importar ZIP",                  sub: "Abrir arquivo .zip do dispositivo",  action: () => { zipInputRef.current?.click(); } },
              { icon: <Upload size={16} className="text-orange-400" />,    label: "📥 Importar TAR.GZ",               sub: "Abrir arquivo .tar.gz",              action: () => { zipInputRef.current?.click(); } },
              { icon: <Download size={16} className="text-green-400" />,   label: "📤 Exportar ZIP",                  sub: "Baixar projeto como .zip",           action: async () => { await exportAsZip(vfs.toJSON(), projectName.replace(/\s+/g, "-").toLowerCase()); } },
              { icon: <Bot size={16} className="text-purple-400" />,       label: "🤖 Assistente IA — Raquel",       sub: "Converse, peça código, debug...",    action: () => { setShowAIPanel(true); setShowFilePanel(false); } },
              { icon: <GitBranch size={16} className="text-green-400" />,  label: "🔗 GitHub — Clonar / Enviar",     sub: "Importar ou exportar para GitHub",   action: () => { setGithubDefaultView(undefined); setShowGitHub(true); setShowFilePanel(false); } },
              { icon: <Globe size={16} className="text-blue-400" />,       label: "🌐 Publicar no GitHub Pages",      sub: "Publica este editor online — grátis para sempre", action: () => { setGithubDefaultView("pages-deploy"); setShowGitHub(true); setShowFilePanel(false); } },
              { icon: <GitBranch size={16} className="text-purple-400" />, label: "🔗 Importar via Link Público",     sub: "Clonar qualquer repositório público sem token", action: async () => { const url = window.prompt("Cole o link do repositório GitHub (ex: https://github.com/usuario/repo):"); if (!url?.trim()) return; const m = url.trim().replace(/\.git$/,"").match(/github\.com\/([^/]+)\/([^/?\s]+)/); if (!m) { alert("Link inválido. Use: https://github.com/usuario/repositorio"); return; } const [,owner,repo] = m; try { const { cloneRepo } = await import("@/lib/github-service"); const imported = await cloneRepo({ token: "", username: "" }, owner, repo); handleImportFromGitHub(imported); setShowFilePanel(false); alert(`✅ Importado com sucesso! ${Object.keys(imported).length} arquivos.`); } catch(e:any) { alert("Erro ao importar: " + (e.message || String(e))); } } },
              { icon: <Globe size={16} className="text-cyan-400" />,       label: "💻 Abrir no VSCode Web",           sub: "Editar no vscode.dev direto pelo navegador",   action: () => { window.open("https://vscode.dev", "_blank"); setShowFilePanel(false); } },
              { icon: <Package size={16} className="text-orange-400" />,   label: "📦 Instalar Biblioteca",          sub: "npm install, pip install...",        action: () => { setShowPackages(true); } },
              { icon: <span className="text-[14px]">🗄️</span>,             label: "🗄️ Banco de Dados (Neon/Postgres)",sub: "Conectar e rodar SQL",              action: () => { setShowDBPanel(true); setShowFilePanel(false); } },
              { icon: <Camera size={16} className="text-pink-400" />,      label: "📸 Salvar Checkpoint",            sub: "Criar ponto de restauração",         action: () => { saveCheckpoint(); setShowFilePanel(false); alert("✅ Checkpoint salvo!"); } },
              { icon: <History size={16} className="text-purple-300" />,   label: "🕐 Histórico de Checkpoints",     sub: "Ver e restaurar versões salvas",     action: () => { setShowCheckpointPanel(true); setShowFilePanel(false); } },
              { icon: <CheckSquare size={16} className="text-cyan-400" />, label: "📋 Lista de Tarefas — Taski",     sub: "Organizar to-dos do projeto",        action: () => { setShowTaskPanel(true); setShowFilePanel(false); } },
              { icon: <span className="text-[14px]">🧠</span>,             label: "🧠 Memória da Raquel",            sub: "O que ela sabe sobre você e o projeto", action: () => { handleOpenRaquelPerfil(); } },
              { icon: <BookOpen size={16} className="text-yellow-300" />,  label: "📐 Gerar Plano do Projeto",       sub: "Gera PLANO.md com estrutura e stack",action: () => { handleGenerateDocs(); setShowFilePanel(false); } },
              { icon: <span className="text-[14px]">📖</span>,             label: "📖 Manual do SK Code Editor",sub: "Guia completo em português",           action: () => { setShowManualPanel(true); setShowFilePanel(false); } },
              { icon: <span className="text-[14px]">🔗</span>,             label: "🔗 Combinar Apps",              sub: "Une vários apps num único projeto",    action: () => { setShowCombinarAppsPanel(true); setShowFilePanel(false); } },
              { icon: <span className="text-[14px]">🌐</span>,             label: "🌐 Extrator de Site",            sub: "Baixar HTML/CSS/JS de qualquer site",  action: () => { setShowSiteExtractor(true); setShowFilePanel(false); } },
              { icon: <span className="text-[14px]">🚀</span>,             label: "🚀 Deploy & Backup",             sub: "GitHub Pages, Vercel, Netlify, ZIP...", action: () => { setShowDeployPanel(true); setShowFilePanel(false); } },
              { icon: <span className="text-[14px]">📦</span>,             label: "📦 Build & Deploy",              sub: "APK, GitHub Pages, PWA, Electron...", action: () => { setShowBuildPanel(true); setShowFilePanel(false); } },
              { icon: <Upload size={16} className="text-purple-400" />,    label: "📥 Importar APK",                 sub: "Importar APK como ZIP explorado",     action: () => { zipInputRef.current?.click(); } },
              { icon: <span className="text-[14px]">🩺</span>,             label: "🩺 Status do Sistema (ao vivo)",  sub: "Ver se tudo tá funcionando — clique pra atualizar", action: () => { setShowSystemStatus(true); setShowFilePanel(false); } },
              { icon: <Settings2 size={16} className="text-blue-300" />,   label: "📄 Gerar SISTEMA.md",             sub: "Cria documentação técnica do sistema", action: () => { const c = generateSystemInfo(projectName, vfs.listFiles().length); vfs.writeFile("SISTEMA.md", c); handleFileSelect("SISTEMA.md"); setShowFilePanel(false); } },
              { icon: <Save size={16} className="text-blue-400" />,        label: "💾 Salvar Projeto",               sub: "Salvar estado atual",                action: () => { onSaveProject?.(projectName); setShowFilePanel(false); } },
              { icon: <Globe size={16} className="text-green-300" />,      label: "🌐 Abrir Preview",                sub: "Visualizar site/app rodando",        action: () => { setShowBottomPanel(true); setBottomPanel("preview"); setShowFilePanel(false); } },
              { icon: <TerminalIcon size={16} className="text-green-500" />,label: "⬛ Abrir Terminal",              sub: "Rodar comandos bash",                action: () => { setShowBottomPanel(true); setBottomPanel("terminal"); setShowFilePanel(false); } },
              ...(onOpenAssistenteJuridico ? [{ icon: <Scale size={16} className="text-amber-400" />, label: "⚖️ Assistente Jurídico", sub: "Consulta jurídica com IA", action: () => { setShowFilePanel(false); onOpenAssistenteJuridico!(); } }] : []),
              ...(onOpenCampoLivre ? [{ icon: <MessageSquare size={16} className="text-green-400" />, label: "💬 Campo Livre", sub: "Chat sem restrições", action: () => { setShowFilePanel(false); onOpenCampoLivre!(); } }] : []),
            ].map(({ icon, label, sub, action }) => (
              <button key={label} onClick={action}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 active:bg-white/10 text-left transition-colors">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-200 leading-tight">{label}</p>
                  <p className="text-[10px] text-gray-600 leading-tight mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
            {/* Limpar projeto — destructive */}
            <button
              onClick={() => { if (confirm("Limpar todos os arquivos e voltar ao início?")) { vfs.clear(); setOpenFiles([]); setActiveFile(null); onNewProject(); } setShowFilePanel(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 active:bg-red-500/20 text-left transition-colors">
              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-red-400 leading-tight">🗑️ Limpar Projeto</p>
                <p className="text-[10px] text-gray-600 leading-tight mt-0.5">Apaga todos os arquivos e volta ao início</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* GITHUB PANEL — slides from right */}
      <div className={`fixed top-0 right-0 bottom-0 z-50 w-[88vw] max-w-sm bg-[#0d0d0d] border-l border-gray-700/50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${showGitHub ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-3 py-2 bg-[#141414] border-b border-gray-700/40 shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-green-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">GitHub</span>
          </div>
          <button onClick={() => { setShowGitHub(false); setGithubDefaultView(undefined); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <GitHubPanel files={vfs.toJSON()} onImport={handleImportFromGitHub} projectName={projectName} defaultView={githubDefaultView} />
        </div>
      </div>

      {/* MORE MENU — bottom sheet */}
      {showMoreMenu && (
        <div className="fixed inset-x-0 bottom-0 z-50 pb-safe" onClick={e => e.stopPropagation()}>
          <div className="bg-[#222e18] border-t border-gray-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-600 rounded-full" />
            </div>
            <div className="pb-8 divide-y divide-gray-800/40">
              {[
                { icon: <Plus size={18} className="text-green-300" />, label: "🆕 Criar Novo App", action: () => { setShowNewAppWizard(true); setShowMoreMenu(false); } },
                { icon: <span className="text-[16px]">🗄️</span>, label: "Banco de Dados (Neon / PostgreSQL)", action: () => { setShowDBPanel(true); setShowMoreMenu(false); } },
                { icon: <Files size={18} className="text-blue-400" />, label: "Arquivos", action: () => { setShowFilePanel(true); setShowMoreMenu(false); } },
                { icon: <Bot size={18} className="text-purple-400" />, label: "Assistente IA", action: () => { setShowAIPanel(true); setShowMoreMenu(false); } },
                { icon: <GitBranch size={18} className="text-green-400" />, label: "GitHub / Clone", action: () => { setGithubDefaultView(undefined); setShowGitHub(true); setShowMoreMenu(false); } },
                { icon: <Globe size={18} className="text-blue-400" />, label: "🌐 Publicar no GitHub Pages — Grátis", action: () => { setGithubDefaultView("pages-deploy"); setShowGitHub(true); setShowMoreMenu(false); } },
                { icon: <span className="text-[18px]">🚀</span>, label: "🚀 Deploy & Backup (Vercel, Netlify, ZIP...)", action: () => { setShowDeployPanel(true); setShowMoreMenu(false); } },
                { icon: <Package size={18} className="text-orange-400" />, label: "Instalar Biblioteca", action: () => { setShowPackages(true); setShowMoreMenu(false); } },
                { icon: <Upload size={18} className="text-yellow-400" />, label: "Importar (.zip / .tar.gz)", action: () => { zipInputRef.current?.click(); setShowMoreMenu(false); } },
                { icon: <Download size={18} className="text-green-400" />, label: "Exportar ZIP", action: async () => { await exportAsZip(vfs.toJSON(), projectName.replace(/\s+/g, "-")); setShowMoreMenu(false); } },
                { icon: <HardDrive size={18} className="text-blue-400" />, label: "☁️ Backup no Google Drive", action: () => { setShowDrivePanel(true); setShowMoreMenu(false); } },
                { icon: <Camera size={18} className="text-pink-400" />, label: "📸 Salvar Checkpoint", action: () => { saveCheckpoint(); setShowMoreMenu(false); alert("✅ Checkpoint salvo! Acesse o histórico para restaurar."); } },
                { icon: <History size={18} className="text-purple-400" />, label: "🕐 Histórico de Checkpoints", action: () => { setShowCheckpointPanel(true); setShowMoreMenu(false); } },
                { icon: <CheckSquare size={18} className="text-cyan-400" />, label: "📋 Lista de Tarefas (Taski)", action: () => { setShowTaskPanel(true); setShowMoreMenu(false); } },
                { icon: <BookOpen size={18} className="text-yellow-400" />, label: "📐 Plano do Projeto", action: handleGenerateDocs },
                { icon: <span className="text-[16px]">📖</span>, label: "📖 Manual do SK Code Editor", action: () => { setShowManualPanel(true); setShowMoreMenu(false); } },
                { icon: <span className="text-[16px]">🔗</span>, label: "🔗 Combinar Apps", action: () => { setShowCombinarAppsPanel(true); setShowMoreMenu(false); } },
                { icon: <span className="text-[16px]">🌐</span>, label: "🌐 Extrator de Site", action: () => { setShowSiteExtractor(true); setShowMoreMenu(false); } },
                { icon: <span className="text-[16px]">📦</span>, label: "📦 Build & Deploy (APK, PWA, Pages...)", action: () => { setShowBuildPanel(true); setShowMoreMenu(false); } },
                { icon: <span className="text-[16px]">🔍</span>, label: "🔍 Scanner (VFS, APK/ZIP, Web, IA)", action: () => { setShowFileScanner(true); setShowMoreMenu(false); } },
                { icon: <Settings2 size={18} className="text-blue-300" />, label: "Info do Sistema", action: () => {
                  const content = generateSystemInfo(projectName, vfs.listFiles().length);
                  vfs.writeFile("SISTEMA.md", content);
                  handleFileSelect("SISTEMA.md");
                  setShowMoreMenu(false);
                }},
                { icon: <Save size={18} className="text-blue-400" />, label: "Salvar Projeto", action: () => { onSaveProject?.(projectName); setShowMoreMenu(false); } },
                ...(onOpenAssistenteJuridico ? [{ icon: <Scale size={18} className="text-amber-400" />, label: "Assistente Jurídico", action: () => { setShowMoreMenu(false); onOpenAssistenteJuridico(); } }] : []),
                ...(onOpenCampoLivre ? [{ icon: <MessageSquare size={18} className="text-green-400" />, label: "Campo Livre", action: () => { setShowMoreMenu(false); onOpenCampoLivre(); } }] : []),
              ].map(({ icon, label, action }) => (
                <button key={label} onClick={action} className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-white/5 text-left">
                  {icon}
                  <span className="text-[15px] text-gray-200">{label}</span>
                </button>
              ))}
              {/* Chave Global de IA */}
              <div className="px-6 py-3">
                <p className="text-[11px] text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">🔑 Chave Global de IA (Gemini recomendado)</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    defaultValue={(() => { try { return localStorage.getItem("sk_global_key") || ""; } catch { return ""; } })()}
                    placeholder="Cole AIza... (Gemini) ou qualquer chave"
                    className="flex-1 px-3 py-2 bg-black/40 border border-gray-700/50 rounded-xl text-[12px] text-gray-200 placeholder-gray-600 outline-none focus:border-green-500/60"
                    id="sk-global-key-input"
                  />
                  <button
                    onClick={() => {
                      const inp = document.getElementById("sk-global-key-input") as HTMLInputElement;
                      const val = inp?.value?.trim() || "";
                      try {
                        if (val) localStorage.setItem("sk_global_key", val);
                        else localStorage.removeItem("sk_global_key");
                      } catch {}
                      setShowMoreMenu(false);
                    }}
                    className="px-3 py-2 rounded-xl bg-green-700/40 hover:bg-green-700/60 text-green-300 text-[12px] font-bold border border-green-700/40 shrink-0"
                  >
                    Salvar
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Usada como padrão no Campo Livre e Assistente Jurídico</p>
              </div>
              <div className="mx-6 h-px bg-gray-700/50 my-1" />
              <button onClick={() => { if (confirm("Limpar projeto e voltar ao início?")) { vfs.clear(); setOpenFiles([]); setActiveFile(null); onNewProject(); } setShowMoreMenu(false); }}
                className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-red-500/5 text-left">
                <Trash2 size={18} className="text-red-400" />
                <span className="text-[15px] text-red-400">Voltar ao Início</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOAST: App Criado ═══ */}
      {newAppCreatedToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-green-500/40 bg-[#141414]">
          <span className="text-green-400 text-xl">✅</span>
          <div>
            <p className="text-[13px] font-bold text-green-300">App criado: {newAppCreatedToast}</p>
            <p className="text-[11px] text-gray-400">Peça para a Raquel instalar e rodar!</p>
          </div>
        </div>
      )}

      {/* ═══ WIZARD: Criar Novo App ═══ */}
      {showNewAppWizard && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm" onClick={() => setShowNewAppWizard(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1a2413] border-t border-gray-700/50 rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Plus size={18} className="text-green-400" />
                  <p className="text-[16px] font-bold text-white">Criar Novo App</p>
                </div>
                <button onClick={() => setShowNewAppWizard(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500"><X size={17} /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 space-y-3">
                <p className="text-[12px] text-gray-500 px-1 mb-2">Escolha o tipo de app. Os arquivos serão criados automaticamente — depois peça para a Raquel instalar e rodar.</p>
                {[
                  {
                    id: "html-css-js", icon: "🌐", title: "HTML + CSS + JS",
                    desc: "O mais simples. Preview funciona imediatamente, sem instalar nada. Ideal para páginas, animações e prototipagem rápida.",
                    badge: "⚡ Preview imediato", badgeColor: "text-green-400 bg-gray-800/30 border-green-700/40",
                  },
                  {
                    id: "landing-page", icon: "📱", title: "Landing Page",
                    desc: "Página de apresentação profissional com design moderno. Ideal para mostrar serviços, produtos ou portfólio.",
                    badge: "⚡ Preview imediato", badgeColor: "text-green-400 bg-gray-800/30 border-green-700/40",
                  },
                  {
                    id: "pwa-app", icon: "📲", title: "PWA Instalável",
                    desc: "Aplicativo que pode ser instalado no celular e funciona offline. HTML + manifest + service worker.",
                    badge: "⚡ Preview imediato", badgeColor: "text-green-400 bg-gray-800/30 border-green-700/40",
                  },
                  {
                    id: "react-app", icon: "⚛️", title: "React App",
                    desc: "Interface moderna e interativa com componentes React. Precisa rodar: npm install e npm start no terminal.",
                    badge: "npm install", badgeColor: "text-blue-400 bg-blue-900/30 border-blue-700/40",
                  },
                  {
                    id: "node-api", icon: "🟢", title: "Node.js / Express",
                    desc: "Backend com API REST. Ideal para criar rotas, salvar dados, integrar com banco. Precisa: npm install e npm start.",
                    badge: "npm install", badgeColor: "text-blue-400 bg-blue-900/30 border-blue-700/40",
                  },
                  {
                    id: "typescript-node", icon: "🔷", title: "TypeScript + Node.js",
                    desc: "JavaScript com tipos — mais seguro e organizado. Ideal para projetos maiores.",
                    badge: "npm install", badgeColor: "text-blue-400 bg-blue-900/30 border-blue-700/40",
                  },
                  {
                    id: "_raquel", icon: "🤖", title: "Deixar a Raquel criar",
                    desc: "Descreva o que você quer e a Raquel cria toda a estrutura do zero para você — arquivos, dependências e instruções.",
                    badge: "IA cria tudo", badgeColor: "text-purple-400 bg-purple-900/30 border-purple-700/40",
                  },
                ].map(({ id, icon, title, desc, badge, badgeColor }) => (
                  <button
                    key={id}
                    onClick={() => {
                      if (id === "_raquel") {
                        setShowNewAppWizard(false);
                        setShowAIPanel(true);
                        setExternalAIMsg("🚀 Vou criar um aplicativo do zero. Me faça essas perguntas UMA A UMA e aguarde minha resposta antes de ir para a próxima:\n\n1) Qual é o objetivo do app?\n2) É um site (HTML/React) ou um backend (Node.js)?\n3) Vai ter banco de dados?\n4) Tem alguma API ou serviço externo?\n\nCom base nas respostas, crie TODA a estrutura: arquivos, pastas, package.json e instruções para rodar. Comece fazendo a PRIMEIRA pergunta agora.");
                      } else {
                        applyTemplate(id);
                      }
                    }}
                    className="w-full flex items-start gap-4 p-4 rounded-2xl bg-[#0d0d0d] border border-gray-700/40 hover:border-gray-600/60 hover:bg-[#141414] text-left transition-all active:scale-[0.98]"
                  >
                    <span className="text-3xl shrink-0 mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-bold text-white">{title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>
                      </div>
                      <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">{desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-600 shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {showDBPanel && (
        <DatabasePanel
          onClose={() => setShowDBPanel(false)}
          connectionString={dbConnectionString}
          onUpdateConnection={str => { setDbConnectionString(str); localStorage.setItem("sk-db-url", str); }}
          onSendToAI={msg => { setShowDBPanel(false); setShowAIPanel(true); setExternalAIMsg(msg); }}
        />
      )}

      {showDeployPanel && (
        <DeployPanel
          onClose={() => setShowDeployPanel(false)}
          projectName={projectName}
          files={vfs.toJSON() as Record<string, string>}
        />
      )}

            {/* MODAL DE NOME (arquivo/pasta/renomear) */}
      {nameModal && (
        <NameInputModal
          title={nameModal.title}
          placeholder={nameModal.placeholder}
          defaultValue={nameModal.defaultValue}
          icon={nameModal.icon}
          confirmLabel={nameModal.confirmLabel}
          onConfirm={nameModal.onConfirm}
          onCancel={() => setNameModal(null)}
        />
      )}

      {/* PACKAGE SEARCH — componente dedicado com busca real no npm */}
      {showPackages && (
        <PackageSearch
          onInstall={(cmd) => { handleRunInTerminal(cmd); }}
          onClose={() => setShowPackages(false)}
        />
      )}

      {/* ── PAINEL DE BACKUP NO DRIVE ──────────────────────────────────────── */}
      {showDrivePanel && (
        <DriveBackupPanel
          onClose={() => setShowDrivePanel(false)}
          files={vfs.toJSON() as Record<string, string>}
          projectName={projectName}
        />
      )}

      {/* ── PAINEL STATUS DO SISTEMA AO VIVO ───────────────────────────────── */}
      <SystemStatusPanel
        open={showSystemStatus}
        onClose={() => setShowSystemStatus(false)}
        vfs={vfs}
        projectName={projectName}
        terminalMode={terminalMode}
      />

      {/* ── PAINEL DO MANUAL ──────────────────────────────────────────────── */}
      {showManualPanel && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/70" onClick={() => setShowManualPanel(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0d0d0d] border-t border-[#2d4a1e] rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "88vh" }}>
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-[#3d6e2a] rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#2d4a1e] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📖</span>
                  <p className="text-[15px] font-bold text-[#7ec87a]">Manual do SK Code Editor</p>
                </div>
                <button onClick={() => setShowManualPanel(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
                  <X size={17} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Manual vfs={vfs} projectName={projectName} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PAINEL COMBINAR APPS ──────────────────────────────────────────── */}
      {showCombinarAppsPanel && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/70" onClick={() => setShowCombinarAppsPanel(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0d0d0d] border-t border-[#2d4a1e] rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "88vh" }}>
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-[#3d6e2a] rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#2d4a1e] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔗</span>
                  <p className="text-[15px] font-bold text-[#7ec87a]">Combinar Apps</p>
                </div>
                <button onClick={() => setShowCombinarAppsPanel(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
                  <X size={17} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <CombinarApps
                  onSendToRaquel={(prompt) => {
                    setShowCombinarAppsPanel(false);
                    setExternalAIMsg(prompt);
                    setTimeout(() => setShowAIPanel(true), 100);
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PAINEL EXTRATOR DE SITE ───────────────────────────────────────── */}
      {showSiteExtractor && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/70" onClick={() => setShowSiteExtractor(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0d0d0d] border-t border-gray-700/50 rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "90vh" }}>
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex-1 overflow-hidden">
                <SiteExtractor
                  onClose={() => setShowSiteExtractor(false)}
                  onSaveToVFS={(files) => {
                    Object.entries(files).forEach(([path, content]) => vfs.writeFile(path, content));
                    setShowSiteExtractor(false);
                    const count = Object.keys(files).length;
                    const first = Object.keys(files)[0];
                    if (first) setTimeout(() => handleFileSelect(first), 100);
                    alert(`✅ ${count} arquivo(s) salvos no projeto!`);
                  }}
                  onAnalyzeWithAI={(content) => {
                    setExternalAIMsg(content);
                    setTimeout(() => setShowAIPanel(true), 100);
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PAINEL BUILD & DEPLOY ──────────────────────────────────────────── */}
      {showBuildPanel && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/70" onClick={() => setShowBuildPanel(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0d0d0d] border-t border-gray-700/50 rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "90vh" }}>
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex-1 overflow-hidden">
                <BuildPanel
                  vfs={{
                    listFiles: () => vfs.listFiles(),
                    readFile: (p) => vfs.readFile(p) ?? null,
                    writeFile: (p, c) => vfs.writeFile(p, c),
                  }}
                  projectName={projectName}
                  onClose={() => setShowBuildPanel(false)}
                  onRunCommand={(cmd) => {
                    setShowBuildPanel(false);
                    setShowBottomPanel(true);
                    setBottomPanel("terminal");
                    setTimeout(() => setPendingTermCmd(cmd), 200);
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── SCANNER ─────────────────────────────────────────────────────── */}
      {showFileScanner && (
        <FileScanner
          vfs={{
            listFiles: () => vfs.listFiles(),
            readFile: (p) => vfs.readFile(p) ?? null,
          }}
          onClose={() => setShowFileScanner(false)}
          aiConfig={(() => {
            try { const s = JSON.parse(localStorage.getItem("sk-ai-config") || "{}"); return { apiKey: s.key || "", apiUrl: s.url || "", apiModel: s.model || "" }; } catch { return { apiKey: "", apiUrl: "", apiModel: "" }; }
          })()}
        />
      )}

      {/* ── PAINEL DE CHECKPOINTS ─────────────────────────────────────────── */}
      {showCheckpointPanel && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/60" onClick={() => setShowCheckpointPanel(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1a2413] border-t border-gray-700/60 rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/40 shrink-0">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-purple-400" />
                  <p className="text-[15px] font-bold text-white">Histórico de Checkpoints</p>
                  <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">{checkpoints.length}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { saveCheckpoint(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-600/20 border border-pink-500/40 rounded-xl text-[12px] text-pink-300 font-bold hover:bg-pink-600/30"
                  >
                    <Camera size={13} /> Salvar agora
                  </button>
                  <button onClick={() => setShowCheckpointPanel(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
                    <X size={17} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {checkpoints.length === 0 ? (
                  <div className="py-10 text-center">
                    <Camera size={28} className="text-gray-700 mx-auto mb-2" />
                    <p className="text-[13px] text-gray-500">Nenhum checkpoint salvo ainda</p>
                    <p className="text-[11px] text-gray-700 mt-1">Clique em "Salvar agora" para criar um ponto de restauração</p>
                  </div>
                ) : (
                  checkpoints.map((cp) => (
                    <div key={cp.id} className="flex items-center gap-3 p-3 bg-[#0d0d0d] border border-gray-700/40 rounded-xl">
                      <Clock size={14} className="text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-gray-200 font-semibold truncate">{cp.label}</p>
                        <p className="text-[10px] text-gray-600">
                          {new Date(cp.timestamp).toLocaleString("pt-BR")} • {cp.fileCount} arquivo{cp.fileCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => restoreCheckpoint(cp)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600/20 border border-green-500/30 rounded-lg text-[11px] text-green-400 font-bold hover:bg-green-600/30"
                        >
                          <RotateCcw size={11} /> Restaurar
                        </button>
                        <button
                          onClick={() => deleteCheckpoint(cp.id)}
                          className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/20"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PAINEL TASKI (lista de tarefas) ──────────────────────────────────── */}
      {showTaskPanel && (
        <>
          <div className="fixed inset-0 z-[9990] bg-black/60" onClick={() => setShowTaskPanel(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1a2413] border-t border-gray-700/60 rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/40 shrink-0">
                <div className="flex items-center gap-2">
                  <CheckSquare size={16} className="text-cyan-400" />
                  <p className="text-[15px] font-bold text-white">Taski — Lista de Tarefas</p>
                  <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.done).length}/{tasks.length} feitas
                  </span>
                </div>
                <button onClick={() => setShowTaskPanel(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500">
                  <X size={17} />
                </button>
              </div>
              {/* Input nova tarefa */}
              <div className="px-4 py-3 border-b border-gray-700/30 shrink-0">
                <div className="flex gap-2">
                  <input
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addTask(newTaskText); }}
                    placeholder="Nova tarefa... (Enter para adicionar)"
                    className="flex-1 px-3 py-2 bg-[#0d1409] border border-gray-700/50 rounded-xl text-[13px] text-gray-200 placeholder-gray-700 outline-none focus:border-cyan-600/60"
                  />
                  <button
                    onClick={() => addTask(newTaskText)}
                    className="px-3 py-2 bg-cyan-600/20 border border-cyan-500/40 rounded-xl text-[12px] text-cyan-300 font-bold hover:bg-cyan-600/30"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                {tasks.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckSquare size={28} className="text-gray-700 mx-auto mb-2" />
                    <p className="text-[13px] text-gray-500">Nenhuma tarefa ainda</p>
                    <p className="text-[11px] text-gray-700 mt-1">Adicione tarefas para organizar o seu projeto</p>
                  </div>
                ) : (
                  <>
                    {tasks.filter(t => !t.done).map(t => (
                      <div key={t.id} className="flex items-start gap-3 p-3 bg-[#0d0d0d] border border-gray-700/30 rounded-xl">
                        <button onClick={() => toggleTask(t.id)} className="w-5 h-5 rounded border-2 border-gray-600 hover:border-cyan-400 shrink-0 mt-0.5 flex items-center justify-center transition-colors" />
                        <span className="flex-1 text-[13px] text-gray-200 leading-relaxed">{t.text}</span>
                        <button onClick={() => deleteTask(t.id)} className="p-1 rounded text-gray-700 hover:text-red-400 shrink-0">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {tasks.filter(t => t.done).length > 0 && (
                      <>
                        <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest px-1 pt-2">Concluídas</p>
                        {tasks.filter(t => t.done).map(t => (
                          <div key={t.id} className="flex items-start gap-3 p-3 bg-[#0d1409] border border-gray-800/30 rounded-xl opacity-60">
                            <button onClick={() => toggleTask(t.id)} className="w-5 h-5 rounded border-2 border-cyan-500 bg-cyan-600/20 shrink-0 mt-0.5 flex items-center justify-center">
                              <span className="text-cyan-400 text-[10px] font-bold">✓</span>
                            </button>
                            <span className="flex-1 text-[13px] text-gray-500 leading-relaxed line-through">{t.text}</span>
                            <button onClick={() => deleteTask(t.id)} className="p-1 rounded text-gray-700 hover:text-red-400 shrink-0">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
