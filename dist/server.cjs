'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT || '8080', 10);

// ─── CORS ────────────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ─── Detectar provider pela chave ────────────────────────────────────────────
function detectProvider(key) {
  if (!key) return null;
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('pplx-')) return 'perplexity';
  if (key.startsWith('sk-')) return 'openai';
  return 'openai'; // fallback
}

// ─── Chamar APIs de IA ────────────────────────────────────────────────────────
async function callAI(provider, key, model, messages, maxTokens) {
  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: maxTokens || 8192,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content || undefined,
      }),
    });
    const d = await resp.json();
    if (d.error) throw new Error(d.error.message);
    return d.content?.[0]?.text || '';
  }

  if (provider === 'gemini') {
    const gModel = model || 'gemini-2.0-flash';
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: gModel, messages, max_tokens: maxTokens || 8192 }),
      }
    );
    const d = await resp.json();
    if (d.error) throw new Error(typeof d.error === 'string' ? d.error : d.error.message);
    return d.choices?.[0]?.message?.content || '';
  }

  if (provider === 'groq') {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: model || 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens || 8192 }),
    });
    const d = await resp.json();
    if (d.error) throw new Error(d.error.message);
    return d.choices?.[0]?.message?.content || '';
  }

  // OpenAI / compatível
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model: model || 'gpt-4o', messages, max_tokens: Math.min(maxTokens || 4096, 4096) }),
  });
  const d = await resp.json();
  if (d.error) throw new Error(d.error.message);
  return d.choices?.[0]?.message?.content || '';
}

// ─── Processos em execução (terminal) ─────────────────────────────────────────
const runningProcs = new Map(); // id -> ChildProcess

// ─── Servidor HTTP ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);
  const urlPath = req.url?.split('?')[0] || '/';

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Health check
  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: 'SK-Editor v3 (local)' }));
    return;
  }

  // ── Chat com IA
  if (urlPath === '/api/chat' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const { system, messages, apiKey, model, maxTokens } = body;

      const key = apiKey || process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '';
      if (!key) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Chave de API não configurada. Configure nas Configurações do app.' }));
        return;
      }

      const provider = detectProvider(key);
      const allMessages = [];
      if (system) allMessages.push({ role: 'system', content: system });
      for (const m of (messages || [])) allMessages.push({ role: m.role, content: m.content });

      const reply = await callAI(provider, key, model, allMessages, maxTokens);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: reply, provider }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Terminal: executar comando com SSE streaming
  if (urlPath === '/api/exec-stream' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const { command, cwd } = JSON.parse(raw);

      const workDir = cwd || process.cwd();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendEvt = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
      };

      sendEvt('info', `$ ${command}`);

      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd.exe' : '/bin/sh';
      const shellFlag = isWin ? '/c' : '-c';
      const proc = spawn(shell, [shellFlag, command], {
        cwd: workDir,
        env: { ...process.env },
        stdio: 'pipe',
      });

      const procId = Date.now().toString();
      runningProcs.set(procId, proc);
      sendEvt('pid', procId);

      proc.stdout.on('data', d => sendEvt('stdout', d.toString()));
      proc.stderr.on('data', d => sendEvt('stderr', d.toString()));
      proc.on('close', code => {
        runningProcs.delete(procId);
        sendEvt('exit', code ?? 0);
        res.end();
      });
      proc.on('error', err => {
        sendEvt('error', err.message);
        res.end();
      });

      req.on('close', () => {
        if (!proc.killed) proc.kill();
        runningProcs.delete(procId);
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Terminal: parar processo
  if (urlPath === '/api/exec-stop' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const { pid } = JSON.parse(raw);
      const proc = runningProcs.get(pid);
      if (proc && !proc.killed) proc.kill();
      runningProcs.delete(pid);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SK-Editor API rodando em http://localhost:${PORT}`);
  console.log('Endpoints: /api/health /api/chat /api/exec-stream /api/exec-stop');
});
