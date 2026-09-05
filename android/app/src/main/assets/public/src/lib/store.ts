import { createContext, useContext } from "react";
import { VirtualFileSystem } from "./virtual-fs";

export const vfs = new VirtualFileSystem();

export interface EditorState {
  openFiles: string[];
  activeFile: string | null;
  projectName: string;
}

export function loadEditorState(): EditorState {
  try {
    const saved = localStorage.getItem("editor-state");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { openFiles: [], activeFile: null, projectName: "Meu Projeto" };
}

export function saveEditorState(state: EditorState) {
  localStorage.setItem("editor-state", JSON.stringify(state));
}

export function loadProjectFiles(): Record<string, string> | null {
  try {
    const saved = localStorage.getItem("project-files");
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function saveProjectFiles(files: Record<string, string>) {
  localStorage.setItem("project-files", JSON.stringify(files));
}

export const VFSContext = createContext<VirtualFileSystem>(vfs);
export const useVFS = () => useContext(VFSContext);
