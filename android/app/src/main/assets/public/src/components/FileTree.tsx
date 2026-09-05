import { useState, useCallback } from "react";
import { VFSNode, VFSDirectory, VFSFile, isDirectory } from "@/lib/virtual-fs";
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus,
  FolderPlus, Trash2, Edit3, MoreVertical, Download, Copy,
  FileArchive, X, FilePlus, FolderInput, Link, Bot,
  CheckSquare, Camera, History, BookOpen, Upload, Package,
  GitBranch, Database, Plus as PlusIcon,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface ExtraItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  destructive?: boolean;
}

interface FileTreeProps {
  tree: VFSDirectory;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onDeleteNode: (path: string) => void;
  onRenameNode: (path: string) => void;
  onDuplicateNode?: (path: string) => void;
  getFileContent: (path: string) => string | undefined;
  getAllFilesUnder: (prefix: string) => Array<{ path: string; content: string }>;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  projectName?: string;
  onExportZip?: () => void;
  onAnalyzeWithAI?: (path: string, isDir: boolean) => void;
  extraRootItems?: ExtraItem[];
}

function getFileColor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colors: Record<string, string> = {
    js: "text-yellow-400", jsx: "text-yellow-400",
    ts: "text-blue-400", tsx: "text-blue-400",
    html: "text-orange-400", css: "text-purple-400",
    scss: "text-pink-400", json: "text-green-400",
    md: "text-gray-400", py: "text-green-500",
    rb: "text-red-400", go: "text-cyan-400",
    rs: "text-orange-500", java: "text-red-500",
    svg: "text-emerald-400", png: "text-emerald-400",
    jpg: "text-emerald-400", yaml: "text-red-300",
    yml: "text-red-300", sh: "text-green-300",
    sql: "text-blue-300", graphql: "text-pink-500",
    env: "text-yellow-500", toml: "text-gray-500",
  };
  return colors[ext] || "text-gray-400";
}

interface BottomSheet {
  label: string;
  path: string;
  isDir: boolean;
  isRoot?: boolean;
}

