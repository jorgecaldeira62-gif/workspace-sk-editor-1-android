'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const DIST = path.join(__dirname, '..', 'dist', 'public');
const PROJECTS_DIR = path.join(os.homedir(), 'SKEditorV3', 'projetos');
const SETTINGS_FILE = path.join(os.homedir(), 'SKEditorV3', 'settings.json');

// Processos de servidor em execução (npm run dev, etc.)
const runningServers = new Map(); // projectKey -> { proc, port, command }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.map': 'application/json',
  '.wasm': 'application/wasm', '.zip': 'application/zip',
};

// ─── Detecção de porta nos logs do servidor ───────────────────────────────────
const PORT_PATTERNS = [
  /localhost:(\d{4,5})/i, /127\.0\.0\.1:(\d{4,5})/i,
  /0\.0\.0\.0:(\d{4,5})/i, /\bport[:\s]+(\d{4,5})/i,
  /listening.*?:(\d{4,5})/i, /started.*?:(\d{4,5})/i,
  /running.*?:(\d{4,5})/i, /ready.*?:(\d{4,5})/i,
  /Local:\s+https?:\/\/[^:]+:(\d{4,5})/i,
  /:(\d{4,5})\b/,
];

function detectPort(text) {
  for (const p of PORT_PATTERNS) {
    const m = text.match(p);
    if (m) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) return port;
    }
  }
  return null;
}

