import { useState, useEffect, useCallback } from "react";
import { Cloud, Upload, Trash2, ExternalLink, Loader2, X, RefreshCw, HardDrive } from "lucide-react";
import { generateZipBase64 } from "@/lib/zip-service";

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
}

interface DriveBackupPanelProps {
  onClose: () => void;
  files: Record<string, string>;
  projectName: string;
}

const API_BASE = (() => {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  return base.replace(/\/$/, "") + "/api";
})();

export default function DriveBackupPanel({ onClose, files, projectName }: DriveBackupPanelProps) {
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/drive/list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar Drive");
      setDriveFiles(data.files || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleBackup = async () => {
    setUploading(true);
    setStatus("📦 Compactando projeto...");
    setError("");
    try {
      const zipBase64 = await generateZipBase64(files);
      const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "-");
      const name = `sk-backup_${projectName.replace(/\s+/g, "-").toLowerCase()}_${ts}.zip`;

      setStatus("☁️ Enviando para o Google Drive...");
      const res = await fetch(`${API_BASE}/drive/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, zipBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");

      setStatus(`✅ Backup "${name}" salvo no Drive!`);
      await loadFiles();
      setTimeout(() => setStatus(""), 5000);
    } catch (e: any) {
      setError(e.message);
      setStatus("");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Apagar "${fileName}" do Drive?`)) return;
    setDeletingId(fileId);
    try {
      const res = await fetch(`${API_BASE}/drive/delete/${fileId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erro ao apagar");
      }
      setDriveFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const fileCount = Object.keys(files).length;
  const sizekb = Math.round(Object.values(files).join("").length / 1024);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#0d0d0d] border-t border-gray-700/50 rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-gray-700/40">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <HardDrive size={18} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white">Backup no Google Drive</p>
            <p className="text-[11px] text-gray-500 truncate">
              {fileCount} arquivo{fileCount !== 1 ? "s" : ""} · ~{sizekb} KB no projeto atual
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-gray-300 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Área de ação — enviar backup */}
        <div className="px-5 py-4 border-b border-gray-700/30">
          <button
            onClick={handleBackup}
            disabled={uploading || fileCount === 0}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-[15px] hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/40"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {uploading ? "Enviando..." : "Fazer Backup Agora (.zip)"}
          </button>
          {status && (
            <p className="mt-2.5 text-[12px] text-center font-medium text-green-400">{status}</p>
          )}
          {error && (
            <p className="mt-2.5 text-[12px] text-center text-red-400">❌ {error}</p>
          )}
        </div>

        {/* Lista de backups no Drive */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(90vh - 230px)" }}>
          <div className="flex items-center justify-between px-5 py-3">
            <p className="text-[12px] font-semibold text-gray-400">
              Backups salvos no Drive ({driveFiles.length})
            </p>
            <button onClick={loadFiles} disabled={loading} className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-gray-600" />
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
              <Cloud size={28} className="text-gray-700" />
              <p className="text-[13px] text-gray-600">Nenhum backup encontrado no Drive</p>
              <p className="text-[11px] text-gray-700">Clique em "Fazer Backup" acima para salvar</p>
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-2">
              {driveFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-700/40 bg-[#141414] hover:border-gray-600/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Cloud size={14} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-200 truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-600">
                      {new Date(f.modifiedTime).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      {f.size ? ` · ${Math.round(Number(f.size) / 1024)} KB` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {f.webViewLink && (
                      <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        title="Abrir no Drive">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(f.id, f.name)}
                      disabled={deletingId === f.id}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Apagar"
                    >
                      {deletingId === f.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