function NodeContextSheet({
  info, onClose, onRename, onDelete, onDownload, onDownloadZip,
  onCopyPath, onDuplicate, onCreateFile, onCreateFolder, onAnalyzeWithAI,
  extraItems,
}: {
  info: BottomSheet;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDownloadZip: () => void;
  onCopyPath: () => void;
  onDuplicate: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onAnalyzeWithAI?: () => void;
  extraItems?: ExtraItem[];
}) {
  const items: ExtraItem[] = [
    ...(info.isDir ? [
      { icon: <FilePlus size={18} className="text-blue-400" />, label: "Novo Arquivo", action: onCreateFile },
      { icon: <FolderPlus size={18} className="text-blue-400" />, label: "Nova Pasta", action: onCreateFolder },
    ] : []),
    ...(onAnalyzeWithAI ? [
      { icon: <Bot size={18} className="text-purple-400" />, label: info.isDir ? "Analisar pasta com IA" : "Analisar arquivo com IA", action: onAnalyzeWithAI },
    ] : []),
    ...(info.isDir ? [
      { icon: <FileArchive size={18} className="text-green-400" />, label: "Exportar como ZIP", action: onDownloadZip },
    ] : [
      { icon: <Download size={18} className="text-green-400" />, label: "Baixar Arquivo", action: onDownload },
      { icon: <Copy size={18} className="text-purple-400" />, label: "Duplicar", action: onDuplicate },
    ]),
    { icon: <Copy size={18} className="text-gray-400" />, label: "Copiar Caminho", action: onCopyPath },
    ...(extraItems || []),
    ...(!info.isRoot ? [
      { icon: <Edit3 size={18} className="text-yellow-400" />, label: "Renomear", action: onRename },
    ] : []),
    ...(!info.isRoot ? [
      { icon: <Trash2 size={18} className="text-red-400" />, label: "Excluir", action: onDelete, destructive: true },
    ] : []),
  ];

  return (
    <>
      <div className="fixed inset-0 z-[9990]" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
        <div className="bg-[#222e18] border-t border-gray-700/50 rounded-t-3xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>
          <div className="px-5 py-2 flex items-center justify-between border-b border-gray-700/30">
            <div className="flex items-center gap-2 min-w-0">
              {info.isDir
                ? <FolderOpen size={14} className="text-amber-400 shrink-0" />
                : <File size={14} className={`shrink-0 ${getFileColor(info.label)}`} />
              }
              <p className="text-sm font-semibold text-gray-200 truncate">{info.label}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-gray-600 shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="pb-8 divide-y divide-gray-800/30 max-h-[75vh] overflow-y-auto">
            {items.map(({ icon, label, action, destructive }: any) => (
              <button key={label} onClick={() => { action(); onClose(); }}
                className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/4 text-left transition-colors ${destructive ? "text-red-400" : "text-gray-200"}`}>
                {icon}
                <span className="text-[15px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function TreeNode({
  node, depth, activeFile, onFileSelect, onCreateFile, onCreateFolder,
  onDeleteNode, onRenameNode, onDuplicateNode, getFileContent, getAllFilesUnder,
  expandedDirs, toggleDir, onAnalyzeWithAI,
}: {
  node: VFSNode; depth: number; activeFile: string | null;
  onFileSelect: (path: string) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onDeleteNode: (path: string) => void;
  onRenameNode: (path: string) => void;
  onDuplicateNode?: (path: string) => void;
  getFileContent: (path: string) => string | undefined;
  getAllFilesUnder: (prefix: string) => Array<{ path: string; content: string }>;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  onAnalyzeWithAI?: (path: string, isDir: boolean) => void;
}) {
  const [sheet, setSheet] = useState(false);

  const handleDownloadFile = useCallback(() => {
    const content = getFileContent(node.path);
    if (content === undefined) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, node.name);
  }, [node, getFileContent]);

  const handleDownloadZip = useCallback(async () => {
    const files = getAllFilesUnder(node.path);
    const zip = new JSZip();
    for (const f of files) {
      const rel = f.path.startsWith(node.path + "/") ? f.path.slice(node.path.length + 1) : f.path;
      if (rel && !rel.endsWith(".gitkeep")) zip.file(rel, f.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${node.name}.zip`);
  }, [node, getAllFilesUnder]);

  const handleCopyPath = useCallback(() => {
    navigator.clipboard.writeText(node.path).catch(() => {});
  }, [node]);

  const handleDuplicate = useCallback(() => {
    onDuplicateNode?.(node.path);
  }, [node, onDuplicateNode]);

  if (isDirectory(node)) {
    const expanded = expandedDirs.has(node.path);
    const indent = depth * 14 + 6;
    return (
      <div>
        <div
          className="flex items-center gap-1 py-[5px] hover:bg-white/5 cursor-pointer group select-none"
          style={{ paddingLeft: `${indent}px`, paddingRight: "6px" }}
          onClick={() => toggleDir(node.path)}
        >
          {expanded
            ? <ChevronDown size={13} className="text-gray-600 shrink-0" />
            : <ChevronRight size={13} className="text-gray-600 shrink-0" />}
          {expanded
            ? <FolderOpen size={13} className="text-amber-400 shrink-0" />
            : <Folder size={13} className="text-amber-400 shrink-0" />}
          <span className="truncate text-gray-300 flex-1 text-[12px] ml-1">{node.name}</span>
          <button
            onClick={e => { e.stopPropagation(); setSheet(true); }}
            className="opacity-40 active:opacity-100 p-1.5 hover:bg-white/10 active:bg-white/15 rounded-lg text-gray-400 shrink-0"
          >
            <MoreVertical size={13} />
          </button>
        </div>

        {sheet && (
          <NodeContextSheet
            info={{ label: node.name, path: node.path, isDir: true }}
            onClose={() => setSheet(false)}
            onRename={() => onRenameNode(node.path)}
            onDelete={() => onDeleteNode(node.path)}
            onDownload={handleDownloadFile}
            onDownloadZip={handleDownloadZip}
            onCopyPath={handleCopyPath}
            onDuplicate={handleDuplicate}
            onCreateFile={() => onCreateFile(node.path)}
            onCreateFolder={() => onCreateFolder(node.path)}
            onAnalyzeWithAI={onAnalyzeWithAI ? () => onAnalyzeWithAI(node.path, true) : undefined}
          />
        )}

        {expanded && node.children
          .filter(c => !(isDirectory(c) ? false : (c as VFSFile).name === ".gitkeep"))
          .sort((a, b) => {
            const aIsDir = isDirectory(a);
            const bIsDir = isDirectory(b);
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map(child => (
            <TreeNode
              key={child.path} node={child} depth={depth + 1} activeFile={activeFile}
              onFileSelect={onFileSelect} onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder} onDeleteNode={onDeleteNode}
              onRenameNode={onRenameNode} onDuplicateNode={onDuplicateNode}
              getFileContent={getFileContent} getAllFilesUnder={getAllFilesUnder}
              expandedDirs={expandedDirs} toggleDir={toggleDir}
              onAnalyzeWithAI={onAnalyzeWithAI}
            />
          ))}
      </div>
    );
  }

  const file = node as VFSFile;
  if (file.name === ".gitkeep") return null;
  const isActive = file.path === activeFile;
  const indent = depth * 14 + 20;

  return (
    <div
      className={`flex items-center gap-1.5 py-[5px] cursor-pointer group select-none ${isActive ? "bg-blue-500/15 border-l-2 border-blue-500" : "hover:bg-white/5"}`}
      style={{ paddingLeft: `${indent}px`, paddingRight: "6px" }}
      onClick={() => onFileSelect(file.path)}
    >
      <File size={12} className={`shrink-0 ${isActive ? "text-blue-400" : getFileColor(file.name)}`} />
      <span className={`truncate flex-1 text-[12px] ${isActive ? "text-white" : "text-gray-400"}`}>{file.name}</span>
      <button
        onClick={e => { e.stopPropagation(); setSheet(true); }}
        className="opacity-40 active:opacity-100 p-1.5 hover:bg-white/10 active:bg-white/15 rounded-lg text-gray-400 shrink-0"
      >
        <MoreVertical size={13} />
      </button>

      {sheet && (
        <NodeContextSheet
          info={{ label: file.name, path: file.path, isDir: false }}
          onClose={() => setSheet(false)}
          onRename={() => onRenameNode(file.path)}
          onDelete={() => onDeleteNode(file.path)}
          onDownload={handleDownloadFile}
          onDownloadZip={handleDownloadZip}
          onCopyPath={handleCopyPath}
          onDuplicate={handleDuplicate}
          onCreateFile={() => {}}
          onCreateFolder={() => {}}
          onAnalyzeWithAI={onAnalyzeWithAI ? () => onAnalyzeWithAI(file.path, false) : undefined}
        />
      )}
    </div>
  );
}

export default function FileTree({
  tree, activeFile, onFileSelect, onCreateFile, onCreateFolder,
  onDeleteNode, onRenameNode, onDuplicateNode, getFileContent,
  getAllFilesUnder, expandedDirs, toggleDir, projectName = "Projeto",
  onExportZip, onAnalyzeWithAI, extraRootItems,
}: FileTreeProps) {
  const ROOT_KEY = "__root__";
  const rootExpanded = expandedDirs.has(ROOT_KEY);
  const [rootSheet, setRootSheet] = useState(false);

  const handleRootZip = useCallback(async () => {
    if (onExportZip) { onExportZip(); return; }
    const allFiles = getAllFilesUnder("");
    const zip = new JSZip();
    for (const f of allFiles) {
      if (!f.path.endsWith(".gitkeep")) zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${projectName.replace(/\s+/g, "-").toLowerCase()}.zip`);
  }, [onExportZip, getAllFilesUnder, projectName]);

  const handleRootCopyPath = useCallback(() => {
    navigator.clipboard.writeText("/").catch(() => {});
  }, []);

  const isEmpty = tree.children.filter(c => !(isDirectory(c) ? false : (c as VFSFile).name === ".gitkeep")).length === 0;

  return (
    <div className="py-1 select-none overflow-y-auto h-full">
      {/* Project Root */}
      <div>
        <div
          className="flex items-center gap-1.5 px-2 py-[6px] hover:bg-white/5 cursor-pointer group select-none border-b border-gray-700/20"
          onClick={() => toggleDir(ROOT_KEY)}
        >
          {rootExpanded
            ? <ChevronDown size={13} className="text-gray-500 shrink-0" />
            : <ChevronRight size={13} className="text-gray-500 shrink-0" />}
          {rootExpanded
            ? <FolderOpen size={13} className="text-amber-400 shrink-0" />
            : <Folder size={13} className="text-amber-400 shrink-0" />}
          <span className="truncate text-gray-200 flex-1 text-[12px] font-semibold ml-0.5">{projectName}</span>
          <button
            onClick={e => { e.stopPropagation(); setRootSheet(true); }}
            className="opacity-40 active:opacity-100 p-1.5 hover:bg-white/10 active:bg-white/15 rounded-lg text-gray-400 shrink-0"
          >
            <MoreVertical size={13} />
          </button>
        </div>

        {rootSheet && (
          <NodeContextSheet
            info={{ label: projectName, path: "/", isDir: true, isRoot: true }}
            onClose={() => setRootSheet(false)}
            onRename={() => {}}
            onDelete={() => {}}
            onDownload={() => {}}
            onDownloadZip={handleRootZip}
            onCopyPath={handleRootCopyPath}
            onDuplicate={() => {}}
            onCreateFile={() => onCreateFile("")}
            onCreateFolder={() => onCreateFolder("")}
            onAnalyzeWithAI={onAnalyzeWithAI ? () => onAnalyzeWithAI("/", true) : undefined}
            extraItems={extraRootItems}
          />
        )}

        {/* Children — só mostra se a raiz estiver expandida */}
        {rootExpanded && (
          <div>
            {isEmpty ? (
              <div className="px-6 py-5 text-center">
                <p className="text-[11px] text-gray-600">Nenhum arquivo ainda</p>
                <div className="flex gap-2 justify-center mt-3">
                  <button onClick={() => onCreateFile("")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-gray-700/30 rounded-lg text-[11px] text-gray-400 hover:text-gray-300">
                    <FilePlus size={12} /> Arquivo
                  </button>
                  <button onClick={() => onCreateFolder("")} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-gray-700/30 rounded-lg text-[11px] text-gray-400 hover:text-gray-300">
                    <FolderPlus size={12} /> Pasta
                  </button>
                </div>
              </div>
            ) : (
              tree.children
                .filter(c => !(isDirectory(c) ? false : (c as VFSFile).name === ".gitkeep"))
                .sort((a, b) => {
                  const aIsDir = isDirectory(a);
                  const bIsDir = isDirectory(b);
                  if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map(child => (
                  <TreeNode
                    key={child.path} node={child} depth={1} activeFile={activeFile}
                    onFileSelect={onFileSelect} onCreateFile={onCreateFile}
                    onCreateFolder={onCreateFolder} onDeleteNode={onDeleteNode}
                    onRenameNode={onRenameNode} onDuplicateNode={onDuplicateNode}
                    getFileContent={getFileContent} getAllFilesUnder={getAllFilesUnder}
                    expandedDirs={expandedDirs} toggleDir={toggleDir}
                    onAnalyzeWithAI={onAnalyzeWithAI}
                  />
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
