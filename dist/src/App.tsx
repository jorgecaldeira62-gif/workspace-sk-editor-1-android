import { useState, useCallback, useRef, useEffect } from "react";
import { VirtualFileSystem } from "@/lib/virtual-fs";
import { Template } from "@/lib/templates";
import { importFromZip } from "@/lib/zip-service";
import {
  Project, loadProjects, saveProjects, createProject,
  upsertProject, duplicateProject, getCurrentProjectId, setCurrentProjectId,
  reloadProjectsFromIDB, migrateProjectsToIDB,
} from "@/lib/projects";
import TemplateSelector from "@/components/TemplateSelector";
import EditorLayout from "@/components/EditorLayout";
import CampoLivre from "@/components/CampoLivre";
import AssistenteJuridico from "@/components/AssistenteJuridico";

const vfs = new VirtualFileSystem();

function App() {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showCampoLivre,      setShowCampoLivre]      = useState(false);
  const [showAssistenteJur,   setShowAssistenteJur]   = useState(false);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem("sk-light-mode") === "1");

  useEffect(() => {
    localStorage.setItem("sk-light-mode", lightMode ? "1" : "0");
  }, [lightMode]);

  const zipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const all = loadProjects();
    setProjects(all);
    const id = getCurrentProjectId();
    if (id) {
      const p = all.find(x => x.id === id);
      if (p && Object.keys(p.files).length > 0) {
        vfs.clear();
        vfs.fromJSON(p.files);
        setCurrentProject(p);
      }
    }
    // Migração async: carrega arquivos do IndexedDB (projetos grandes)
    migrateProjectsToIDB();
    reloadProjectsFromIDB(all).then(updated => {
      setProjects(updated);
      if (id) {
        const upd = updated.find(p => p.id === id);
        if (upd && Object.keys(upd.files).length > 0) {
          vfs.clear();
          vfs.fromJSON(upd.files);
          setCurrentProject(upd);
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCurrentProject = useCallback((proj: Project, name?: string) => {
    const updated: Project = {
      ...proj,
      name: name || proj.name,
      files: vfs.toJSON(),
      updatedAt: Date.now(),
    };
    setCurrentProject(updated);
    setProjects(prev => {
      const next = upsertProject(prev, updated);
      saveProjects(next);
      return next;
    });
    return updated;
  }, []);

  useEffect(() => {
    if (!currentProject) return;
    const save = () => saveCurrentProject(currentProject);
    const unsub = vfs.onChange(save);
    const interval = setInterval(save, 8000);
    return () => { unsub(); clearInterval(interval); };
  }, [currentProject, saveCurrentProject]);

  const handleStart = useCallback((files: Record<string, string>, name: string) => {
    const project = createProject(name, files);
    vfs.clear();
    vfs.fromJSON(files);
    setCurrentProject(project);
    setCurrentProjectId(project.id);
    setProjects(prev => {
      const next = [project, ...prev];
      saveProjects(next);
      return next;
    });
  }, []);

  const handleOpenProject = useCallback((project: Project) => {
    // Salva o projeto atual antes de trocar
    setCurrentProject(prev => {
      if (prev) {
        const updated: Project = { ...prev, files: vfs.toJSON(), updatedAt: Date.now() };
        setProjects(all => { const next = upsertProject(all, updated); saveProjects(next); return next; });
      }
      return prev;
    });
    vfs.clear();
    vfs.fromJSON(project.files);
    setCurrentProject(project);
    setCurrentProjectId(project.id);
  }, []);

  const handleNewProject = useCallback(() => {
    setCurrentProject(null);
    setCurrentProjectId(null);
    vfs.clear();
  }, []);

  const handleImportZip = useCallback(() => zipInputRef.current?.click(), []);

  const handleZipFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importFromZip(file);
      const count = Object.keys(imported).length;
      if (count === 0) {
        alert("Nenhum arquivo de código encontrado no ZIP.\n\nPossíveis motivos:\n• O ZIP contém apenas imagens ou arquivos binários\n• Os arquivos estão em formato que não pode ser lido\n• O ZIP está vazio ou corrompido");
        return;
      }
      handleStart(imported, file.name.replace(/\.(zip|tar\.gz|tgz|tar)$/i, ""));
      setTimeout(() => {
        alert(`✓ ${count} arquivo(s) importado(s) com sucesso!\n\nNode_modules, arquivos binários e pastas de build foram ignorados automaticamente para manter o projeto organizado.\n\nAbra a Jasmim (✨) para pedir ajuda para entender ou modificar o projeto.`);
      }, 800);
    } catch (err: any) { alert(`Erro ao importar: ${err.message}`); }
    e.target.value = "";
  }, [handleStart]);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      saveProjects(next);
      return next;
    });
  }, []);

  const handleDuplicateProject = useCallback((project: Project) => {
    const dup = duplicateProject(project);
    setProjects(prev => {
      const next = [dup, ...prev];
      saveProjects(next);
      return next;
    });
  }, []);

  const handleSaveProject = useCallback((name: string) => {
    if (!currentProject) return;
    saveCurrentProject(currentProject, name);
  }, [currentProject, saveCurrentProject]);

  const toggleBtn = (
    <button
      onClick={() => setLightMode(v => !v)}
      style={{
        position: "fixed", top: 8, right: 8, zIndex: 99999,
        width: 26, height: 26, borderRadius: "50%",
        background: lightMode ? "#1c2714" : "#e8f5e0",
        border: lightMode ? "1px solid #4a7c3f" : "1px solid #6ab04c",
        fontSize: 13, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 6px rgba(0,0,0,0.25)",
        opacity: 0.85,
      }}
      title={lightMode ? "Modo escuro" : "Modo claro"}
    >
      {lightMode ? "🌙" : "☀️"}
    </button>
  );

  const filterStyle = lightMode
    ? { filter: "invert(1) hue-rotate(180deg)", minHeight: "100dvh" }
    : { minHeight: "100dvh" };

  if (showCampoLivre) {
    return <div style={filterStyle}>{toggleBtn}<CampoLivre onBack={() => setShowCampoLivre(false)} /></div>;
  }

  if (showAssistenteJur) {
    return <div style={filterStyle}>{toggleBtn}<AssistenteJuridico onBack={() => setShowAssistenteJur(false)} /></div>;
  }

  if (!currentProject) {
    return (
      <div style={filterStyle}>
        {toggleBtn}
        <input ref={zipInputRef} type="file" accept=".zip,.tar,.tar.gz,.tgz" onChange={handleZipFile} className="hidden" />
        <TemplateSelector
          projects={projects}
          onSelect={(t: Template) => handleStart(t.files, t.name)}
          onOpenProject={handleOpenProject}
          onImportZip={handleImportZip}
          onCreateFromAI={(files, name) => handleStart(files, name)}
          onDeleteProject={handleDeleteProject}
          onDuplicateProject={handleDuplicateProject}
          onOpenCampoLivre={() => setShowCampoLivre(true)}
          onOpenAssistenteJuridico={() => setShowAssistenteJur(true)}
        />
      </div>
    );
  }

  return (
    <div style={filterStyle}>
      {toggleBtn}
      <EditorLayout
        vfs={vfs}
        projectName={currentProject.name}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onOpenCampoLivre={() => setShowCampoLivre(true)}
        onOpenAssistenteJuridico={() => setShowAssistenteJur(true)}
        onBackToProjects={() => {
          if (currentProject) {
            const updated: Project = { ...currentProject, files: vfs.toJSON(), updatedAt: Date.now() };
            setProjects(prev => { const next = upsertProject(prev, updated); saveProjects(next); return next; });
          }
          setCurrentProject(null);
          setCurrentProjectId(null);
        }}
      />
    </div>
  );
}

export default App;