// ─── Proxy HTTP para servidor do usuário ─────────────────────────────────────
function proxyRequest(req, res, targetPort, targetPath) {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: targetPath || '/',
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Remove headers que bloqueiam iframe
    const headers = { ...proxyRes.headers };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    headers['access-control-allow-origin'] = '*';

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(`Servidor não está rodando na porta ${targetPort}. Erro: ${err.message}`);
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

// ─── Servidor HTTP local (estático + API) ────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rawUrl = req.url || '/';
      const url = rawUrl.split('?')[0];

      // Sempre adicionar COOP/COEP (necessário pro WebContainer)
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // ── /api/proxy/:port/* — proxy para servidor do usuário ───────────────
      const proxyMatch = url.match(/^\/api\/proxy\/(\d+)(\/.*)?$/);
      if (proxyMatch) {
        const targetPort = parseInt(proxyMatch[1], 10);
        const targetPath = proxyMatch[2] || '/';
        proxyRequest(req, res, targetPort, targetPath);
        return;
      }

      // ── /api/exec-stream — executa comando com SSE streaming ─────────────
      if (url === '/api/exec-stream' && req.method === 'POST') {
        let body = '';
        req.on('data', d => { body += d; });
        req.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(body); } catch {
            res.writeHead(400); res.end('JSON inválido'); return;
          }

          const { command, cwd: cwdParam, projectKey } = parsed;
          if (!command) { res.writeHead(400); res.end('command obrigatório'); return; }

          const cwd = cwdParam || os.homedir();

          // SSE headers
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.writeHead(200);

          const send = (type, data) => {
            try { res.write(`data: ${JSON.stringify({ type, data })}\n\n`); } catch {}
          };

          // Normaliza comandos
          const normalized = command
            .replace(/^pip\s+/, 'pip3 ')
            .replace(/^python\s+/, 'python3 ');

          const isInstall = /^(npm\s+install|yarn\s+install|pnpm\s+install|pip3\s+install)/.test(normalized.trim());
          const maxTimeout = isInstall ? 600000 : 120000;

          const extraPaths = ['/usr/local/bin', '/usr/bin', '/bin', path.join(os.homedir(), '.local', 'bin')];
          const PATH = [...new Set([...(process.env.PATH || '').split(':'), ...extraPaths])].join(':');

          const proc = spawn('sh', ['-c', normalized], {
            cwd,
            env: { ...process.env, PATH, TERM: 'xterm-256color', NPM_CONFIG_UPDATE_NOTIFIER: 'false' },
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          let detectedPort = null;
          let clientDisconnected = false;

          const handleData = (chunk) => {
            const text = chunk.toString('utf8');
            send('stdout', text);

            // Detecta porta para abrir preview
            if (detectedPort === null) {
              const port = detectPort(text);
              if (port) {
                detectedPort = port;
                send('server_detected', { port });

                // Guarda processo como servidor em execução
                if (projectKey) {
                  const old = runningServers.get(projectKey);
                  if (old) { try { old.proc.kill('SIGTERM'); } catch {} }
                  runningServers.set(projectKey, { proc, port, command: normalized });
                }
              }
            }

            // Auto-responde perguntas interativas
            const autoReply = [
              /port.*in use.*use.*instead/i, /\?\s*(y\/n|\[y\/n\])/i,
              /Would you like/i, /\(Y\/n\)/i,
            ];
            if (autoReply.some(p => p.test(text))) {
              try { proc.stdin.write('y\n'); } catch {}
              send('stdout', '\n[auto] Respondendo "y" automaticamente.\n');
            }
          };

          proc.stdout.on('data', handleData);
          proc.stderr.on('data', (chunk) => {
            const text = chunk.toString('utf8');
            send('stderr', text);
            if (detectedPort === null) {
              const port = detectPort(text);
              if (port) { detectedPort = port; send('server_detected', { port }); }
            }
          });

          proc.on('error', (err) => send('stderr', `\nErro: ${err.message}\n`));

          proc.on('close', (code) => {
            if (detectedPort === null) {
              send('exit', { exitCode: code ?? 0 });
              if (!clientDisconnected) res.end();
            } else {
              send('server_stopped', { exitCode: code ?? 0 });
              if (!clientDisconnected) res.end();
            }
          });

          const timer = setTimeout(() => {
            if (detectedPort === null) {
              try { proc.kill('SIGTERM'); } catch {}
            }
          }, maxTimeout);

          proc.on('close', () => clearTimeout(timer));

          req.on('close', () => {
            clientDisconnected = true;
            if (detectedPort === null) {
              try { proc.kill('SIGTERM'); } catch {}
              clearTimeout(timer);
            }
          });
        });
        return;
      }

      // ── /api/exec-stop — para servidor em execução ───────────────────────
      if (url === '/api/exec-stop' && req.method === 'POST') {
        let body = '';
        req.on('data', d => { body += d; });
        req.on('end', () => {
          try {
            const { projectKey } = JSON.parse(body);
            const srv = runningServers.get(projectKey);
            if (srv) {
              try { srv.proc.kill('SIGTERM'); } catch {}
              runningServers.delete(projectKey);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'Servidor não encontrado' }));
            }
          } catch {
            res.writeHead(400); res.end('JSON inválido');
          }
        });
        return;
      }

      // ── /api/settings GET/POST — persiste configurações no disco ─────────
      if (url === '/api/settings') {
        if (req.method === 'GET') {
          fsp.readFile(SETTINGS_FILE, 'utf8')
            .then(raw => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(raw);
            })
            .catch(() => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end('{}');
            });
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', d => { body += d; });
          req.on('end', async () => {
            try {
              const dir = path.dirname(SETTINGS_FILE);
              await fsp.mkdir(dir, { recursive: true });
              await fsp.writeFile(SETTINGS_FILE, body, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end('{"ok":true}');
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: e.message }));
            }
          });
          return;
        }
      }

      // ── /api/running-servers — lista servidores em execução ──────────────
      if (url === '/api/running-servers' && req.method === 'GET') {
        const list = [];
        runningServers.forEach((v, k) => {
          list.push({ projectKey: k, port: v.port, command: v.command });
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(list));
        return;
      }

      // ── Arquivos estáticos (app React) ───────────────────────────────────
      let filePath = path.join(DIST, url === '/' ? 'index.html' : url);

      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          filePath = path.join(DIST, 'index.html');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else {
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'max-age=3600');
        }
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => { res.statusCode = 404; res.end('Not found'); });
        stream.pipe(res);
      });
    });

    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

// ─── Terminal Real via IPC (sem timeout) ────────────────────────────────────
const sessions = new Map();
let sessionCounter = 0;

function getShell() {
  if (process.platform === 'win32') {
    return { cmd: process.env.ComSpec || 'cmd.exe', args: [] };
  }
  const sh = process.env.SHELL || '/bin/bash';
  return { cmd: sh, args: ['--norc', '--noprofile'] };
}

