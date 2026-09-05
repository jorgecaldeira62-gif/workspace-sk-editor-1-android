/**
 * DatabasePanel — Banco de dados completo
 * Suporta: Neon/PostgreSQL (cloud), SQLite (local browser), MySQL (instrução)
 * Funciona offline, sem servidor Replit
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { neon } from "@neondatabase/serverless";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { X, Database, HardDrive, BookOpen, Settings2, Play, Download, Upload, RefreshCw, ChevronRight, Check, AlertCircle, Info, Plus, Trash2 } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface QueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  command: string;
  error?: string;
  timeMs?: number;
}

interface SchemaTable {
  name: string;
  columns: { name: string; type: string; nullable: boolean; default?: string }[];
  rowCount?: number;
}

interface SavedConnection {
  id: string;
  label: string;
  type: "neon" | "postgres" | "mysql" | "sqlite";
  connectionString: string;
  createdAt: number;
}

interface DatabasePanelProps {
  onClose: () => void;
  connectionString: string;
  onUpdateConnection: (s: string) => void;
  onSendToAI?: (msg: string) => void;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function loadSavedConnections(): SavedConnection[] {
  try { return JSON.parse(localStorage.getItem("sk-db-connections") || "[]"); } catch { return []; }
}
function saveSavedConnections(list: SavedConnection[]) {
  localStorage.setItem("sk-db-connections", JSON.stringify(list));
}

function neonErrorMsg(e: any): string {
  const raw = String(e?.message || e || "Erro desconhecido");
  if (raw.includes("fetch")) return "❌ Erro de rede — verifique se a string de conexão está correta e se há internet.";
  if (raw.includes("SSL") || raw.includes("ssl")) return "❌ Erro SSL — adicione '?sslmode=require' no final da string de conexão.";
  if (raw.includes("password") || raw.includes("auth")) return "❌ Senha incorreta — verifique usuário e senha na string de conexão.";
  if (raw.includes("does not exist") || raw.includes("database")) return "❌ Banco não encontrado — verifique o nome do banco na string de conexão.";
  if (raw.includes("ENOTFOUND") || raw.includes("getaddrinfo")) return "❌ Host não encontrado — verifique o endereço do servidor Neon.";
  if (raw.includes("timeout") || raw.includes("ETIMEDOUT")) return "❌ Timeout — o servidor demorou demais. Tente novamente.";
  if (raw.includes("tagged-template") || raw.includes("tagged_template")) return "❌ Versão incompatível da biblioteca. Recarregue o app.";
  return `❌ ${raw.slice(0, 300)}`;
}

async function runNeonQuery(connectionString: string, sqlText: string): Promise<QueryResult> {
  const t0 = Date.now();
  try {
    const sql = neon(connectionString.trim());
    const result = await sql.query(sqlText);
    const rows = Array.isArray(result) ? result : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, rowCount: rows.length, command: sqlText.trim().split(" ")[0].toUpperCase(), timeMs: Date.now() - t0 };
  } catch (e: any) {
    throw new Error(neonErrorMsg(e));
  }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function CodeBlock({ code, copyKey }: { code: string; copyKey: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group my-2">
      <pre className="bg-[#0a0f07] border border-[#2d4a1e] rounded-lg p-3 text-xs text-[#a8d5a2] overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded bg-[#2d4a1e] text-[#7ec87a] opacity-0 group-hover:opacity-100 transition-opacity"
      >{copied ? "✓" : "Copiar"}</button>
    </div>
  );
}

function QueryResultTable({ result }: { result: QueryResult }) {
  if (result.error) return (
    <div className="border border-red-700/50 bg-red-950/20 rounded-xl p-3 mt-3">
      <p className="text-xs font-bold text-red-400 mb-1">❌ Erro</p>
      <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-all">{result.error}</pre>
    </div>
  );
  return (
    <div className="border border-green-700/40 bg-green-950/10 rounded-xl p-3 mt-3">
      <p className="text-xs font-bold text-green-400 mb-2">
        ✅ {result.command} — {result.rowCount} linha{result.rowCount !== 1 ? "s" : ""} {result.timeMs ? `(${result.timeMs}ms)` : ""}
      </p>
      {result.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-[10px] font-mono w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-700/50">
                {result.columns.map(k => <th key={k} className="text-left px-2 py-1 text-gray-400 font-bold whitespace-nowrap">{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-b border-gray-800/30 hover:bg-white/5">
                  {result.columns.map(k => (
                    <td key={k} className="px-2 py-1 text-gray-300 max-w-[160px] truncate" title={String(row[k] ?? "")}>{String(row[k] ?? "null")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 50 && <p className="text-[10px] text-gray-600 mt-1">... e mais {result.rows.length - 50} linhas</p>}
        </div>
      )}
    </div>
  );
}

// ─── Aba PostgreSQL / Neon ────────────────────────────────────────────────────

function NeonTab({ connectionString, onUpdateConnection, onSendToAI }: {
  connectionString: string;
  onUpdateConnection: (s: string) => void;
  onSendToAI?: (msg: string) => void;
}) {
  const [connInput, setConnInput] = useState(connectionString);
  const [showConn, setShowConn] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sql, setSql] = useState("SELECT * FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [subTab, setSubTab] = useState<"query" | "schema" | "backup">("query");

  const save = useCallback(() => {
    const trimmed = connInput.trim();
    onUpdateConnection(trimmed);
    localStorage.setItem("sk-db-url", trimmed);
    setTestResult(null);
  }, [connInput, onUpdateConnection]);

  const test = useCallback(async () => {
    const url = connInput.trim();
    if (!url) return;
    save();
    setTesting(true); setTestResult(null);
    try {
      const r = await runNeonQuery(url, "SELECT NOW() AS agora, current_database() AS banco, version() AS versao;");
      setTestResult({ ok: true, msg: `✅ Conectado! Banco: ${r.rows[0]?.banco} | ${String(r.rows[0]?.agora).slice(0, 19)}` });
      setResult(r);
      // Carregar tabelas automaticamente após conexão bem-sucedida
      setSubTab("schema");
      setSchemaLoading(true);
      try {
        const tablesResult = await runNeonQuery(url, `
          SELECT t.table_name,
                 c.column_name, c.data_type, c.is_nullable, c.column_default,
                 s.n_live_tup
          FROM information_schema.tables t
          JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
          LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
          WHERE t.table_schema = 'public'
          ORDER BY t.table_name, c.ordinal_position;
        `);
        const tables: Record<string, SchemaTable> = {};
        for (const row of tablesResult.rows) {
          const tname = String(row.table_name);
          if (!tables[tname]) tables[tname] = { name: tname, columns: [], rowCount: row.n_live_tup ? Number(row.n_live_tup) : undefined };
          tables[tname].columns.push({ name: String(row.column_name), type: String(row.data_type), nullable: row.is_nullable === "YES", default: row.column_default ? String(row.column_default) : undefined });
        }
        setSchema(Object.values(tables));
      } catch { setSchema([]); }
      finally { setSchemaLoading(false); }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally { setTesting(false); }
  }, [connInput, save]);

  const loadSchema = useCallback(async () => {
    const url = connectionString.trim();
    if (!url) return;
    setSchemaLoading(true);
    try {
      const tablesResult = await runNeonQuery(url, `
        SELECT t.table_name,
               c.column_name, c.data_type, c.is_nullable, c.column_default,
               s.n_live_tup
        FROM information_schema.tables t
        JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public'
        ORDER BY t.table_name, c.ordinal_position;
      `);
      const tables: Record<string, SchemaTable> = {};
      for (const row of tablesResult.rows) {
        const tname = String(row.table_name);
        if (!tables[tname]) tables[tname] = { name: tname, columns: [], rowCount: row.n_live_tup ? Number(row.n_live_tup) : undefined };
        tables[tname].columns.push({ name: String(row.column_name), type: String(row.data_type), nullable: row.is_nullable === "YES", default: row.column_default ? String(row.column_default) : undefined });
      }
      setSchema(Object.values(tables));
    } catch (e: any) {
      setSchema([]);
    } finally { setSchemaLoading(false); }
  }, [connectionString]);

  const runQuery = useCallback(async (override?: string) => {
    const url = connectionString.trim();
    if (!url || !sql.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await runNeonQuery(url, override || sql);
      setResult(r);
    } catch (e: any) {
      setResult({ rows: [], columns: [], rowCount: 0, command: "ERROR", error: e.message });
    } finally { setLoading(false); }
  }, [connectionString, sql]);

  const viewTable = useCallback(async (tableName: string) => {
    setSelectedTable(tableName);
    setSql(`SELECT * FROM "${tableName}" LIMIT 50;`);
    setSubTab("query");
    await runQuery(`SELECT * FROM "${tableName}" LIMIT 50;`);
  }, [runQuery]);

  const exportBackup = useCallback(async () => {
    const url = connectionString.trim();
    if (!url) return;
    try {
      const tablesRes = await runNeonQuery(url, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
      let dump = `-- Backup gerado em ${new Date().toISOString()}\n-- Banco: PostgreSQL/Neon\n\n`;
      for (const row of tablesRes.rows) {
        const tname = String(row.table_name);
        const dataRes = await runNeonQuery(url, `SELECT * FROM "${tname}";`);
        dump += `-- Tabela: ${tname}\n`;
        for (const r of dataRes.rows) {
          const cols = Object.keys(r).map(k => `"${k}"`).join(", ");
          const vals = Object.values(r).map(v => v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`).join(", ");
          dump += `INSERT INTO "${tname}" (${cols}) VALUES (${vals});\n`;
        }
        dump += "\n";
      }
      const blob = new Blob([dump], { type: "text/sql" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.sql`; a.click();
    } catch (e: any) { alert("Erro no backup: " + e.message); }
  }, [connectionString]);

  const QUICK_QUERIES = [
    { label: "📋 Ver tabelas", sql: "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" },
    { label: "🔍 Ver colunas", sql: "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;" },
    { label: "📊 Contagem por tabela", sql: "SELECT relname AS tabela, n_live_tup AS linhas FROM pg_stat_user_tables ORDER BY n_live_tup DESC;" },
    { label: "🔑 Ver índices", sql: "SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename;" },
    { label: "🔗 Ver restrições", sql: "SELECT constraint_name, table_name, constraint_type FROM information_schema.table_constraints WHERE table_schema='public' ORDER BY table_name;" },
    { label: "⏰ NOW() / Versão", sql: "SELECT NOW() AS agora, current_database() AS banco, version() AS versao;" },
  ];

  const JURIDICO_TABLES = [
    { label: "👤 Clientes + Usuários", sql: `CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, nome VARCHAR(200) NOT NULL, cpf VARCHAR(14) UNIQUE, email VARCHAR(150), telefone VARCHAR(20), celular VARCHAR(20), endereco TEXT, cidade VARCHAR(100), estado CHAR(2), data_nascimento DATE, observacoes TEXT, ativo BOOLEAN DEFAULT true, criado_em TIMESTAMP DEFAULT NOW(), atualizado_em TIMESTAMP DEFAULT NOW());\n\nCREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(150) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL, senha_hash VARCHAR(255), perfil VARCHAR(20) DEFAULT 'advogado', oab VARCHAR(20), ativo BOOLEAN DEFAULT true, criado_em TIMESTAMP DEFAULT NOW());` },
    { label: "📁 Processos", sql: `CREATE TABLE IF NOT EXISTS processos (id SERIAL PRIMARY KEY, numero_processo VARCHAR(50) UNIQUE NOT NULL, cliente_id INTEGER REFERENCES clientes(id), usuario_id INTEGER REFERENCES usuarios(id), tipo VARCHAR(50), area_direito VARCHAR(50), vara VARCHAR(100), comarca VARCHAR(100), tribunal VARCHAR(100), fase VARCHAR(50) DEFAULT 'inicial', status VARCHAR(30) DEFAULT 'ativo', polo_ativo TEXT, polo_passivo TEXT, objeto TEXT, valor_causa DECIMAL(15,2), data_distribuicao DATE, data_prazo DATE, observacoes TEXT, criado_em TIMESTAMP DEFAULT NOW(), atualizado_em TIMESTAMP DEFAULT NOW());` },
    { label: "📅 Audiências + Prazos", sql: `CREATE TABLE IF NOT EXISTS audiencias (id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id), tipo VARCHAR(80), data_hora TIMESTAMP NOT NULL, local VARCHAR(200), juiz VARCHAR(150), pauta TEXT, resultado TEXT, status VARCHAR(20) DEFAULT 'agendada', criado_em TIMESTAMP DEFAULT NOW());\n\nCREATE TABLE IF NOT EXISTS prazos (id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id), descricao TEXT NOT NULL, data_limite DATE NOT NULL, tipo VARCHAR(50), concluido BOOLEAN DEFAULT false, criado_em TIMESTAMP DEFAULT NOW());` },
    { label: "📄 Docs + Movimentações", sql: `CREATE TABLE IF NOT EXISTS documentos (id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id), nome VARCHAR(200) NOT NULL, tipo VARCHAR(50), url TEXT, tamanho_bytes INTEGER, criado_em TIMESTAMP DEFAULT NOW());\n\nCREATE TABLE IF NOT EXISTS movimentacoes (id SERIAL PRIMARY KEY, processo_id INTEGER REFERENCES processos(id), descricao TEXT NOT NULL, tipo VARCHAR(50), data_movimentacao TIMESTAMP DEFAULT NOW(), usuario_id INTEGER REFERENCES usuarios(id));` },
  ];

  return (
    <div className="space-y-4">
      {/* Conexão */}
      <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
        <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2 block">🔗 String de Conexão (Neon / PostgreSQL)</label>
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <input
              type={showConn ? "text" : "password"}
              value={connInput}
              onChange={e => setConnInput(e.target.value)}
              onBlur={save}
              placeholder="postgresql://usuario:senha@host/banco?sslmode=require"
              className="w-full px-3 py-2.5 bg-[#0d0d0d] border border-gray-700/50 rounded-xl text-[12px] font-mono text-gray-200 placeholder-gray-700 outline-none focus:border-green-500/60 pr-16"
            />
            <button onClick={() => setShowConn(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 hover:text-gray-300">{showConn ? "🙈" : "👁"}</button>
          </div>
          <button onClick={test} disabled={testing || !connInput.trim()} className="px-4 py-2.5 bg-green-600/20 border border-green-500/40 rounded-xl text-[12px] text-green-300 font-bold hover:bg-green-600/30 disabled:opacity-40 shrink-0">
            {testing ? "..." : "Testar"}
          </button>
        </div>
        {testResult && (
          <p className={`text-[11px] font-mono ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.msg}</p>
        )}
        {!connInput.trim() && (
          <div className="mt-2 bg-blue-950/20 border border-blue-700/30 rounded-lg p-3">
            <p className="text-[11px] font-bold text-blue-300 mb-1.5">📖 Como criar banco gratuito no Neon:</p>
            <ol className="space-y-1">
              {["Acesse neon.tech → Sign Up (gratuito, sem cartão)", "Crie projeto → dê um nome → escolha região", "Em Connection Details → copie a Connection string", "Cole acima e clique Testar"].map((step, i) => (
                <li key={i} className="flex gap-2 text-[10px] text-gray-300">
                  <span className="w-4 h-4 bg-blue-700/40 text-blue-300 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0">{i+1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a href="https://neon.tech" target="_blank" rel="noreferrer" className="inline-block mt-2 text-[10px] text-blue-400 underline">→ Abrir neon.tech</a>
          </div>
        )}
      </div>

      {/* Sub-abas */}
      {connectionString && (
        <>
          <div className="flex gap-1 bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-1">
            {[{ id: "query", label: "▶ SQL" }, { id: "schema", label: "📐 Schema" }, { id: "backup", label: "💾 Backup" }].map(t => (
              <button key={t.id} onClick={() => { setSubTab(t.id as any); if (t.id === "schema") loadSchema(); }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${subTab === t.id ? "bg-green-600/30 text-green-300" : "text-gray-500 hover:text-gray-300"}`}
              >{t.label}</button>
            ))}
          </div>

          {/* SQL Runner */}
          {subTab === "query" && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">Consultas Rápidas</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_QUERIES.map(q => (
                    <button key={q.label} onClick={() => { setSql(q.sql); setTimeout(() => runQuery(q.sql), 50); }}
                      className="px-2 py-1.5 bg-[#0d0d0d] border border-gray-700/40 rounded-lg text-[10px] text-gray-300 hover:border-blue-500/40 hover:text-blue-300 text-left transition-all"
                    >{q.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">SQL Personalizado</label>
                <textarea
                  value={sql}
                  onChange={e => setSql(e.target.value)}
                  rows={4}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery(); } }}
                  placeholder="SELECT * FROM minhas_tabelas LIMIT 10;"
                  className="w-full px-3 py-2.5 bg-[#0a0f07] border border-gray-700/50 rounded-xl text-[12px] font-mono text-gray-200 placeholder-gray-700 outline-none focus:border-blue-500/60 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => runQuery()} disabled={loading || !sql.trim()}
                    className="flex-1 py-2.5 bg-blue-600/30 border border-blue-500/40 rounded-xl text-[12px] text-blue-300 font-bold hover:bg-blue-600/40 disabled:opacity-40"
                  >{loading ? "Executando..." : "▶ Executar (Ctrl+Enter)"}</button>
                  {onSendToAI && (
                    <button onClick={() => onSendToAI(`Me ajude com o banco de dados PostgreSQL.\n\nSQL atual:\n\`\`\`sql\n${sql}\n\`\`\`\n\nResultado: ${result ? JSON.stringify(result.rows.slice(0, 5)) : "não executado"}\n\nMe ajude a melhorar ou analisar.`)}
                      className="px-3 py-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-[11px] text-purple-300 font-bold hover:bg-purple-600/30 shrink-0"
                    >🤖 IA</button>
                  )}
                </div>
              </div>

              {result && <QueryResultTable result={result} />}

              {/* Tabelas Jurídicas */}
              <div className="bg-amber-950/20 border border-amber-700/30 rounded-xl p-3">
                <p className="text-[11px] font-bold text-amber-300 mb-2">⚖️ Criar Tabelas Jurídicas</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {JURIDICO_TABLES.map(t => (
                    <button key={t.label} onClick={() => { setSql(t.sql); setTimeout(() => runQuery(t.sql), 50); }}
                      className="px-2 py-2 bg-[#0d0d0d] border border-amber-700/30 rounded-lg text-[10px] text-amber-200 hover:border-amber-500/60 text-left transition-all"
                    >{t.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Schema Browser */}
          {subTab === "schema" && (
            <div>
              {schemaLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500 text-sm">Carregando schema...</div>
              ) : schema.length === 0 ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Database size={32} className="text-gray-600" />
                  <p className="text-gray-500 text-sm">Nenhuma tabela encontrada</p>
                  <button onClick={loadSchema} className="text-xs text-blue-400 underline">Tentar novamente</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {schema.map(t => (
                    <div key={t.name} className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl overflow-hidden">
                      <button className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-all" onClick={() => viewTable(t.name)}>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 text-sm">📋</span>
                          <span className="text-[12px] font-bold text-gray-200 font-mono">{t.name}</span>
                          {t.rowCount !== undefined && <span className="text-[10px] text-gray-600">({t.rowCount} linhas)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-600">{t.columns.length} cols</span>
                          <ChevronRight size={13} className="text-gray-600" />
                        </div>
                      </button>
                      {selectedTable === t.name && (
                        <div className="border-t border-[#2d4a1e] px-3 py-2">
                          <table className="w-full text-[10px] font-mono">
                            <thead><tr className="border-b border-gray-800">
                              <th className="text-left py-1 text-gray-500 font-bold">Coluna</th>
                              <th className="text-left py-1 text-gray-500 font-bold">Tipo</th>
                              <th className="text-left py-1 text-gray-500 font-bold">Null?</th>
                              <th className="text-left py-1 text-gray-500 font-bold">Default</th>
                            </tr></thead>
                            <tbody>
                              {t.columns.map(c => (
                                <tr key={c.name} className="border-b border-gray-900/50">
                                  <td className="py-1 text-green-300">{c.name}</td>
                                  <td className="py-1 text-blue-300">{c.type}</td>
                                  <td className="py-1 text-gray-500">{c.nullable ? "sim" : "não"}</td>
                                  <td className="py-1 text-gray-600 truncate max-w-[80px]">{c.default ?? "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Backup */}
          {subTab === "backup" && (
            <div className="space-y-3">
              <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
                <p className="text-[12px] font-bold text-gray-200 mb-2">💾 Exportar Backup como SQL</p>
                <p className="text-[10px] text-gray-500 mb-3">Gera um arquivo .sql com todos os INSERTs das tabelas públicas. Use para restaurar em qualquer banco PostgreSQL.</p>
                <button onClick={exportBackup} className="w-full py-2.5 bg-blue-600/20 border border-blue-500/40 rounded-xl text-[12px] text-blue-300 font-bold hover:bg-blue-600/30">
                  ⬇️ Baixar Backup .sql
                </button>
              </div>
              <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
                <p className="text-[12px] font-bold text-gray-200 mb-2">📊 Exportar Tabela como CSV</p>
                <div className="flex gap-2">
                  <select className="flex-1 px-3 py-2 bg-[#0d0d0d] border border-gray-700/50 rounded-xl text-[12px] text-gray-300 outline-none" onChange={async e => {
                    const tname = e.target.value; if (!tname) return;
                    const r = await runNeonQuery(connectionString, `SELECT * FROM "${tname}";`);
                    if (r.rows.length === 0) return;
                    const header = r.columns.join(",");
                    const body = r.rows.map(row => r.columns.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
                    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                    a.download = `${tname}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
                  }}>
                    <option value="">Escolha uma tabela...</option>
                    {schema.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Aba SQLite Local ─────────────────────────────────────────────────────────

function SQLiteTab({ onSendToAI }: { onSendToAI?: (msg: string) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dbName, setDbName] = useState("meu-banco.db");
  const [sql, setSql] = useState("CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT UNIQUE, criado_em DATETIME DEFAULT CURRENT_TIMESTAMP);");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<string[]>([]);
  const dbRef = useRef<any>(null);

  const initDb = useCallback(async (data?: ArrayBuffer) => {
    setStatus("loading");
    try {
      const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
      dbRef.current = data ? new SQL.Database(new Uint8Array(data)) : new SQL.Database();
      setStatus("ready");
      refreshSchema();
    } catch (e: any) {
      setStatus("error"); setErrorMsg(e.message);
    }
  }, []);

  const refreshSchema = useCallback(() => {
    if (!dbRef.current) return;
    try {
      const tables = dbRef.current.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
      setSchema(tables[0]?.values.map((r: any) => String(r[0])) || []);
    } catch {}
  }, []);

  const runQuery = useCallback(async () => {
    if (!dbRef.current || !sql.trim()) return;
    setLoading(true); setResult(null);
    const t0 = Date.now();
    try {
      const res = dbRef.current.exec(sql);
      if (res.length === 0) {
        setResult({ rows: [], columns: [], rowCount: 0, command: sql.trim().split(" ")[0].toUpperCase(), timeMs: Date.now() - t0 });
      } else {
        const { columns, values } = res[0];
        const rows = values.map((r: any[]) => Object.fromEntries(columns.map((c: string, i: number) => [c, r[i]])));
        setResult({ rows, columns, rowCount: rows.length, command: sql.trim().split(" ")[0].toUpperCase(), timeMs: Date.now() - t0 });
      }
      refreshSchema();
    } catch (e: any) {
      setResult({ rows: [], columns: [], rowCount: 0, command: "ERROR", error: e.message });
    } finally { setLoading(false); }
  }, [sql, refreshSchema]);

  const exportDb = useCallback(() => {
    if (!dbRef.current) return;
    const data = dbRef.current.export();
    const blob = new Blob([data], { type: "application/octet-stream" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = dbName; a.click();
  }, [dbName]);

  const exportSql = useCallback(() => {
    if (!dbRef.current) return;
    let dump = `-- SQLite Backup — ${new Date().toISOString()}\nPRAGMA foreign_keys=OFF;\n\n`;
    const tables = dbRef.current.exec("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name;");
    for (const table of tables[0]?.values || []) {
      dump += `${table[1]};\n\n`;
      const data = dbRef.current.exec(`SELECT * FROM "${table[0]}";`);
      for (const row of data[0]?.values || []) {
        const vals = row.map((v: any) => v === null ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`).join(", ");
        dump += `INSERT INTO "${table[0]}" VALUES (${vals});\n`;
      }
      dump += "\n";
    }
    const blob = new Blob([dump], { type: "text/sql" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = dbName.replace(".db", ".sql"); a.click();
  }, [dbName]);

  const QUICK_QUERIES = [
    { label: "📋 Ver tabelas", sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" },
    { label: "🔍 Schema tabela", sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='minha_tabela';" },
    { label: "📊 Contar linhas", sql: "SELECT 'usuarios' as tabela, COUNT(*) as linhas FROM usuarios;" },
    { label: "⏰ Data/Hora", sql: "SELECT datetime('now','localtime') AS agora, sqlite_version() AS versao;" },
  ];

  return (
    <div className="space-y-4">
      {status === "idle" && (
        <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
          <p className="text-[12px] font-bold text-gray-200 mb-1">🗃️ Banco de Dados Local (SQLite)</p>
          <p className="text-[10px] text-gray-500 mb-3">Funciona 100% no navegador — sem servidor, sem internet. Os dados ficam na memória (exporte para salvar).</p>
          <div className="flex gap-2 mb-3">
            <input value={dbName} onChange={e => setDbName(e.target.value)} placeholder="meu-banco.db"
              className="flex-1 px-3 py-2 bg-[#0d0d0d] border border-gray-700/50 rounded-xl text-[12px] font-mono text-gray-200 outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => initDb()} className="flex-1 py-2.5 bg-green-600/30 border border-green-500/40 rounded-xl text-[12px] text-green-300 font-bold hover:bg-green-600/40">
              + Criar Banco Novo
            </button>
            <label className="flex-1 py-2.5 bg-blue-600/20 border border-blue-500/40 rounded-xl text-[12px] text-blue-300 font-bold hover:bg-blue-600/30 text-center cursor-pointer">
              📂 Carregar .db
              <input type="file" accept=".db,.sqlite,.sqlite3" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                setDbName(f.name);
                f.arrayBuffer().then(buf => initDb(buf));
              }} />
            </label>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" /> Inicializando SQLite...
        </div>
      )}

      {status === "error" && (
        <div className="border border-red-700/50 bg-red-950/20 rounded-xl p-4">
          <p className="text-red-400 font-bold text-sm mb-1">❌ Erro ao inicializar</p>
          <p className="text-red-300 text-xs">{errorMsg}</p>
          <button onClick={() => setStatus("idle")} className="mt-2 text-xs text-blue-400 underline">Tentar novamente</button>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="flex items-center justify-between bg-green-950/20 border border-green-700/30 rounded-xl px-4 py-2">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-green-400" />
              <span className="text-[12px] text-green-300 font-bold">{dbName}</span>
              <span className="text-[10px] text-gray-500">{schema.length} tabela(s)</span>
            </div>
            <div className="flex gap-2">
              <button onClick={exportDb} className="text-[10px] px-2 py-1 bg-blue-700/30 border border-blue-600/40 rounded-lg text-blue-300 font-bold">⬇ .db</button>
              <button onClick={exportSql} className="text-[10px] px-2 py-1 bg-amber-700/30 border border-amber-600/40 rounded-lg text-amber-300 font-bold">⬇ .sql</button>
              <button onClick={() => { dbRef.current?.close(); dbRef.current = null; setStatus("idle"); setSchema([]); setResult(null); }}
                className="text-[10px] px-2 py-1 bg-red-900/30 border border-red-700/40 rounded-lg text-red-400">Fechar</button>
            </div>
          </div>

          {schema.length > 0 && (
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Tabelas</label>
              <div className="flex flex-wrap gap-1.5">
                {schema.map(t => (
                  <button key={t} onClick={() => { setSql(`SELECT * FROM "${t}" LIMIT 20;`); }}
                    className="px-2 py-1 bg-[#0d1309] border border-[#2d4a1e] rounded-lg text-[10px] text-gray-300 font-mono hover:border-green-500/40 hover:text-green-300"
                  >📋 {t}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">Consultas Rápidas</label>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_QUERIES.map(q => (
                <button key={q.label} onClick={() => { setSql(q.sql); setTimeout(runQuery, 50); }}
                  className="px-2 py-1.5 bg-[#0d0d0d] border border-gray-700/40 rounded-lg text-[10px] text-gray-300 hover:border-blue-500/40 hover:text-blue-300 text-left"
                >{q.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 block">SQL</label>
            <textarea
              value={sql}
              onChange={e => setSql(e.target.value)}
              rows={5}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery(); } }}
              className="w-full px-3 py-2.5 bg-[#0a0f07] border border-gray-700/50 rounded-xl text-[12px] font-mono text-gray-200 placeholder-gray-700 outline-none focus:border-blue-500/60 resize-none"
            />
            <button onClick={runQuery} disabled={loading} className="w-full mt-2 py-2.5 bg-blue-600/30 border border-blue-500/40 rounded-xl text-[12px] text-blue-300 font-bold hover:bg-blue-600/40 disabled:opacity-40">
              {loading ? "Executando..." : "▶ Executar (Ctrl+Enter)"}
            </button>
          </div>

          {result && <QueryResultTable result={result} />}
        </>
      )}
    </div>
  );
}

// ─── Aba Guias ────────────────────────────────────────────────────────────────

function GuiasTab() {
  const [guia, setGuia] = useState<"terminal" | "neon" | "railway" | "supabase" | "sqlite" | "mysql" | "local">("terminal");

  const guias = {
    terminal: {
      title: "⌨️ Terminal do PC — Conectar ao Banco",
      steps: [
        "Abra o Terminal no SK Editor (ícone 🖥️ na barra inferior)",
        "Instale as dependências do banco no seu projeto",
        "Crie o arquivo .env com sua URL de conexão",
        "Teste a conexão com o script abaixo",
        "Cole a URL também no campo 🗄️ para usar o painel visual",
      ],
      conn: "postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/banco?sslmode=require",
      code: "",
      env: "DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require",
    },
    neon: {
      title: "🐘 Neon — PostgreSQL Serverless",
      steps: ["Acesse neon.tech → Sign Up (grátis)", "Crie projeto → Nome → Região São Paulo", "Connection Details → copie a Connection string", "Cole no campo de conexão acima → Testar"],
      conn: "postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/banco?sslmode=require",
      code: `// Node.js com @neondatabase/serverless\nimport { neon } from '@neondatabase/serverless';\nconst sql = neon(process.env.DATABASE_URL);\n\n// Consulta\nconst users = await sql\`SELECT * FROM usuarios\`;\n\n// Com parâmetros\nconst id = 1;\nconst user = await sql\`SELECT * FROM usuarios WHERE id = \${id}\`;`,
      env: "DATABASE_URL=postgresql://user:senha@host/banco?sslmode=require"
    },
    railway: {
      title: "🚂 Railway — PostgreSQL Cloud",
      steps: ["Acesse railway.app → New Project", "Add a Service → Database → PostgreSQL", "Clique no serviço → Connect → copie DATABASE_URL", "Cole no campo de conexão acima"],
      conn: "postgresql://postgres:senha@containers-us-west-xxx.railway.app:6543/railway",
      code: `// Node.js com pg\nconst { Pool } = require('pg');\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });\n\nconst result = await pool.query('SELECT * FROM usuarios');\nconsole.log(result.rows);`,
      env: "DATABASE_URL=postgresql://postgres:senha@host:5432/railway"
    },
    supabase: {
      title: "⚡ Supabase — BaaS + PostgreSQL",
      steps: ["Acesse supabase.com → New Project", "Escolha senha do banco → criar", "Settings → Database → Connection string → URI", "Cole no campo de conexão acima"],
      conn: "postgresql://postgres:senha@db.xxxxxxxxxxxx.supabase.co:5432/postgres",
      code: `// Node.js com @supabase/supabase-js\nimport { createClient } from '@supabase/supabase-js';\nconst supabase = createClient(SUPABASE_URL, SUPABASE_KEY);\n\n// ORM nativo do Supabase\nconst { data } = await supabase.from('usuarios').select('*');\n\n// SQL direto\nconst { data } = await supabase.rpc('minha_funcao', { param: valor });`,
      env: "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..."
    },
    sqlite: {
      title: "🗃️ SQLite — Local sem servidor",
      steps: ["Não precisa de conta nem internet", "Use a aba SQLite Local acima", "Crie tabelas, insira dados, consulte", "Exporte como .db ou .sql para salvar"],
      conn: "./banco.db  (arquivo local)",
      code: `// Node.js com better-sqlite3\nconst Database = require('better-sqlite3');\nconst db = new Database('./banco.db');\n\n// Criar tabela\ndb.exec(\`CREATE TABLE IF NOT EXISTS usuarios (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  nome TEXT NOT NULL,\n  email TEXT UNIQUE\n)\`);\n\n// Inserir\ndb.prepare('INSERT INTO usuarios (nome, email) VALUES (?, ?)').run('João', 'joao@mail.com');\n\n// Consultar\nconst users = db.prepare('SELECT * FROM usuarios').all();`,
      env: "DB_PATH=./banco.db"
    },
    mysql: {
      title: "🐬 MySQL / PlanetScale",
      steps: ["PlanetScale: planetscale.com → New Database", "Ou use Railway com MySQL", "Connection string formato MySQL", "No app: npm install mysql2"],
      conn: "mysql://usuario:senha@host:3306/banco",
      code: `// Node.js com mysql2\nconst mysql = require('mysql2/promise');\nconst conn = await mysql.createConnection(process.env.DATABASE_URL);\n\nconst [rows] = await conn.execute('SELECT * FROM usuarios');\nconsole.log(rows);`,
      env: "DATABASE_URL=mysql://user:senha@host:3306/banco"
    },
    local: {
      title: "🖥️ PostgreSQL Local (PC)",
      steps: ["Instale PostgreSQL: postgresql.org/download", "Crie banco: createdb meubanco", "Crie usuário: createuser meuusuario -P", "Conecte: postgresql://meuusuario:senha@localhost/meubanco"],
      conn: "postgresql://usuario:senha@localhost:5432/meubanco",
      code: `// Node.js com pg\nconst { Pool } = require('pg');\nconst pool = new Pool({\n  host: 'localhost',\n  port: 5432,\n  database: 'meubanco',\n  user: 'meuusuario',\n  password: 'senha'\n});\n\nconst result = await pool.query('SELECT * FROM tabela');\nconsole.log(result.rows);`,
      env: "DB_HOST=localhost\nDB_PORT=5432\nDB_NAME=meubanco\nDB_USER=meuusuario\nDB_PASS=senha"
    }
  };

  const g = guias[guia];
  const isTerminal = guia === "terminal";

  const terminalBlocks: { label: string; caption: string; code: string }[] = [
    {
      label: "1️⃣ Instalar pacote do banco (no Terminal do SK Editor)",
      caption: "Cole no terminal e pressione Enter — instala o driver do PostgreSQL/Neon:",
      code: `# Para Neon / PostgreSQL Cloud (recomendado)\nnpm install @neondatabase/serverless\n\n# Para PostgreSQL padrão (pg)\nnpm install pg\n\n# Para SQLite local (Node.js)\nnpm install better-sqlite3\n\n# Para MySQL\nnpm install mysql2`,
    },
    {
      label: "2️⃣ Criar arquivo .env no projeto",
      caption: "Crie o arquivo .env na raiz do projeto com sua URL — nunca suba esse arquivo para o GitHub:",
      code: `# Neon / PostgreSQL Cloud\nDATABASE_URL=postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/banco?sslmode=require\n\n# PostgreSQL Local\nDATABASE_URL=postgresql://postgres:senha@localhost:5432/meubanco\n\n# MySQL\nDATABASE_URL=mysql://usuario:senha@host:3306/banco`,
    },
    {
      label: "3️⃣ Testar a conexão pelo Terminal",
      caption: "Crie o arquivo teste-db.js e rode no terminal para confirmar que conecta:",
      code: `// arquivo: teste-db.js\nrequire('dotenv').config();\nconst { Pool } = require('pg');\n\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL });\n\nasync function testar() {\n  try {\n    const res = await pool.query('SELECT NOW() AS agora, version() AS versao');\n    console.log('✅ CONECTADO!');\n    console.log('Data/hora:', res.rows[0].agora);\n    console.log('Versão:', res.rows[0].versao.split(' ')[0]);\n  } catch (err) {\n    console.error('❌ ERRO:', err.message);\n  } finally {\n    await pool.end();\n  }\n}\n\ntestar();`,
    },
    {
      label: "4️⃣ Rodar o teste no Terminal",
      caption: "Execute esses comandos no terminal do SK Editor, um de cada vez:",
      code: `# Instalar dotenv (lê o arquivo .env automaticamente)\nnpm install dotenv\n\n# Rodar o script de teste\nnode teste-db.js\n\n# Resultado esperado:\n# ✅ CONECTADO!\n# Data/hora: 2026-06-15T...\n# Versão: PostgreSQL`,
    },
    {
      label: "5️⃣ Usar psql no Terminal (cliente de linha de comando)",
      caption: "Se o psql estiver instalado no PC, conecte direto pelo terminal do SK Editor:",
      code: `# Conectar ao Neon via psql\npsql "postgresql://usuario:senha@host/banco?sslmode=require"\n\n# Comandos dentro do psql:\n\\dt              # lista todas as tabelas\n\\d nome_tabela   # descreve a tabela\n\\l               # lista bancos\n\\q               # sair do psql\n\n# Executar um arquivo .sql\npsql $DATABASE_URL -f schema.sql\npsql $DATABASE_URL -f migrations/001_inicial.sql`,
    },
    {
      label: "6️⃣ Criar tabelas pelo Terminal (executar .sql)",
      caption: "Crie um arquivo schema.sql e execute diretamente pelo terminal:",
      code: `# Criar arquivo schema.sql na raiz do projeto\n# (use a IA para gerar o SQL completo)\n\n# Executar o schema no banco via psql:\npsql $DATABASE_URL -f schema.sql\n\n# Ou via Node.js (sem psql instalado):\nconst fs = require('fs');\nconst sql = fs.readFileSync('./schema.sql', 'utf8');\nawait pool.query(sql);\nconsole.log('Schema criado!');`,
    },
    {
      label: "7️⃣ Variáveis de ambiente no Electron (PC)",
      caption: "No app Electron, o .env é lido da pasta onde o executável está. Crie o .env ao lado do .exe:",
      code: `# Windows: ao lado de MaikonJuridicoPro.exe\n# Linux: ao lado de MaikonJuridicoPro.AppImage\n# O arquivo .env deve conter:\n\nDATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require\n\n# No código Node.js do projeto:\nrequire('dotenv').config();\nconst url = process.env.DATABASE_URL;\n\n# Ou coloque a URL diretamente no painel 🗄️ do SK Editor\n# (ela fica salva no localStorage do app)`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(guias) as (keyof typeof guias)[]).map(k => (
          <button key={k} onClick={() => setGuia(k)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${guia === k ? "bg-green-600/30 text-green-300 border border-green-500/40" : "bg-[#0d1309] border border-[#2d4a1e] text-gray-500 hover:text-gray-300"}`}
          >{guias[k].title.split(" — ")[0]}</button>
        ))}
      </div>

      {/* ── Guia Terminal do PC ─────────────────────────────────────────────── */}
      {isTerminal ? (
        <div className="space-y-3">
          <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4">
            <p className="text-[13px] font-bold text-gray-200 mb-1">⌨️ Conectar ao Banco pelo Terminal do PC</p>
            <p className="text-[11px] text-gray-500 mb-3">
              No app Electron (PC), o ícone 🖥️ abre um terminal real do computador. Você pode instalar pacotes, rodar scripts Node.js e conectar ao banco diretamente por linha de comando.
            </p>
            <div className="flex items-start gap-2 bg-green-950/20 border border-green-700/30 rounded-lg p-2.5">
              <span className="text-green-400 text-base shrink-0">💡</span>
              <p className="text-[10px] text-green-300">
                <strong>Dica rápida:</strong> cole sua URL de conexão no campo 🗄️ (Banco de Dados) para usar o painel visual sem precisar de terminal. Use o terminal quando quiser rodar scripts, instalar pacotes ou usar o <span className="font-mono">psql</span>.
              </p>
            </div>
          </div>

          {terminalBlocks.map(block => (
            <div key={block.label} className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4 space-y-2">
              <p className="text-[12px] font-bold text-gray-200">{block.label}</p>
              <p className="text-[10px] text-gray-500">{block.caption}</p>
              <CodeBlock code={block.code} copyKey={block.label} />
            </div>
          ))}

          <div className="bg-blue-950/20 border border-blue-700/30 rounded-xl p-3">
            <p className="text-[11px] font-bold text-blue-300 mb-1">🤖 Peça para a IA fazer tudo</p>
            <p className="text-[10px] text-gray-400 mb-2">No chat da IA, diga exatamente isso:</p>
            <CodeBlock
              code={`"Conecte meu projeto ao banco de dados Neon.\nA DATABASE_URL está no arquivo .env.\nInstale as dependências, crie o arquivo de conexão db.js e um script para testar."`}
              copyKey="ai-terminal-tip"
            />
            <p className="text-[10px] text-gray-500 mt-1.5">A IA gera todos os arquivos e os comandos do terminal para você executar.</p>
          </div>
        </div>
      ) : (
        /* ── Guias normais ───────────────────────────────────────────────── */
        <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-4 space-y-3">
          <p className="text-[13px] font-bold text-gray-200">{g.title}</p>

          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Passo a Passo</p>
            <ol className="space-y-1.5">
              {g.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-gray-300">
                  <span className="w-5 h-5 bg-green-700/40 text-green-300 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0">{i+1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">String de Conexão</p>
            <CodeBlock code={g.conn} copyKey={`conn-${guia}`} />
          </div>

          {g.code && (
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Código de Exemplo (Node.js)</p>
              <CodeBlock code={g.code} copyKey={`code-${guia}`} />
            </div>
          )}

          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Variáveis de Ambiente (.env)</p>
            <CodeBlock code={g.env} copyKey={`env-${guia}`} />
          </div>
        </div>
      )}

      <div className="bg-amber-950/20 border border-amber-700/30 rounded-xl p-3">
        <p className="text-[11px] font-bold text-amber-300 mb-1">💡 Dica: Peça para a IA criar o schema</p>
        <p className="text-[10px] text-gray-400">No chat da IA, diga: "Crie um banco de dados PostgreSQL para [seu projeto] com as tabelas necessárias, incluindo o SQL completo."</p>
      </div>
    </div>
  );
}

// ─── Aba Credenciais ──────────────────────────────────────────────────────────

function CredenciaisTab({ activeConnection, onSelectConnection }: {
  activeConnection: string;
  onSelectConnection: (s: string) => void;
}) {
  const [connections, setConnections] = useState<SavedConnection[]>(() => loadSavedConnections());
  const [newLabel, setNewLabel] = useState("");
  const [newConn, setNewConn] = useState("");
  const [newType, setNewType] = useState<SavedConnection["type"]>("neon");
  const [showNew, setShowNew] = useState(false);

  const addConnection = useCallback(() => {
    if (!newLabel.trim() || !newConn.trim()) return;
    const updated = [...connections, { id: Date.now().toString(), label: newLabel.trim(), type: newType, connectionString: newConn.trim(), createdAt: Date.now() }];
    setConnections(updated); saveSavedConnections(updated);
    setNewLabel(""); setNewConn(""); setShowNew(false);
  }, [connections, newLabel, newConn, newType]);

  const removeConnection = useCallback((id: string) => {
    const updated = connections.filter(c => c.id !== id);
    setConnections(updated); saveSavedConnections(updated);
  }, [connections]);

  const DB_ICONS: Record<string, string> = { neon: "🐘", postgres: "🐘", mysql: "🐬", sqlite: "🗃️" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Conexões Salvas</p>
        <button onClick={() => setShowNew(v => !v)} className="flex items-center gap-1 px-2.5 py-1 bg-green-600/20 border border-green-500/40 rounded-lg text-[10px] text-green-300 font-bold hover:bg-green-600/30">
          <Plus size={11} /> Adicionar
        </button>
      </div>

      {showNew && (
        <div className="bg-[#0d1309] border border-[#2d4a1e] rounded-xl p-3 space-y-2">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nome (ex: Neon Jurídico)"
            className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700/50 rounded-lg text-[12px] text-gray-200 outline-none focus:border-green-500/60" />
          <select value={newType} onChange={e => setNewType(e.target.value as any)}
            className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700/50 rounded-lg text-[12px] text-gray-300 outline-none">
            <option value="neon">Neon (PostgreSQL Cloud)</option>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
            <option value="sqlite">SQLite</option>
          </select>
          <input value={newConn} onChange={e => setNewConn(e.target.value)} placeholder="postgresql://usuario:senha@host/banco"
            type="password"
            className="w-full px-3 py-2 bg-[#0d0d0d] border border-gray-700/50 rounded-lg text-[12px] font-mono text-gray-200 outline-none focus:border-green-500/60" />
          <div className="flex gap-2">
            <button onClick={addConnection} className="flex-1 py-2 bg-green-600/30 border border-green-500/40 rounded-lg text-[11px] text-green-300 font-bold">Salvar</button>
            <button onClick={() => setShowNew(false)} className="px-3 py-2 bg-gray-700/20 border border-gray-600/30 rounded-lg text-[11px] text-gray-400">Cancelar</button>
          </div>
        </div>
      )}

      {connections.length === 0 && !showNew && (
        <div className="flex flex-col items-center py-8 gap-2 text-gray-600">
          <Database size={28} />
          <p className="text-sm">Nenhuma conexão salva</p>
          <button onClick={() => setShowNew(true)} className="text-xs text-blue-400 underline">Adicionar primeira conexão</button>
        </div>
      )}

      <div className="space-y-2">
        {connections.map(c => (
          <div key={c.id} className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${activeConnection === c.connectionString ? "border-green-500/50 bg-green-950/20" : "border-[#2d4a1e] bg-[#0d1309] hover:border-gray-600/50"}`}>
            <span className="text-lg shrink-0">{DB_ICONS[c.type] || "🗄️"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-gray-200">{c.label}</p>
              <p className="text-[10px] text-gray-600 font-mono truncate">{c.connectionString.replace(/:([^@]+)@/, ":***@")}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => onSelectConnection(c.connectionString)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${activeConnection === c.connectionString ? "bg-green-600/30 text-green-300 border border-green-500/40" : "bg-gray-700/30 text-gray-400 border border-gray-600/30 hover:border-green-500/40 hover:text-green-300"}`}>
                {activeConnection === c.connectionString ? "✓ Ativa" : "Usar"}
              </button>
              <button onClick={() => removeConnection(c.id)} className="p-1 rounded-lg text-gray-700 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DatabasePanel({ onClose, connectionString, onUpdateConnection, onSendToAI }: DatabasePanelProps) {
  const [tab, setTab] = useState<"postgres" | "sqlite" | "guias" | "credenciais">("postgres");

  const TABS = [
    { id: "postgres", label: "🐘 PostgreSQL", icon: <Database size={13} /> },
    { id: "sqlite",   label: "🗃️ SQLite",    icon: <HardDrive size={13} /> },
    { id: "guias",    label: "📖 Guias",      icon: <BookOpen size={13} /> },
    { id: "credenciais", label: "⚙️ Credenciais", icon: <Settings2 size={13} /> },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[9999] pb-safe" onClick={e => e.stopPropagation()}>
        <div className="bg-[#1a2413] border-t border-gray-700/50 rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
          {/* Handle */}
          <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 bg-gray-600 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-700/40 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🗄️</span>
              <p className="text-[16px] font-bold text-white">Banco de Dados</p>
              {connectionString && <span className="text-[10px] text-green-400 bg-gray-800/30 border border-green-700/40 px-2 py-0.5 rounded-full font-bold">✓ Configurado</span>}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-gray-500"><X size={17} /></button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-4 py-2 border-b border-gray-700/30 shrink-0 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${tab === t.id ? "bg-green-600/30 text-green-300 border border-green-500/40" : "text-gray-500 hover:text-gray-300 border border-transparent"}`}
              >{t.icon} {t.label}</button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-10 space-y-4">
            {tab === "postgres" && (
              <NeonTab connectionString={connectionString} onUpdateConnection={onUpdateConnection} onSendToAI={onSendToAI} />
            )}
            {tab === "sqlite" && (
              <SQLiteTab onSendToAI={onSendToAI} />
            )}
            {tab === "guias" && <GuiasTab />}
            {tab === "credenciais" && (
              <CredenciaisTab activeConnection={connectionString} onSelectConnection={onUpdateConnection} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
