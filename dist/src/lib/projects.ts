import { idbSet, idbGet } from "./idb-storage";

export interface Project {
  id: string;
  name: string;
  files: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fileCount?: number;
  sizeBytes?: number;
}

const INDEX_KEY   = "sk-editor-projects";
const CURRENT_KEY = "sk-editor-current";
const FILES_PREFIX = "sk-proj-files-";

function calcSize(files: Record<string, string>): number {
  return Object.values(files).reduce((a, v) => a + v.length, 0);
}

// ── Salvar arquivos: sempre IDB (sem limite) + tenta localStorage como cache ─
function saveProjectFiles(id: string, files: Record<string, string>): void {
  const key = FILES_PREFIX + id;
  // IndexedDB — sem limite de tamanho, fire-and-forget
  idbSet(key, files).catch(() => {});
  // localStorage — como cache rápido, pode falhar em projetos grandes
  try {
    localStorage.setItem(key, JSON.stringify(files));
  } catch {
    try {
      const trimmed: Record<string, string> = {};
      for (const [k, v] of Object.entries(files)) {
        if (v.length < 100_000) trimmed[k] = v;
      }
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch { /* sem espaço, IDB já tem */ }
  }
}

// ── Carregar (sync): localStorage cache ────────────────────────────────────
function loadProjectFiles(id: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(FILES_PREFIX + id);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ── Carregar (async): IDB first, fallback localStorage ────────────────────
export async function loadProjectFilesAsync(id: string): Promise<Record<string, string>> {
  try {
    const fromIDB = await idbGet<Record<string, string>>(FILES_PREFIX + id);
    if (fromIDB && Object.keys(fromIDB).length > 0) return fromIDB;
  } catch {}
  return loadProjectFiles(id);
}

// ── Salvar arquivos direto no IDB (async export) ──────────────────────────
export async function saveProjectFilesAsync(id: string, files: Record<string, string>): Promise<void> {
  await idbSet(FILES_PREFIX + id, files);
  saveProjectFiles(id, files);
}

// ── Índice de metadados ───────────────────────────────────────────────────
function loadIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map(p => ({
      id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt,
      fileCount: p.fileCount ?? (p.files ? Object.keys(p.files).length : 0),
      sizeBytes: p.sizeBytes ?? 0,
    }));
  } catch { return []; }
}

function saveIndex(metas: ProjectMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
  } catch {
    try {
      const slim = metas.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
      localStorage.setItem(INDEX_KEY, JSON.stringify(slim));
    } catch {}
  }
}

// ── API Pública ───────────────────────────────────────────────────────────

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    return parsed.map(p => {
      let files: Record<string, string>;
      if (p.files && Object.keys(p.files).length > 0) {
        files = p.files;
        saveProjectFiles(p.id, files);
      } else {
        files = loadProjectFiles(p.id);
      }
      return { id: p.id, name: p.name, files, createdAt: p.createdAt, updatedAt: p.updatedAt };
    });
  } catch { return []; }
}

// ── Migração async: garante IDB tem dados completos de todos os projetos ──
export async function migrateProjectsToIDB(): Promise<void> {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return;
    const parsed: any[] = JSON.parse(raw);
    for (const p of parsed) {
      const files = loadProjectFiles(p.id);
      if (Object.keys(files).length > 0) {
        const idbFiles = await idbGet<Record<string,string>>(FILES_PREFIX + p.id);
        if (!idbFiles || Object.keys(idbFiles).length === 0) {
          await idbSet(FILES_PREFIX + p.id, files);
        }
      }
    }
  } catch {}
}

// ── Recarregar projetos com IDB (retorna projetos atualizados) ────────────
export async function reloadProjectsFromIDB(projects: Project[]): Promise<Project[]> {
  const updated: Project[] = [];
  for (const p of projects) {
    const idbFiles = await idbGet<Record<string,string>>(FILES_PREFIX + p.id);
    if (idbFiles && Object.keys(idbFiles).length >= Object.keys(p.files).length) {
      updated.push({ ...p, files: idbFiles });
    } else {
      updated.push(p);
    }
  }
  return updated;
}

export function saveProjects(projects: Project[]): void {
  for (const p of projects) {
    saveProjectFiles(p.id, p.files);
  }
  const metas: ProjectMeta[] = projects.map(p => ({
    id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt,
    fileCount: Object.keys(p.files).length, sizeBytes: calcSize(p.files),
  }));
  saveIndex(metas);
}

export function getCurrentProjectId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}
export function setCurrentProjectId(id: string | null): void {
  if (id) localStorage.setItem(CURRENT_KEY, id);
  else localStorage.removeItem(CURRENT_KEY);
}

export function createProject(name: string, files: Record<string, string>): Project {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name, files, createdAt: Date.now(), updatedAt: Date.now(),
  };
}

export function upsertProject(projects: Project[], project: Project): Project[] {
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) { const next = [...projects]; next[idx] = { ...project }; return next; }
  return [project, ...projects];
}

export function duplicateProject(project: Project): Project {
  return { ...project, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name: project.name + " (cópia)", createdAt: Date.now(), updatedAt: Date.now() };
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function getProjectStats(files: Record<string, string>) {
  const count = Object.keys(files).length;
  const size = Object.values(files).reduce((a, v) => a + v.length, 0);
  return { count, size: size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B` };
}