ipcMain.handle('terminal:spawn', (event) => {
  const id = ++sessionCounter;
  const { cmd, args } = getShell();

  const proc = spawn(cmd, args, {
    cwd: os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  sessions.set(id, proc);

  const send = (data) => {
    try { event.sender.send(`terminal:data:${id}`, data); } catch {}
  };

  proc.stdout.on('data', d => send(d.toString('utf8')));
  proc.stderr.on('data', d => send(d.toString('utf8')));

  proc.on('exit', (code) => {
    try { event.sender.send(`terminal:exit:${id}`, code ?? 0); } catch {}
    sessions.delete(id);
  });

  proc.on('error', (err) => {
    send(`\r\n[Erro ao iniciar shell: ${err.message}]\r\n`);
    sessions.delete(id);
  });

  return { id, shell: cmd, home: os.homedir(), platform: process.platform };
});

ipcMain.on('terminal:write', (_event, { id, data }) => {
  const proc = sessions.get(id);
  if (proc && proc.stdin.writable) proc.stdin.write(data);
});

ipcMain.on('terminal:kill', (_event, { id }) => {
  const proc = sessions.get(id);
  if (proc) { try { proc.kill('SIGTERM'); } catch {} }
  sessions.delete(id);
});

ipcMain.handle('terminal:info', () => ({
  platform: process.platform,
  home: os.homedir(),
  shell: getShell().cmd,
  arch: process.arch,
  nodeVersion: process.version,
  projectsDir: PROJECTS_DIR,
}));

// ─── Filesystem — Projetos no disco do PC ───────────────────────────────────

async function ensureProjectsDir() {
  try { await fsp.mkdir(PROJECTS_DIR, { recursive: true }); } catch {}
}

ipcMain.handle('fs:saveProject', async (_event, { name, files }) => {
  await ensureProjectsDir();
  const safe = name.replace(/[^a-zA-Z0-9_\-\.áéíóúâêîôûãõàèìòùçÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ ]/g, '_').slice(0, 80);
  const file = path.join(PROJECTS_DIR, `${safe}.mjp.json`);
  const data = JSON.stringify({ name, files, updatedAt: Date.now() }, null, 2);
  await fsp.writeFile(file, data, 'utf8');
  return { ok: true, path: file };
});

ipcMain.handle('fs:loadProject', async (_event, { name }) => {
  await ensureProjectsDir();
  const safe = name.replace(/[^a-zA-Z0-9_\-\.áéíóúâêîôûãõàèìòùçÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ ]/g, '_').slice(0, 80);
  const file = path.join(PROJECTS_DIR, `${safe}.mjp.json`);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:listProjects', async () => {
  await ensureProjectsDir();
  try {
    const entries = await fsp.readdir(PROJECTS_DIR);
    const projects = [];
    for (const entry of entries) {
      if (!entry.endsWith('.mjp.json')) continue;
      try {
        const raw = await fsp.readFile(path.join(PROJECTS_DIR, entry), 'utf8');
        const parsed = JSON.parse(raw);
        projects.push({
          name: parsed.name,
          updatedAt: parsed.updatedAt,
          fileCount: Object.keys(parsed.files || {}).length,
          filePath: path.join(PROJECTS_DIR, entry),
        });
      } catch {}
    }
    return { ok: true, projects: projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) };
  } catch (e) {
    return { ok: false, projects: [], error: e.message };
  }
});

ipcMain.handle('fs:deleteProject', async (_event, { name }) => {
  const safe = name.replace(/[^a-zA-Z0-9_\-\.áéíóúâêîôûãõàèìòùçÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙÇ ]/g, '_').slice(0, 80);
  const file = path.join(PROJECTS_DIR, `${safe}.mjp.json`);
  try { await fsp.unlink(file); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('fs:exportZip', async (event, { name, files, platform }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const defaultName = `${name.replace(/[^a-zA-Z0-9_\-]/g, '_')}-${platform || 'deploy'}.zip`;
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Salvar ZIP de Deploy',
    defaultPath: path.join(os.homedir(), 'Desktop', defaultName),
    filters: [{ name: 'Arquivo ZIP', extensions: ['zip'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    const zipData = Buffer.from(files, 'base64');
    await fsp.writeFile(filePath, zipData);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message }; }
});

ipcMain.handle('fs:openProjectsDir', async () => {
  await ensureProjectsDir();
  shell.openPath(PROJECTS_DIR);
  return { ok: true, path: PROJECTS_DIR };
});

ipcMain.handle('fs:openPath', async (_event, { filePath: fp }) => {
  shell.openPath(fp);
  return { ok: true };
});

ipcMain.handle('fs:revealInExplorer', async (_event, { filePath: fp }) => {
  shell.showItemInFolder(fp);
  return { ok: true };
});

// ─── Janela principal ────────────────────────────────────────────────────────
let mainWindow = null;

async function createWindow() {
  const port = await startServer();
  await ensureProjectsDir();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'SK Editor v3 — Sem Replit',
    icon: path.join(__dirname, '..', 'public', 'icon-512.png'),
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    // Para todos os servidores em execução
    runningServers.forEach((srv) => { try { srv.proc.kill('SIGTERM'); } catch {} });
    runningServers.clear();
    sessions.forEach((proc) => { try { proc.kill(); } catch {} });
    sessions.clear();
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
