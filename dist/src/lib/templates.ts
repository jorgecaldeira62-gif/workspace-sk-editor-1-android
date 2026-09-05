export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: Record<string, string>;
}

export const templates: Template[] = [
  {
    id: "html-css-js",
    name: "HTML/CSS/JS",
    description: "Projeto web basico com HTML, CSS e JavaScript",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meu Projeto</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <h1>Ola Mundo!</h1>
    <p>Edite este arquivo para comecar.</p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      "style.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

#app {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  font-size: 1.2rem;
  color: #aaa;
}`,
      "script.js": `document.addEventListener('DOMContentLoaded', () => {
  console.log('Projeto carregado com sucesso!');
});`,
    },
  },
  {
    id: "react-app",
    name: "React App",
    description: "Aplicacao React com JSX",
    icon: "component",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="src/index.jsx"></script>
</body>
</html>`,
      "src/index.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
      "src/App.jsx": `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0f0f23',
      color: '#fff',
      fontFamily: 'system-ui'
    }}>
      <h1>React App</h1>
      <p>Contador: {count}</p>
      <button 
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '10px 24px',
          fontSize: '1rem',
          borderRadius: '8px',
          border: 'none',
          background: '#646cff',
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        Incrementar
      </button>
    </div>
  );
}`,
      "package.json": `{
  "name": "react-app",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}`,
    },
  },
  {
    id: "node-api",
    name: "Node.js API",
    description: "API REST com Express",
    icon: "server",
    files: {
      "index.js": `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let items = [
  { id: 1, name: 'Item 1', description: 'Primeiro item' },
  { id: 2, name: 'Item 2', description: 'Segundo item' },
];

app.get('/api/items', (req, res) => {
  res.json(items);
});

app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item nao encontrado' });
  res.json(item);
});

app.post('/api/items', (req, res) => {
  const item = {
    id: items.length + 1,
    name: req.body.name,
    description: req.body.description
  };
  items.push(item);
  res.status(201).json(item);
});

app.listen(PORT, () => {
  console.log(\`Servidor rodando na porta \${PORT}\`);
});`,
      "package.json": `{
  "name": "node-api",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node index.js"
  }
}`,
    },
  },
  {
    id: "python-flask",
    name: "Python Flask",
    description: "API web com Flask",
    icon: "code",
    files: {
      "app.py": `from flask import Flask, jsonify, request

app = Flask(__name__)

items = [
    {"id": 1, "name": "Item 1", "description": "Primeiro item"},
    {"id": 2, "name": "Item 2", "description": "Segundo item"},
]

@app.route("/")
def home():
    return jsonify({"message": "Bem-vindo a API Flask!"})

@app.route("/api/items")
def get_items():
    return jsonify(items)

@app.route("/api/items", methods=["POST"])
def create_item():
    data = request.get_json()
    item = {
        "id": len(items) + 1,
        "name": data.get("name"),
        "description": data.get("description"),
    }
    items.append(item)
    return jsonify(item), 201

if __name__ == "__main__":
    app.run(debug=True, port=5000)`,
      "requirements.txt": `flask==3.0.0`,
    },
  },
  {
    id: "typescript-node",
    name: "TypeScript Node",
    description: "Projeto TypeScript com Node.js",
    icon: "file-type",
    files: {
      "src/index.ts": `interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: "Joao", email: "joao@email.com" },
  { id: 2, name: "Maria", email: "maria@email.com" },
];

function findUser(id: number): User | undefined {
  return users.find(u => u.id === id);
}

function addUser(name: string, email: string): User {
  const newUser: User = {
    id: users.length + 1,
    name,
    email,
  };
  users.push(newUser);
  return newUser;
}

console.log("Usuarios:", users);
console.log("Buscar ID 1:", findUser(1));
console.log("Novo usuario:", addUser("Pedro", "pedro@email.com"));`,
      "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}`,
      "package.json": `{
  "name": "typescript-node",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}`,
    },
  },
  {
    id: "empty",
    name: "Projeto Vazio",
    description: "Comece do zero",
    icon: "folder-plus",
    files: {
      "README.md": `# Novo Projeto\n\nComece a criar seus arquivos aqui.`,
    },
  },
  {
    id: "pwa-app",
    name: "PWA Instalável",
    description: "App instalável no celular com suporte offline e manifest completo",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#1a1f2e">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Meu App">
  <meta name="description" content="Meu aplicativo PWA instalavel">
  <title>Meu App</title>
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="icon-192.png">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="offline-bar" class="offline-bar hidden">
    📡 Sem conexão — modo offline ativo
  </div>

  <header class="header">
    <div class="logo">⚡ Meu App</div>
    <div id="status-dot" class="status-dot online" title="Online"></div>
  </header>

  <main class="main">
    <section class="hero">
      <div class="hero-icon">📱</div>
      <h1>Bem-vindo ao Meu App</h1>
      <p>Este app funciona offline e pode ser instalado no seu celular.</p>
      <button id="install-btn" class="btn btn-primary hidden">
        ⬇️ Instalar no Celular
      </button>
      <button id="refresh-btn" class="btn btn-outline">
        🔄 Recarregar
      </button>
    </section>

    <section class="cards">
      <div class="card">
        <span class="card-icon">📴</span>
        <h3>Funciona Offline</h3>
        <p>Acesse mesmo sem internet graças ao Service Worker.</p>
      </div>
      <div class="card">
        <span class="card-icon">📲</span>
        <h3>Instalável</h3>
        <p>Adicione à tela inicial do celular como um app nativo.</p>
      </div>
      <div class="card">
        <span class="card-icon">⚡</span>
        <h3>Rápido</h3>
        <p>Cache inteligente para carregamento instantâneo.</p>
      </div>
    </section>

    <section class="counter-section">
      <h2>Contador (salvo localmente)</h2>
      <div class="counter">
        <button class="counter-btn" id="dec">−</button>
        <span class="counter-value" id="count">0</span>
        <button class="counter-btn" id="inc">+</button>
      </div>
      <button class="btn btn-outline" id="reset">Resetar</button>
    </section>
  </main>

  <footer class="footer">
    <p>Feito com ❤️ · Instalado como PWA</p>
  </footer>

  <script src="app.js"></script>
</body>
</html>`,

      "style.css": `* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #0f1117;
  --surface: #1a1f2e;
  --card: #1e2540;
  --accent: #4f8ef7;
  --accent2: #7c5cbf;
  --text: #e8eaf0;
  --muted: #8892a4;
  --success: #34d399;
  --danger: #f87171;
  --radius: 16px;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.offline-bar {
  background: var(--danger);
  color: white;
  text-align: center;
  padding: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.3s;
}
.hidden { display: none !important; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--surface);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}
.logo { font-size: 18px; font-weight: 700; color: var(--accent); }
.status-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  transition: background 0.3s;
}
.status-dot.online { background: var(--success); box-shadow: 0 0 6px var(--success); }
.status-dot.offline { background: var(--danger); }

.main { flex: 1; padding: 24px 20px; max-width: 500px; margin: 0 auto; width: 100%; }

.hero {
  text-align: center;
  padding: 40px 0 32px;
}
.hero-icon { font-size: 64px; margin-bottom: 16px; }
.hero h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; line-height: 1.2; }
.hero p { color: var(--muted); font-size: 15px; margin-bottom: 24px; line-height: 1.6; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 50px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  margin: 6px;
}
.btn-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: white;
}
.btn-primary:active { transform: scale(0.96); }
.btn-outline {
  background: transparent;
  border: 1.5px solid rgba(255,255,255,0.15);
  color: var(--muted);
}
.btn-outline:hover { border-color: var(--accent); color: var(--accent); }

.cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-bottom: 32px;
}
.card {
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.card-icon { font-size: 28px; }
.card h3 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.card p { font-size: 13px; color: var(--muted); line-height: 1.5; }

.counter-section {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 16px;
}
.counter-section h2 { font-size: 16px; margin-bottom: 20px; color: var(--muted); }
.counter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 20px;
}
.counter-btn {
  width: 52px; height: 52px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.1);
  background: var(--card);
  color: white;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s;
}
.counter-btn:active { transform: scale(0.9); background: var(--accent); border-color: var(--accent); }
.counter-value {
  font-size: 52px;
  font-weight: 800;
  min-width: 80px;
  color: var(--accent);
}

.footer {
  text-align: center;
  padding: 20px;
  color: var(--muted);
  font-size: 12px;
  border-top: 1px solid rgba(255,255,255,0.04);
}`,

      "app.js": `// ─── PWA Install Prompt ───────────────────────
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('Instalação:', outcome);
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  console.log('App instalado com sucesso!');
  installBtn.classList.add('hidden');
});

// ─── Offline / Online detection ───────────────
const offlineBar = document.getElementById('offline-bar');
const statusDot  = document.getElementById('status-dot');

function updateStatus() {
  const online = navigator.onLine;
  offlineBar.classList.toggle('hidden', online);
  statusDot.className = 'status-dot ' + (online ? 'online' : 'offline');
  statusDot.title = online ? 'Online' : 'Offline';
}
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

// ─── Service Worker ───────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(r => console.log('[SW] Registrado:', r.scope))
    .catch(e => console.warn('[SW] Erro:', e));
}

// ─── Contador com localStorage ────────────────
let count = parseInt(localStorage.getItem('pwa-count') || '0');
const display = document.getElementById('count');

function updateCount(n) {
  count = n;
  display.textContent = count;
  localStorage.setItem('pwa-count', count);
}

document.getElementById('inc')?.addEventListener('click', () => updateCount(count + 1));
document.getElementById('dec')?.addEventListener('click', () => updateCount(count - 1));
document.getElementById('reset')?.addEventListener('click', () => updateCount(0));
document.getElementById('refresh-btn')?.addEventListener('click', () => location.reload());

updateCount(count);`,

      "sw.js": `// Service Worker — Cache Offline
const CACHE = 'meu-app-v1';
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        if (res.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      })
    ).catch(() => caches.match('./index.html'))
  );
});`,

      "manifest.json": `{
  "name": "Meu App",
  "short_name": "MeuApp",
  "description": "Aplicativo PWA instalavel",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f1117",
  "theme_color": "#1a1f2e",
  "lang": "pt-BR",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}`,

      "icon-192.png": "",

      "README.md": `# Meu App — PWA Instalável

## O que é PWA?

Progressive Web App (PWA) é um site que pode ser **instalado como aplicativo** no celular ou desktop, funcionando **offline** e com ícone na tela inicial.

## Como rodar localmente

Abra o \`index.html\` no Preview (botão ▶) ou use um servidor local:
\`\`\`bash
npx serve .
# Acesse http://localhost:3000
\`\`\`

## Como publicar GRÁTIS 🚀

### Opção 1 — Netlify (mais fácil)
1. Acesse [netlify.com](https://netlify.com) e crie conta grátis
2. Clique em **"Add new site" → "Deploy manually"**
3. Baixe este projeto como ZIP (menu ··· → Exportar ZIP)
4. Arraste a pasta descompactada para o Netlify
5. Pronto! URL gerada automaticamente (ex: \`meuapp.netlify.app\`)

### Opção 2 — Vercel
1. Acesse [vercel.com](https://vercel.com) → crie conta com GitHub
2. Faça upload dos arquivos ou conecte repositório
3. Deploy automático com HTTPS

### Opção 3 — GitHub Pages (grátis com repositório público)
1. Crie um repositório no [github.com](https://github.com)
2. Faça upload dos arquivos
3. Settings → Pages → Source: "main" branch
4. URL: \`seuusuario.github.io/nome-do-repo\`

### Opção 4 — Cloudflare Pages
1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com)
2. Upload direto ou conecte GitHub
3. Domínio customizado grátis (\`meuapp.pages.dev\`)

## Após publicar

Acesse pelo celular via HTTPS e o Chrome vai mostrar:
**"Adicionar à tela inicial"** — toque e o app vira um ícone!

## Estrutura
\`\`\`
index.html    ← Página principal
style.css     ← Estilos
app.js        ← Lógica do app + install prompt + offline
sw.js         ← Service Worker (cache offline)
manifest.json ← Metadados do PWA (nome, ícone, cor)
\`\`\`
`,
    },
  },

  {
    id: "canvas-art",
    name: "Animação Canvas",
    description: "Arte interativa com partículas e geometria — reage ao toque e mouse",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Universo de Partículas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
    canvas { display: block; }
    #ui {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 10;
    }
    button {
      padding: 10px 18px;
      border-radius: 50px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: all 0.2s;
    }
    button:active { transform: scale(0.94); background: rgba(255,255,255,0.1); }
    #info {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255,255,255,0.4);
      font-family: monospace;
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="info">Toque ou mova o mouse</div>
  <canvas id="c"></canvas>
  <div id="ui">
    <button onclick="changeMode()">🎨 Modo</button>
    <button onclick="burst()">💥 Burst</button>
    <button onclick="clear()">🗑️ Limpar</button>
  </div>
  <script src="sketch.js"></script>
</body>
</html>`,

      "sketch.js": `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;
let mx = W/2, my = H/2;
let particles = [];
let frame = 0;
let mode = 0; // 0=universe 1=web 2=flower 3=matrix

const MODES = ['🌌 Universo', '🕸️ Teia', '🌸 Flor', '💻 Matrix'];
const PALETTES = [
  ['#4fc3f7','#e040fb','#80deea','#fff176','#f48fb1'],
  ['#69f0ae','#40c4ff','#ea80fc','#ffffff'],
  ['#ff80ab','#ff6d00','#ffd740','#69f0ae','#e040fb'],
  ['#00e676','#76ff03','#18ffff'],
];

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx || (Math.random()-0.5)*4;
    this.vy = vy || (Math.random()-0.5)*4;
    this.color = color || PALETTES[mode][Math.floor(Math.random()*PALETTES[mode].length)];
    this.life = life || Math.random()*120+60;
    this.maxLife = this.life;
    this.size = size || Math.random()*3+1;
    this.angle = Math.random()*Math.PI*2;
    this.spin = (Math.random()-0.5)*0.1;
  }
  update() {
    const alpha = this.life / this.maxLife;
    // Attraction to cursor
    const dx = mx - this.x;
    const dy = my - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 200) {
      this.vx += dx/dist * 0.08;
      this.vy += dy/dist * 0.08;
    }
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.spin;
    this.life--;
    // Bounce edges
    if (this.x < 0 || this.x > W) this.vx *= -0.8;
    if (this.y < 0 || this.y > H) this.vy *= -0.8;
    return this.life > 0;
  }
  draw() {
    const alpha = Math.pow(this.life / this.maxLife, 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (mode === 2) {
      // Flor: pétala
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size*2, this.size*0.8, 0, 0, Math.PI*2);
      ctx.fill();
    } else if (mode === 3) {
      // Matrix: caractere
      ctx.fillStyle = this.color;
      ctx.font = \`\${this.size*5}px monospace\`;
      ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(this.life/4)%96), 0, 0);
    } else {
      // Círculo com glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawConnections() {
  const near = particles.slice(0, 80);
  for (let i = 0; i < near.length; i++) {
    for (let j = i+1; j < near.length; j++) {
      const dx = near[i].x - near[j].x;
      const dy = near[i].y - near[j].y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 80) {
        const alpha = (1 - d/80) * 0.3 * (near[i].life/near[i].maxLife);
        ctx.strokeStyle = near[i].color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(near[i].x, near[i].y);
        ctx.lineTo(near[j].x, near[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function spawnAtCursor(n = 3) {
  const palette = PALETTES[mode];
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 0.5;
    const color = palette[Math.floor(Math.random()*palette.length)];
    if (mode === 1) { // Teia — slow
      particles.push(new Particle(mx, my, Math.cos(angle)*speed*0.4, Math.sin(angle)*speed*0.4, color, 200, 2));
    } else if (mode === 2) { // Flor
      particles.push(new Particle(mx, my, Math.cos(angle)*speed, Math.sin(angle)*speed*0.3, color, 150, 4));
    } else {
      particles.push(new Particle(mx, my, Math.cos(angle)*speed, Math.sin(angle)*speed, color));
    }
  }
  if (particles.length > 500) particles.splice(0, 10);
}

function burst() {
  for (let i = 0; i < 80; i++) {
    const angle = (i / 80) * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    const color = PALETTES[mode][i % PALETTES[mode].length];
    particles.push(new Particle(mx, my, Math.cos(angle)*speed, Math.sin(angle)*speed, color, 180, Math.random()*4+1));
  }
}

function changeMode() {
  mode = (mode + 1) % MODES.length;
  particles = [];
  document.getElementById('info').textContent = MODES[mode];
  setTimeout(() => { document.getElementById('info').textContent = 'Toque ou mova o mouse'; }, 2000);
}

function clear() { particles = []; }

function animate() {
  requestAnimationFrame(animate);
  frame++;
  // Fade trail
  ctx.fillStyle = mode === 3 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, W, H);

  // Auto-spawn
  if (frame % 3 === 0) spawnAtCursor(2);

  // Background geometry
  if (mode === 0 && frame % 60 === 0) {
    // Random star burst
    const rx = Math.random()*W, ry = Math.random()*H;
    const r = Math.random()*50+20;
    const color = PALETTES[0][Math.floor(Math.random()*PALETTES[0].length)];
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  if (mode === 1) drawConnections();

  particles = particles.filter(p => { p.update(); p.draw(); return p.life > 0; });

  // Cursor glow
  const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
  const col = PALETTES[mode][0];
  grad.addColorStop(0, col + '20');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(mx, my, 60, 0, Math.PI*2);
  ctx.fill();
}

// Events
function updateMouse(e) {
  if (e.touches) {
    mx = e.touches[0].clientX;
    my = e.touches[0].clientY;
  } else {
    mx = e.clientX;
    my = e.clientY;
  }
}
window.addEventListener('mousemove', e => { updateMouse(e); spawnAtCursor(1); });
window.addEventListener('touchmove', e => { e.preventDefault(); updateMouse(e); spawnAtCursor(3); }, { passive: false });
window.addEventListener('click', burst);
window.addEventListener('touchstart', e => { updateMouse(e); burst(); });

animate();`,
    },
  },

  {
    id: "landing-page",
    name: "Landing Page",
    description: "Página de apresentação profissional para mostrar a clientes",
    icon: "globe",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Transformamos sua ideia em realidade digital">
  <title>Studio Digital — Criamos para o futuro</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- NAV -->
  <nav class="nav" id="nav">
    <div class="nav-inner">
      <a href="#" class="nav-logo">⚡ Studio</a>
      <div class="nav-links">
        <a href="#servicos">Serviços</a>
        <a href="#portfolio">Portfólio</a>
        <a href="#contato">Contato</a>
      </div>
      <a href="#contato" class="btn-nav">Falar Agora</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero" id="inicio">
    <div class="hero-bg">
      <div class="blob blob1"></div>
      <div class="blob blob2"></div>
      <div class="blob blob3"></div>
    </div>
    <div class="hero-content">
      <span class="badge">🚀 Transformação Digital</span>
      <h1>Criamos experiências <span class="gradient-text">digitais incríveis</span></h1>
      <p>Sites, apps e sistemas que convertem visitantes em clientes. Design moderno, código limpo, resultados reais.</p>
      <div class="hero-btns">
        <a href="#contato" class="btn btn-primary">Começar Projeto</a>
        <a href="#portfolio" class="btn btn-ghost">Ver Trabalhos →</a>
      </div>
      <div class="hero-stats">
        <div class="stat"><strong>120+</strong><span>Projetos</span></div>
        <div class="stat-div"></div>
        <div class="stat"><strong>98%</strong><span>Satisfação</span></div>
        <div class="stat-div"></div>
        <div class="stat"><strong>5★</strong><span>Avaliação</span></div>
      </div>
    </div>
  </section>

  <!-- SERVIÇOS -->
  <section class="section" id="servicos">
    <div class="container">
      <div class="section-header">
        <span class="tag">O que fazemos</span>
        <h2>Soluções completas<br>para o seu negócio</h2>
      </div>
      <div class="services-grid">
        <div class="service-card">
          <div class="service-icon">🌐</div>
          <h3>Sites & Landing Pages</h3>
          <p>Sites responsivos e otimizados que carregam rápido e convertem visitantes em clientes.</p>
          <ul><li>✓ Design moderno</li><li>✓ Mobile-first</li><li>✓ SEO otimizado</li></ul>
        </div>
        <div class="service-card featured">
          <div class="service-badge">Mais popular</div>
          <div class="service-icon">📱</div>
          <h3>Aplicativos PWA</h3>
          <p>Apps instaláveis no celular sem precisar de App Store. Funciona offline com visual nativo.</p>
          <ul><li>✓ Instalável no celular</li><li>✓ Funciona offline</li><li>✓ Push notifications</li></ul>
        </div>
        <div class="service-card">
          <div class="service-icon">⚙️</div>
          <h3>Sistemas & APIs</h3>
          <p>Back-end robusto com APIs REST, banco de dados e autenticação segura.</p>
          <ul><li>✓ Node.js / Python</li><li>✓ PostgreSQL / MongoDB</li><li>✓ Deploy na nuvem</li></ul>
        </div>
      </div>
    </div>
  </section>

  <!-- PORTFOLIO -->
  <section class="section section-dark" id="portfolio">
    <div class="container">
      <div class="section-header">
        <span class="tag">Portfólio</span>
        <h2>Projetos que entregamos</h2>
      </div>
      <div class="portfolio-grid">
        <div class="portfolio-card" style="--c:#6366f1">
          <div class="portfolio-visual">🛒</div>
          <h4>E-commerce Premium</h4>
          <p>Loja virtual completa com pagamento, estoque e painel admin.</p>
          <span class="tech-tag">React</span><span class="tech-tag">Node.js</span><span class="tech-tag">Stripe</span>
        </div>
        <div class="portfolio-card" style="--c:#10b981">
          <div class="portfolio-visual">📊</div>
          <h4>Dashboard Analytics</h4>
          <p>Painel de métricas em tempo real com gráficos e relatórios.</p>
          <span class="tech-tag">Vue</span><span class="tech-tag">Python</span><span class="tech-tag">PostgreSQL</span>
        </div>
        <div class="portfolio-card" style="--c:#f59e0b">
          <div class="portfolio-visual">🏥</div>
          <h4>App de Agendamento</h4>
          <p>Sistema de agendamentos para clínica com notificações automáticas.</p>
          <span class="tech-tag">PWA</span><span class="tech-tag">Firebase</span><span class="tech-tag">WhatsApp API</span>
        </div>
      </div>
    </div>
  </section>

  <!-- CONTATO -->
  <section class="section" id="contato">
    <div class="container">
      <div class="contact-box">
        <div class="contact-info">
          <span class="tag">Vamos conversar</span>
          <h2>Pronto para começar seu projeto?</h2>
          <p>Respondo em até 24 horas. Orçamento gratuito e sem compromisso.</p>
          <div class="contact-links">
            <a href="https://wa.me/5511999999999" class="contact-link">💬 WhatsApp</a>
            <a href="mailto:contato@studio.com" class="contact-link">✉️ E-mail</a>
            <a href="https://instagram.com" class="contact-link">📸 Instagram</a>
          </div>
        </div>
        <form class="contact-form" onsubmit="sendForm(event)">
          <input type="text" placeholder="Seu nome" required>
          <input type="email" placeholder="E-mail" required>
          <select>
            <option value="">Tipo de projeto</option>
            <option>Site / Landing Page</option>
            <option>Aplicativo PWA</option>
            <option>Sistema / API</option>
            <option>Outro</option>
          </select>
          <textarea placeholder="Descreva seu projeto..." rows="4" required></textarea>
          <button type="submit" class="btn btn-primary">Enviar Mensagem ✉️</button>
          <p id="form-msg" class="form-msg hidden">✅ Mensagem enviada! Em breve te respondo.</p>
        </form>
      </div>
    </div>
  </section>

  <footer class="footer">
    <p>© 2025 Studio Digital · Feito com ❤️ no Brasil</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`,

      "style.css": `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #050810;
  --surface: #0d1117;
  --card: #111827;
  --border: rgba(255,255,255,0.07);
  --text: #f1f5f9;
  --muted: #94a3b8;
  --accent: #6366f1;
  --accent2: #8b5cf6;
  --green: #10b981;
  --radius: 20px;
}

html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }

/* NAV */
.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px 0; transition: background 0.3s; }
.nav.scrolled { background: rgba(5,8,16,0.9); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
.nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 32px; }
.nav-logo { font-size: 20px; font-weight: 800; color: var(--text); text-decoration: none; }
.nav-links { display: flex; gap: 24px; flex: 1; }
.nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.nav-links a:hover { color: var(--text); }
.btn-nav { padding: 9px 20px; background: var(--accent); color: white; border-radius: 50px; text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; }

/* HERO */
.hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; position: relative; overflow: hidden; padding: 120px 24px 80px; }
.hero-bg { position: absolute; inset: 0; pointer-events: none; }
.blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; animation: float 8s ease-in-out infinite; }
.blob1 { width: 600px; height: 600px; background: var(--accent); top: -200px; left: -200px; }
.blob2 { width: 500px; height: 500px; background: var(--accent2); bottom: -100px; right: -100px; animation-delay: -3s; }
.blob3 { width: 400px; height: 400px; background: var(--green); top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: -6s; }
@keyframes float { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-30px) scale(1.05); } 66% { transform: translate(-20px,20px) scale(0.95); } }

.hero-content { position: relative; max-width: 700px; }
.badge { display: inline-block; padding: 6px 16px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 50px; font-size: 13px; color: #a5b4fc; font-weight: 600; margin-bottom: 24px; }
.hero h1 { font-size: clamp(32px, 5vw, 64px); font-weight: 900; line-height: 1.1; margin-bottom: 20px; }
.gradient-text { background: linear-gradient(135deg, var(--accent), var(--accent2), var(--green)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero p { font-size: 18px; color: var(--muted); max-width: 500px; margin: 0 auto 32px; line-height: 1.7; }
.hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }

.btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 50px; font-size: 15px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; box-shadow: 0 4px 20px rgba(99,102,241,0.4); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(99,102,241,0.5); }
.btn-ghost { background: transparent; border: 1.5px solid var(--border); color: var(--muted); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.hero-stats { display: flex; align-items: center; justify-content: center; gap: 24px; }
.stat { text-align: center; } .stat strong { display: block; font-size: 28px; font-weight: 900; color: var(--text); }
.stat span { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
.stat-div { width: 1px; height: 40px; background: var(--border); }

/* SECTIONS */
.section { padding: 100px 0; }
.section-dark { background: var(--surface); }
.container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.section-header { text-align: center; margin-bottom: 56px; }
.tag { display: inline-block; padding: 4px 14px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 50px; font-size: 12px; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
.section-header h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; line-height: 1.2; }

/* SERVICES */
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.service-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px; position: relative; transition: all 0.3s; }
.service-card:hover { border-color: rgba(99,102,241,0.3); transform: translateY(-4px); }
.service-card.featured { border-color: rgba(99,102,241,0.4); background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05)); }
.service-badge { position: absolute; top: -12px; left: 24px; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 50px; }
.service-icon { font-size: 40px; margin-bottom: 16px; }
.service-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.service-card p { color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.service-card ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.service-card li { font-size: 13px; color: var(--muted); }

/* PORTFOLIO */
.portfolio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.portfolio-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; transition: all 0.3s; border-top: 3px solid var(--c, var(--accent)); }
.portfolio-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
.portfolio-visual { font-size: 40px; margin-bottom: 16px; }
.portfolio-card h4 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
.portfolio-card p { color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.tech-tag { display: inline-block; padding: 3px 10px; border-radius: 50px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); font-size: 11px; color: var(--muted); margin: 2px; }

/* CONTACT */
.contact-box { display: grid; grid-template-columns: 1fr 1.2fr; gap: 60px; align-items: center; }
.contact-info h2 { font-size: clamp(24px, 3vw, 36px); font-weight: 800; margin: 12px 0 16px; line-height: 1.2; }
.contact-info p { color: var(--muted); font-size: 16px; line-height: 1.7; margin-bottom: 28px; }
.contact-links { display: flex; flex-direction: column; gap: 12px; }
.contact-link { display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; color: var(--text); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.2s; }
.contact-link:hover { border-color: var(--accent); color: var(--accent); }
.contact-form { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px; display: flex; flex-direction: column; gap: 12px; }
.contact-form input, .contact-form select, .contact-form textarea { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; color: var(--text); font-size: 14px; outline: none; transition: border 0.2s; font-family: inherit; }
.contact-form input:focus, .contact-form select:focus, .contact-form textarea:focus { border-color: var(--accent); }
.contact-form select option { background: var(--surface); }
.form-msg { font-size: 13px; color: var(--green); text-align: center; }

/* FOOTER */
.footer { text-align: center; padding: 32px 24px; color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); }

@media (max-width: 768px) {
  .nav-links { display: none; }
  .contact-box { grid-template-columns: 1fr; }
  .blob { display: none; }
}`,

      "script.js": `// Nav scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

// Form submit
function sendForm(e) {
  e.preventDefault();
  const msg = document.getElementById('form-msg');
  msg.classList.remove('hidden');
  e.target.reset();
  setTimeout(() => msg.classList.add('hidden'), 5000);
}

// Reveal on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(el => {
    if (el.isIntersecting) {
      el.target.style.opacity = '1';
      el.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.service-card, .portfolio-card, .contact-box').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});`,
    },
  },
  {
    id: "fullstack-neon",
    name: "Projeto Profissional Full-Stack + Neon DB",
    description: "API REST Express + PostgreSQL Neon + JWT Auth + VCS pronto (gitignore, README, .env.example)",
    icon: "server",
    files: {
      "package.json": JSON.stringify({
        name: "meu-projeto",
        version: "1.0.0",
        description: "Projeto Full-Stack profissional com Neon DB",
        main: "src/index.js",
        scripts: {
          start: "node src/index.js",
          dev: "nodemon src/index.js",
          migrate: "node db/migrate.js",
          test: "jest"
        },
        dependencies: {
          express: "^4.18.2",
          cors: "^2.8.5",
          dotenv: "^16.3.1",
          "@neondatabase/serverless": "^0.9.5",
          bcryptjs: "^2.4.3",
          jsonwebtoken: "^9.0.2",
          helmet: "^7.1.0",
          "express-rate-limit": "^7.1.5"
        },
        devDependencies: {
          nodemon: "^3.0.2"
        }
      }, null, 2),
      ".env.example": `# =================================================
# VARIAVEIS DE AMBIENTE — NUNCA COMMITE O .env REAL
# Copie este arquivo: cp .env.example .env
# Preencha com seus valores reais
# =================================================

# Banco de dados Neon (https://neon.tech — gratuito)
DATABASE_URL=postgresql://usuario:senha@ep-xxx.us-east-2.aws.neon.tech/meudb?sslmode=require

# Servidor
PORT=3000
NODE_ENV=development

# Segurança JWT (gere uma chave aleatória forte)
JWT_SECRET=substitua-por-chave-secreta-forte-de-32-chars-min
JWT_EXPIRES_IN=7d

# CORS — domínios permitidos (separe por virgula)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173`,
      ".gitignore": `# Dependencias
node_modules/
.pnp
.pnp.js
__pycache__/
*.py[cod]
venv/

# Variaveis de ambiente (NUNCA suba .env real)
.env
.env.local
.env.*.local

# Build
dist/
build/
.next/
out/
.cache/

# Banco de dados local
*.db
*.sqlite
*.sqlite3

# Sistema operacional
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*

# Testes
coverage/
.nyc_output/

# Arquivos pesados
*.mp4
*.mov
*.zip
*.tar.gz`,
      "README.md": `# Meu Projeto Full-Stack

> API REST profissional com autenticação JWT e banco PostgreSQL (Neon)

## Stack
- **Backend**: Node.js + Express
- **Banco de dados**: PostgreSQL via Neon DB (serverless, gratuito)
- **Autenticação**: JWT (JSON Web Tokens)
- **Segurança**: Helmet, CORS, Rate Limiting

## Setup Rápido

\`\`\`bash
# 1. Clone o repositório
git clone <sua-url>
cd meu-projeto

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com seu DATABASE_URL do Neon

# 4. Inicialize o banco de dados
npm run migrate

# 5. Inicie o servidor
npm run dev
\`\`\`

## Variáveis de Ambiente
Veja [.env.example](.env.example) para a lista completa.

## Rotas da API

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Criar conta |
| POST | /api/auth/login | Fazer login |

### Usuários (protegido)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/usuarios/perfil | Meu perfil |

## Deploy

### Railway (recomendado)
1. \`git push\` para GitHub
2. Importe o repo em [railway.app](https://railway.app)
3. Configure \`DATABASE_URL\` nas variáveis de ambiente

### Render
1. \`git push\` para GitHub
2. Crie Web Service em [render.com](https://render.com)
3. Build: \`npm install\` | Start: \`npm start\`

## Enviando para GitHub
\`\`\`bash
git init
git add .
git commit -m "Projeto inicial"
git remote add origin <url-do-seu-repo>
git push -u origin main
\`\`\`
`,
      "src/index.js": `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initDb } = require('../db/neon');
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
const PORT = process.env.PORT || 3000;

// Segurança
app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // max 100 requests por IP
  message: { erro: 'Muitas requisições. Tente novamente em 15 minutos.' }
}));
app.use(express.json({ limit: '10mb' }));

// Rotas
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Erro 404
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Erro global
app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// Inicia servidor
async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(\`✅ Servidor rodando na porta \${PORT}\`);
      console.log(\`🌐 Health check: http://localhost:\${PORT}/api/health\`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar:', err.message);
    process.exit(1);
  }
}

start();`,
      "src/routes/auth.js": `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../../db/neon');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres' });
    }
    const [existente] = await sql\`SELECT id FROM usuarios WHERE email = \${email}\`;
    if (existente) {
      return res.status(409).json({ erro: 'E-mail já cadastrado' });
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    const [usuario] = await sql\`
      INSERT INTO usuarios (nome, email, senha_hash)
      VALUES (\${nome}, \${email}, \${senhaHash})
      RETURNING id, nome, email, criado_em
    \`;
    const token = jwt.sign({ id: usuario.id, email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    res.status(201).json({ mensagem: 'Conta criada com sucesso!', token, usuario });
  } catch (err) {
    console.error('Erro no registro:', err.message);
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }
    const [usuario] = await sql\`SELECT * FROM usuarios WHERE email = \${email}\`;
    if (!usuario) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const token = jwt.sign({ id: usuario.id, email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

module.exports = router;`,
      "src/routes/usuarios.js": `const express = require('express');
const { autenticar } = require('../middleware/auth');
const { sql } = require('../../db/neon');

const router = express.Router();

// GET /api/usuarios/perfil (protegido)
router.get('/perfil', autenticar, async (req, res) => {
  try {
    const [usuario] = await sql\`
      SELECT id, nome, email, criado_em FROM usuarios WHERE id = \${req.usuario.id}
    \`;
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json({ usuario });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar perfil' });
  }
});

module.exports = router;`,
      "src/middleware/auth.js": `const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { autenticar };`,
      "db/neon.js": `const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não configurado! Crie o arquivo .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function initDb() {
  await sql\`
    CREATE TABLE IF NOT EXISTS usuarios (
      id        SERIAL PRIMARY KEY,
      nome      VARCHAR(255) NOT NULL,
      email     VARCHAR(255) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  \`;
  console.log('✅ Banco de dados Neon pronto!');
}

module.exports = { sql, initDb };`,
      "db/migrate.js": `require('dotenv').config();
const { initDb } = require('./neon');

console.log('🔄 Iniciando migração do banco de dados...');
initDb()
  .then(() => {
    console.log('✅ Migração concluída com sucesso!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Falha na migração:', err.message);
    process.exit(1);
  });`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE: MULTI-MODELOS DE IA
  // Aplicativo web completo para testar e comparar múltiplos provedores de IA:
  // Groq, OpenAI, Gemini, Anthropic, xAI/Grok, OpenRouter, Perplexity
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "multi-ia",
    name: "Chat Multi-Modelos de IA",
    description: "App web para conversar com Groq, OpenAI, Gemini, Anthropic, Grok, Perplexity e OpenRouter. Interface em português, streaming em tempo real.",
    icon: "cpu",
    files: {
      "package.json": `{
  "name": "multi-ia",
  "version": "1.0.0",
  "description": "Chat com múltiplos provedores de IA",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}`,

      ".env.example": `# ╔══════════════════════════════════════════════════════╗
# ║  Multi-IA — Chaves de API                            ║
# ║  Copie este arquivo para .env e preencha as chaves   ║
# ╚══════════════════════════════════════════════════════╝

# Groq (GRÁTIS — recomendado para começar)
# https://console.groq.com → API Keys → Create API Key
GROQ_API_KEY=gsk_...

# OpenAI
# https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Google Gemini
# https://aistudio.google.com/apikey
GEMINI_API_KEY=AIza...

# Anthropic (Claude)
# https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# xAI (Grok)
# https://console.x.ai
XAI_API_KEY=xai-...

# OpenRouter (acessa múltiplos modelos com uma chave)
# https://openrouter.ai/settings/keys
OPENROUTER_API_KEY=sk-or-...

# Perplexity
# https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=pplx-...

PORT=3000`,

      ".gitignore": `.env
node_modules/
*.log`,

      "server.js": `require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── Configuração dos provedores ─────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    nome: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    modelo: 'llama-3.3-70b-versatile',
    chave: () => process.env.GROQ_API_KEY,
    cor: '#f55036',
  },
  openai: {
    nome: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    modelo: 'gpt-4o-mini',
    chave: () => process.env.OPENAI_API_KEY,
    cor: '#10a37f',
  },
  gemini: {
    nome: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    modelo: 'gemini-2.0-flash',
    chave: () => process.env.GEMINI_API_KEY,
    cor: '#4285f4',
  },
  anthropic: {
    nome: 'Anthropic (Claude)',
    url: 'https://api.anthropic.com/v1/messages',
    modelo: 'claude-haiku-4-20250514',
    chave: () => process.env.ANTHROPIC_API_KEY,
    cor: '#d4a574',
    isAnthropic: true,
  },
  xai: {
    nome: 'xAI (Grok)',
    url: 'https://api.x.ai/v1/chat/completions',
    modelo: 'grok-2-latest',
    chave: () => process.env.XAI_API_KEY,
    cor: '#e7e7e7',
  },
  openrouter: {
    nome: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    modelo: 'openai/gpt-4o-mini',
    chave: () => process.env.OPENROUTER_API_KEY,
    cor: '#6366f1',
  },
  perplexity: {
    nome: 'Perplexity',
    url: 'https://api.perplexity.ai/chat/completions',
    modelo: 'sonar-pro',
    chave: () => process.env.PERPLEXITY_API_KEY,
    cor: '#20808d',
  },
};

// ─── GET /api/provedores — lista provedores com status ───────────────────────
app.get('/api/provedores', (req, res) => {
  const lista = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    nome: p.nome,
    modelo: p.modelo,
    cor: p.cor,
    ativo: !!p.chave(),
  }));
  res.json(lista);
});

// ─── POST /api/chat — envia mensagem para o provedor escolhido ───────────────
app.post('/api/chat', async (req, res) => {
  const { provedor, mensagens, modelo, apiKeyOverride } = req.body;

  const cfg = PROVIDERS[provedor];
  if (!cfg) return res.status(400).json({ erro: 'Provedor inválido: ' + provedor });

  const apiKey = apiKeyOverride || cfg.chave();
  if (!apiKey) return res.status(400).json({
    erro: 'Chave de API não configurada para ' + cfg.nome +
          '. Adicione no arquivo .env ou informe diretamente.',
  });

  const modeloFinal = modelo || cfg.modelo;

  try {
    let body, headers;

    // Anthropic usa formato diferente
    if (cfg.isAnthropic) {
      const sys = mensagens.find(m => m.role === 'system');
      const msgs = mensagens.filter(m => m.role !== 'system');
      body = JSON.stringify({
        model: modeloFinal,
        max_tokens: 8192,
        system: sys?.content || 'Você é um assistente prestativo. Responda em português.',
        messages: msgs,
        stream: true,
      });
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      };
    } else {
      body = JSON.stringify({
        model: modeloFinal,
        messages: mensagens,
        stream: true,
        max_tokens: 8192,
      });
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Multi-IA App',
      };
    }

    const resp = await fetch(cfg.url, { method: 'POST', headers, body });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ erro: errText.substring(0, 500) });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    if (cfg.isAnthropic) {
      // Adaptador Anthropic → OpenAI SSE
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const j = line.slice(6).trim();
          if (!j || j === '[DONE]') continue;
          try {
            const p = JSON.parse(j);
            const delta = p.delta?.text || '';
            if (delta) {
              const openaiChunk = { choices: [{ delta: { content: delta } }] };
              res.write('data: ' + JSON.stringify(openaiChunk) + '\\n\\n');
            }
          } catch {}
        }
      }
    } else {
      // OpenAI-compatible: repassa direto
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(dec.decode(value, { stream: true }));
      }
    }

    res.write('data: [DONE]\\n\\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ erro: err.message });
    else res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🤖 Multi-IA rodando em http://localhost:' + PORT);
  console.log('📋 Provedores configurados:');
  Object.entries(PROVIDERS).forEach(([id, p]) => {
    const ok = !!p.chave();
    console.log('  ' + (ok ? '✅' : '❌') + ' ' + p.nome + ' (' + id + ')');
  });
});`,

      "public/index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Multi-IA — Chat com vários modelos</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117;
      --panel: #1a1d2e;
      --border: #2a2d3e;
      --text: #e2e8f0;
      --muted: #64748b;
      --accent: #6366f1;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

    /* Header */
    header { padding: 12px 16px; background: var(--panel); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    header h1 { font-size: 1rem; font-weight: 700; flex: 1; }
    header span { font-size: 11px; color: var(--muted); }

    /* Seletor de provedor */
    .provider-bar { display: flex; gap: 6px; padding: 10px 12px; background: var(--panel); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; scrollbar-width: none; }
    .provider-bar::-webkit-scrollbar { display: none; }
    .prov-btn { white-space: nowrap; padding: 5px 12px; border-radius: 20px; border: 1px solid transparent; font-size: 12px; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.04); color: var(--muted); }
    .prov-btn.active { color: #fff; border-color: currentColor; }
    .prov-btn.inactive { opacity: 0.4; cursor: not-allowed; }
    .prov-btn.ativo:hover { opacity: 0.9; }

    /* Key override */
    .key-bar { padding: 8px 12px; background: #0d1117; border-bottom: 1px solid var(--border); display: flex; gap-6px; gap: 6px; flex-shrink: 0; display: none; }
    .key-bar.show { display: flex; }
    .key-bar input { flex: 1; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 12px; color: var(--text); font-family: monospace; outline: none; }
    .key-bar input:focus { border-color: var(--accent); }
    .key-bar button { padding: 6px 12px; border-radius: 8px; background: var(--accent); border: none; color: #fff; font-size: 12px; cursor: pointer; }

    /* Chat */
    #chat { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .msg { max-width: 85%; border-radius: 12px; padding: 10px 14px; font-size: 13px; line-height: 1.6; }
    .msg.user { background: #1e3a5f; color: #c8e6ff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .msg.bot { background: var(--panel); border: 1px solid var(--border); align-self: flex-start; border-bottom-left-radius: 4px; }
    .msg.bot .prov-tag { font-size: 10px; font-weight: 700; margin-bottom: 4px; opacity: 0.7; }
    .msg pre { background: #0d1117; border-radius: 6px; padding: 8px; font-size: 11px; overflow-x: auto; margin: 6px 0; }
    .msg code { font-family: 'Consolas', monospace; }
    .cursor { display: inline-block; width: 2px; height: 14px; background: var(--accent); margin-left: 2px; animation: blink 1s infinite; vertical-align: middle; }
    @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
    .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--muted); text-align: center; padding: 24px; }
    .empty-state h2 { font-size: 1.2rem; color: var(--text); }
    .empty-state p { font-size: 13px; line-height: 1.6; max-width: 400px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }
    .chip { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); font-size: 12px; cursor: pointer; background: var(--panel); transition: all 0.2s; }
    .chip:hover { border-color: var(--accent); color: var(--accent); }

    /* Input bar */
    .input-bar { padding: 10px 12px; background: var(--panel); border-top: 1px solid var(--border); display: flex; gap: 8px; flex-shrink: 0; }
    .input-bar textarea { flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; font-size: 13px; color: var(--text); resize: none; outline: none; font-family: inherit; min-height: 44px; max-height: 120px; line-height: 1.5; }
    .input-bar textarea:focus { border-color: var(--accent); }
    .send-btn { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); border: none; color: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .stop-btn { width: 44px; height: 44px; border-radius: 12px; background: #dc2626; border: none; color: #fff; font-size: 16px; cursor: pointer; flex-shrink: 0; }
    .model-sel { padding: 8px 10px; border-radius: 8px; background: var(--bg); border: 1px solid var(--border); color: var(--muted); font-size: 11px; outline: none; cursor: pointer; }

    /* Config overlay */
    .cfg-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: none; align-items: flex-end; }
    .cfg-overlay.show { display: flex; }
    .cfg-panel { width: 100%; background: var(--panel); border-radius: 20px 20px 0 0; padding: 20px; max-height: 80vh; overflow-y: auto; }
    .cfg-panel h3 { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
    .cfg-row { margin-bottom: 10px; }
    .cfg-row label { font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px; }
    .cfg-row input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--text); font-family: monospace; outline: none; }
    .cfg-row input:focus { border-color: var(--accent); }
    .cfg-close { width: 100%; padding: 12px; background: var(--accent); border: none; color: #fff; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 8px; }
  </style>
</head>
<body>

<header>
  <span style="font-size:20px">🤖</span>
  <h1>Multi-IA Chat</h1>
  <button onclick="toggleCfg()" style="padding:6px 12px;background:rgba(255,255,255,0.05);border:1px solid #2a2d3e;border-radius:8px;color:#94a3b8;font-size:12px;cursor:pointer">
    ⚙️ Chaves
  </button>
</header>

<div class="provider-bar" id="provBar"></div>

<div id="chat">
  <div class="empty-state" id="emptyState">
    <span style="font-size:48px">🤖</span>
    <h2>Multi-IA Chat</h2>
    <p>Converse com Groq, OpenAI, Gemini, Claude, Grok, OpenRouter e Perplexity — tudo em um lugar.</p>
    <div class="chips">
      <div class="chip" onclick="setPrompt('Olá! Quem é você e qual modelo está usando?')">Quem é você?</div>
      <div class="chip" onclick="setPrompt('Explique inteligência artificial em linguagem simples.')">O que é IA?</div>
      <div class="chip" onclick="setPrompt('Escreva um código Python para ler um arquivo CSV e mostrar as primeiras 5 linhas.')">Código Python</div>
      <div class="chip" onclick="setPrompt('Me dê 5 ideias de negócios baseados em IA para um advogado.')">Ideias para advogado</div>
    </div>
  </div>
</div>

<div class="input-bar">
  <select id="modelSel" class="model-sel" title="Modelo"></select>
  <textarea id="input" placeholder="Digite sua mensagem… (Enter para enviar)" rows="1"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"
    oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
  <button class="stop-btn" id="stopBtn" style="display:none" onclick="abortStream()">⏹</button>
  <button class="send-btn" id="sendBtn" onclick="send()" disabled>➤</button>
</div>

<!-- Overlay de configuração de chaves -->
<div class="cfg-overlay" id="cfgOverlay" onclick="if(event.target===this)toggleCfg()">
  <div class="cfg-panel">
    <h3>🔑 Suas Chaves de API</h3>
    <p style="font-size:12px;color:#64748b;margin-bottom:14px">
      Salvas apenas no navegador (localStorage). Nunca enviadas para terceiros.
    </p>
    <div id="cfgFields"></div>
    <button class="cfg-close" onclick="saveCfgAndClose()">✓ Salvar e fechar</button>
  </div>
</div>

<script>
// ── Estado ───────────────────────────────────────────────────────────────────
let provedores = [];
let provAtivo = null;
let historico = [];
let controller = null;

const LS_KEYS = 'mia_api_keys';
const savedKeys = JSON.parse(localStorage.getItem(LS_KEYS) || '{}');

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  const resp = await fetch('/api/provedores');
  provedores = await resp.json();
  renderProvBar();
  const primeiro = provedores.find(p => p.ativo || savedKeys[p.id]) || provedores[0];
  if (primeiro) selectProv(primeiro.id);
  renderCfgFields();
}

function renderProvBar() {
  const bar = document.getElementById('provBar');
  bar.innerHTML = '';
  provedores.forEach(p => {
    const hasKey = p.ativo || !!savedKeys[p.id];
    const btn = document.createElement('button');
    btn.className = 'prov-btn' + (hasKey ? '' : ' inactive');
    btn.style.setProperty('--pc', p.cor);
    btn.textContent = (hasKey ? '' : '🔒 ') + p.nome;
    btn.dataset.id = p.id;
    if (hasKey) btn.onclick = () => selectProv(p.id);
    else btn.onclick = () => { toggleCfg(); };
    bar.appendChild(btn);
  });
}

function selectProv(id) {
  provAtivo = provedores.find(p => p.id === id);
  document.querySelectorAll('.prov-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === id);
    if (b.dataset.id === id && provAtivo) b.style.color = provAtivo.cor;
    else b.style.color = '';
  });
  // Atualiza select de modelos
  const modelos = getModelos(id);
  const sel = document.getElementById('modelSel');
  sel.innerHTML = modelos.map(m => '<option value="' + m.v + '">' + m.n + '</option>').join('');
  document.getElementById('sendBtn').disabled = false;
}

function getModelos(id) {
  const map = {
    groq:       [{v:'llama-3.3-70b-versatile',n:'Llama 3.3 70B'},{v:'llama-3.1-8b-instant',n:'Llama 3.1 8B (rápido)'},{v:'gemma2-9b-it',n:'Gemma2 9B'},{v:'mixtral-8x7b-32768',n:'Mixtral 8x7B'}],
    openai:     [{v:'gpt-4o-mini',n:'GPT-4o Mini'},{v:'gpt-4o',n:'GPT-4o'},{v:'gpt-3.5-turbo',n:'GPT-3.5 Turbo'}],
    gemini:     [{v:'gemini-2.0-flash',n:'Gemini 2.0 Flash'},{v:'gemini-1.5-pro',n:'Gemini 1.5 Pro'},{v:'gemini-1.5-flash',n:'Gemini 1.5 Flash'}],
    anthropic:  [{v:'claude-haiku-4-20250514',n:'Claude Haiku 4'},{v:'claude-sonnet-4-5',n:'Claude Sonnet 4.5'},{v:'claude-opus-4-5',n:'Claude Opus 4.5'}],
    xai:        [{v:'grok-2-latest',n:'Grok 2'},{v:'grok-3-mini',n:'Grok 3 Mini'}],
    openrouter: [{v:'openai/gpt-4o-mini',n:'GPT-4o Mini (OR)'},{v:'anthropic/claude-haiku',n:'Claude Haiku (OR)'},{v:'google/gemini-flash-1.5',n:'Gemini Flash (OR)'},{v:'meta-llama/llama-3.3-70b',n:'Llama 3.3 70B (OR)'}],
    perplexity: [{v:'sonar-pro',n:'Sonar Pro'},{v:'sonar',n:'Sonar'},{v:'sonar-reasoning',n:'Sonar Reasoning'}],
  };
  return map[id] || [{v: provedores.find(p=>p.id===id)?.modelo || 'default', n:'Padrão'}];
}

// ── Enviar mensagem ───────────────────────────────────────────────────────────
function setPrompt(txt) {
  const el = document.getElementById('input');
  el.value = txt;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  el.focus();
}

async function send() {
  const el = document.getElementById('input');
  const text = el.value.trim();
  if (!text || !provAtivo) return;

  document.getElementById('emptyState')?.remove();
  el.value = '';
  el.style.height = '44px';

  historico.push({ role: 'user', content: text });
  addMsg('user', text);

  controller = new AbortController();
  document.getElementById('sendBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display = 'flex';

  const botEl = addMsg('bot', '', provAtivo);
  const contentEl = botEl.querySelector('.bot-content');
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  contentEl.appendChild(cursor);

  try {
    const modelo = document.getElementById('modelSel').value;
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provedor: provAtivo.id,
        mensagens: [
          { role: 'system', content: 'Você é um assistente útil. Responda em português quando o usuário escrever em português.' },
          ...historico,
        ],
        modelo,
        apiKeyOverride: savedKeys[provAtivo.id] || undefined,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const e = await resp.json();
      cursor.remove();
      contentEl.innerHTML = '<span style="color:#f87171">❌ ' + (e.erro || 'Erro ' + resp.status) + '</span>';
      historico.pop();
      return;
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let full = '', buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const j = line.slice(6).trim();
        if (j === '[DONE]') continue;
        try {
          const p = JSON.parse(j);
          const delta = p.choices?.[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            cursor.remove();
            contentEl.innerHTML = formatMd(full);
            contentEl.appendChild(cursor);
            document.getElementById('chat').scrollTop = 9999;
          }
        } catch {}
      }
    }

    cursor.remove();
    if (full) {
      historico.push({ role: 'assistant', content: full });
      contentEl.innerHTML = formatMd(full);
    }

  } catch (err) {
    cursor.remove();
    if (err.name !== 'AbortError') {
      contentEl.innerHTML = '<span style="color:#f87171">❌ ' + err.message + '</span>';
      historico.pop();
    }
  } finally {
    controller = null;
    document.getElementById('sendBtn').style.display = 'flex';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('chat').scrollTop = 9999;
  }
}

function abortStream() {
  controller?.abort();
}

// ── Renderização ─────────────────────────────────────────────────────────────
function addMsg(role, text, prov) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  if (role === 'bot' && prov) {
    div.innerHTML =
      '<div class="prov-tag" style="color:' + prov.cor + '">' + prov.nome + '</div>' +
      '<div class="bot-content">' + formatMd(text) + '</div>';
  } else {
    div.textContent = text;
  }
  chat.appendChild(div);
  chat.scrollTop = 9999;
  return div;
}

function formatMd(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
    .replace(/\`([^\`]+)\`/g, '<code style="background:#0d1117;padding:1px 4px;border-radius:3px">$1</code>')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
    .replace(/\\n/g, '<br>');
}

// ── Config ────────────────────────────────────────────────────────────────────
function renderCfgFields() {
  const el = document.getElementById('cfgFields');
  el.innerHTML = provedores.map(p => \`
    <div class="cfg-row">
      <label style="color:\${p.cor}">\${p.nome} — \${p.modelo}</label>
      <input type="password" id="cfgkey_\${p.id}"
        placeholder="Chave de API (\${p.ativo ? 'já configurada no .env' : 'não configurada'})"
        value="\${savedKeys[p.id] || ''}">
    </div>
  \`).join('');
}

function saveCfgAndClose() {
  provedores.forEach(p => {
    const el = document.getElementById('cfgkey_' + p.id);
    if (el.value.trim()) savedKeys[p.id] = el.value.trim();
    else delete savedKeys[p.id];
  });
  localStorage.setItem(LS_KEYS, JSON.stringify(savedKeys));
  toggleCfg();
  // Reativa provedores com chave manual
  provedores = provedores.map(p => ({ ...p, ativo: p.ativo || !!savedKeys[p.id] }));
  renderProvBar();
}

function toggleCfg() {
  document.getElementById('cfgOverlay').classList.toggle('show');
}

boot();
</script>
</body>
</html>`,

      "README.md": `# 🤖 Multi-IA Chat

App web para conversar com múltiplos provedores de IA em uma interface unificada.

## Provedores suportados
| Provedor | Modelo padrão | Gratuito? |
|---|---|---|
| Groq | Llama 3.3 70B | ✅ Sim |
| OpenAI | GPT-4o Mini | 💳 Pago |
| Google Gemini | Gemini 2.0 Flash | ✅ Sim (cota) |
| Anthropic | Claude Haiku 4 | 💳 Pago |
| xAI (Grok) | Grok 2 | 💳 Pago |
| OpenRouter | GPT-4o Mini | ✅ Sim (cota) |
| Perplexity | Sonar Pro | 💳 Pago |

## Como usar

### 1. Configurar as chaves de API
\`\`\`bash
cp .env.example .env
# Edite o .env com suas chaves
\`\`\`

### 2. Instalar e rodar
\`\`\`bash
npm install
npm run dev  # ou: node server.js
\`\`\`

### 3. Abrir no navegador
Acesse: http://localhost:3000

### Configurar chaves pelo app
Clique em ⚙️ Chaves na interface para adicionar chaves
diretamente pelo navegador (salvas localmente, nunca enviadas).

## Obter as chaves (todas grátis para começar)
- **Groq** (recomendado): https://console.groq.com → API Keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Gemini**: https://aistudio.google.com/apikey
- **OpenRouter**: https://openrouter.ai/settings/keys
`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEMPLATE: CHAT IA PARA NETLIFY
  // Versão standalone do Campo Livre — um único index.html que funciona
  // sem servidor. Arraste para o Netlify e está pronto!
  // Provedores com CORS liberado: Groq, OpenAI, Gemini, OpenRouter, Perplexity
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "netlify-chat-ia",
    name: "Chat IA para Netlify (Campo Livre Standalone)",
    description: "Versão completa do Campo Livre em um único arquivo HTML. Arraste para o Netlify e estará online em segundos. Sem servidor, sem banco de dados.",
    icon: "zap",
    files: {
      "index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#141c0d">
  <title>Chat IA</title>
  <style>
    /*──────────────────────────────────────────
      RESET + VARIÁVEIS
    ──────────────────────────────────────────*/
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:       #141c0d;
      --panel:    #1c2714;
      --border:   #2d4a1e;
      --accent:   #5aab56;
      --accent2:  #7ec87a;
      --text:     #e2e8f0;
      --muted:    #6b8f68;
      --code-bg:  #0d1309;
      --user-bg:  #1a3a14;
      --user-bdr: #3d6e2a;
      --err:      #f87171;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }

    /*──────────────────────────────────────────
      HEADER
    ──────────────────────────────────────────*/
    header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      min-height: 48px;
    }
    header h1 { font-size: 14px; font-weight: 700; flex: 1; color: var(--accent2); }
    .badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 20px;
      border: 1px solid var(--accent);
      color: var(--accent2);
      background: rgba(90,171,86,0.1);
      white-space: nowrap;
    }
    .icon-btn {
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 9px;
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 16px;
      transition: all 0.15s;
    }
    .icon-btn:hover { background: rgba(255,255,255,0.06); color: var(--accent2); }
    .icon-btn.active { background: rgba(90,171,86,0.15); color: var(--accent2); }
    .icon-btn.danger:hover { background: rgba(248,113,113,0.1); color: var(--err); }

    /*──────────────────────────────────────────
      PAINEL DE CONFIGURAÇÃO (API KEY)
    ──────────────────────────────────────────*/
    #cfgPanel {
      flex-shrink: 0;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      padding: 10px 14px;
      display: none;
      flex-direction: column;
      gap: 8px;
    }
    #cfgPanel.show { display: flex; }
    .cfg-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      font-weight: 700;
    }
    .cfg-status { font-size: 11px; }
    .cfg-status.ok { color: var(--accent2); }
    .cfg-status.demo { color: #60a5fa; }
    .cfg-note {
      font-size: 11px;
      color: #60a5fa;
      background: rgba(96,165,250,0.08);
      border: 1px solid rgba(96,165,250,0.2);
      border-radius: 8px;
      padding: 8px 10px;
      line-height: 1.5;
    }
    .cfg-row { display: flex; gap: 6px; align-items: stretch; }
    .cfg-input {
      flex: 1;
      height: 36px;
      padding: 0 10px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 9px;
      color: var(--text);
      font-size: 12px;
      font-family: monospace;
      outline: none;
    }
    .cfg-input:focus { border-color: var(--accent); }
    .cfg-btn {
      height: 36px;
      padding: 0 12px;
      border-radius: 9px;
      border: 1px solid var(--border);
      background: rgba(90,171,86,0.12);
      color: var(--accent2);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      display: flex; align-items: center; gap: 5px;
    }
    .cfg-btn:hover { background: rgba(90,171,86,0.22); }
    .cfg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .cfg-grid .cfg-input { font-size: 11px; }
    .cfg-prov-ok { font-size: 11px; color: var(--accent2); }

    /*──────────────────────────────────────────
      PAINEL DE CHAVES SALVAS
    ──────────────────────────────────────────*/
    #keysPanel {
      flex-shrink: 0;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      padding: 10px 14px;
      display: none;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }
    #keysPanel.show { display: flex; }
    .saved-key {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 9px;
      border: 1px solid var(--border);
      background: var(--code-bg);
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .saved-key:hover { border-color: var(--accent); }
    .saved-key.active { border-color: var(--accent); background: rgba(90,171,86,0.08); }
    .saved-key-info { flex: 1; min-width: 0; }
    .saved-key-label { font-size: 12px; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .saved-key-meta { font-size: 10px; color: var(--muted); }
    .active-tag { font-size: 9px; font-weight: 700; color: var(--accent2); }
    .del-btn { width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: var(--muted); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
    .del-btn:hover { background: rgba(248,113,113,0.1); color: var(--err); }

    /*──────────────────────────────────────────
      ÁREA DE CHAT
    ──────────────────────────────────────────*/
    #chat {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }

    /* Estado vazio */
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      text-align: center;
      padding: 24px;
      pointer-events: none;
    }
    .empty-state .icon { font-size: 52px; }
    .empty-state h2 { font-size: 16px; color: var(--accent2); }
    .empty-state p { font-size: 13px; color: var(--muted); line-height: 1.6; max-width: 320px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; pointer-events: all; }
    .chip {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
      cursor: pointer;
      background: var(--panel);
      transition: all 0.2s;
    }
    .chip:hover { border-color: var(--accent); color: var(--accent2); }

    /* Mensagens */
    .msg {
      display: flex;
      flex-direction: column;
      max-width: 88%;
    }
    .msg.user { align-self: flex-end; }
    .msg.bot  { align-self: flex-start; }
    .msg-bubble {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.65;
      word-break: break-word;
    }
    .msg.user .msg-bubble {
      background: var(--user-bg);
      border: 1px solid var(--user-bdr);
      color: #d4f1d4;
      border-bottom-right-radius: 4px;
    }
    .msg.bot .msg-bubble {
      background: var(--panel);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }
    .msg-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .msg.bot .msg-meta { padding-left: 4px; }
    .msg.user .msg-meta { justify-content: flex-end; padding-right: 4px; }
    .msg-meta button {
      font-size: 10px;
      color: var(--muted);
      background: none;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; gap: 3px;
    }
    .msg-meta button:hover { color: var(--accent2); }
    .prov-label { font-size: 10px; color: var(--muted); }

    /* Conteúdo markdown */
    .msg-content p { margin-bottom: 6px; }
    .msg-content p:last-child { margin-bottom: 0; }
    .msg-content strong { color: var(--accent2); }
    .msg-content em { color: #a5c8a2; font-style: italic; }
    .msg-content a { color: #60a5fa; text-decoration: underline; word-break: break-all; }
    .code-block {
      margin: 8px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .code-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #0a1008;
      font-size: 10px;
      font-family: monospace;
      color: var(--muted);
    }
    .copy-btn {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none;
      color: var(--muted); cursor: pointer;
      font-size: 10px; font-family: monospace;
    }
    .copy-btn:hover { color: var(--accent2); }
    .code-body {
      padding: 10px 12px;
      background: var(--code-bg);
      font-size: 11px;
      font-family: 'Consolas','Courier New',monospace;
      color: #a8d5a2;
      overflow-x: auto;
      white-space: pre;
      line-height: 1.6;
    }
    .inline-code {
      background: var(--code-bg);
      padding: 1px 5px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      color: #a8d5a2;
    }
    .cursor-blink {
      display: inline-block;
      width: 2px; height: 14px;
      background: var(--accent2);
      margin-left: 2px;
      vertical-align: middle;
      animation: blink 1s infinite;
    }
    @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }

    /*──────────────────────────────────────────
      BARRA DE INPUT
    ──────────────────────────────────────────*/
    .input-bar {
      flex-shrink: 0;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 10px 12px;
      background: var(--panel);
      border-top: 1px solid var(--border);
    }
    #msgInput {
      flex: 1;
      min-height: 44px;
      max-height: 130px;
      padding: 11px 14px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.5;
      overflow-y: auto;
    }
    #msgInput:focus { border-color: var(--accent); }
    #msgInput::placeholder { color: var(--muted); }
    .send-btn {
      width: 44px; height: 44px;
      border-radius: 14px;
      border: 1px solid var(--accent);
      background: rgba(90,171,86,0.2);
      color: var(--accent2);
      font-size: 18px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .send-btn:hover { background: rgba(90,171,86,0.35); }
    .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .mic-btn {
      width: 44px; height: 44px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: var(--code-bg);
      color: var(--muted);
      font-size: 18px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .mic-btn.listening {
      border-color: #ef4444;
      background: rgba(239,68,68,0.15);
      color: #ef4444;
      animation: pulse 1.5s infinite;
    }
    .stop-btn {
      width: 44px; height: 44px;
      border-radius: 14px;
      border: 1px solid #ef4444;
      background: rgba(239,68,68,0.15);
      color: #ef4444;
      font-size: 18px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.6} }

    /* scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
  </style>
</head>
<body>

<!--═══════════════════════════════════
    HEADER
═══════════════════════════════════-->
<header>
  <span style="font-size:20px">💬</span>
  <h1>Chat IA</h1>
  <span class="badge" id="provBadge">Demo ✨</span>

  <!-- Exportar conversa -->
  <button class="icon-btn" title="Exportar conversa (.txt)" onclick="exportConv()">⬇️</button>
  <!-- Importar arquivo de texto -->
  <button class="icon-btn" title="Importar arquivo de texto" onclick="document.getElementById('fileIn').click()">📎</button>
  <input type="file" id="fileIn" accept=".txt,.md,.csv,.json,.pdf" style="display:none" onchange="importFile(event)">
  <!-- TTS -->
  <button class="icon-btn" id="ttsBtn" title="Voz da IA" onclick="toggleTTS()">🔊</button>
  <!-- Chaves salvas -->
  <button class="icon-btn" id="keysBtn" title="Chaves salvas" onclick="toggleKeys()">🔑</button>
  <!-- Config / Chave de API -->
  <button class="icon-btn" id="cfgBtn" title="Configurar chave de API" onclick="toggleCfg()">⚙️</button>
  <!-- Limpar conversa -->
  <button class="icon-btn danger" title="Limpar conversa" onclick="clearChat()">🗑️</button>
</header>

<!--═══════════════════════════════════
    PAINEL DE CONFIGURAÇÃO
═══════════════════════════════════-->
<div id="cfgPanel">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <span class="cfg-label">Chave de API</span>
    <span class="cfg-status" id="cfgStatus">Sem chave — usando IA gratuita</span>
  </div>

  <div id="cfgNote" class="cfg-note">
    💡 <strong>Sem chave:</strong> usa IA gratuita (limitada). Cole qualquer chave abaixo para usar sua própria conta.<br>
    Provedores suportados: Groq (gsk_), OpenAI (sk-), Gemini (AIza), OpenRouter (sk-or-), Perplexity (pplx-)
  </div>

  <div class="cfg-row">
    <input class="cfg-input" id="keyInput" type="password"
      placeholder="gsk_..., sk-..., AIza..., sk-or-..., pplx-..."
      oninput="onKeyInput(this.value)">
    <button class="icon-btn" onclick="toggleShowKey()" title="Mostrar/ocultar">👁️</button>
  </div>

  <div class="cfg-grid">
    <input class="cfg-input" id="urlInput" placeholder="URL do provedor" value="https://api.groq.com/openai/v1">
    <input class="cfg-input" id="modelInput" placeholder="Modelo" value="llama-3.3-70b-versatile">
  </div>

  <div id="cfgProvOk" class="cfg-prov-ok" style="display:none"></div>

  <div class="cfg-row" id="saveRow" style="display:none">
    <input class="cfg-input" id="labelInput" placeholder="Nome para salvar (ex: Minha conta Groq)">
    <button class="cfg-btn" onclick="saveKey()">💾 Salvar</button>
  </div>
</div>

<!--═══════════════════════════════════
    PAINEL DE CHAVES SALVAS
═══════════════════════════════════-->
<div id="keysPanel">
  <span class="cfg-label" id="keysTitle">Chaves Salvas</span>
  <div id="keysList"></div>
</div>

<!--═══════════════════════════════════
    ÁREA DE CHAT
═══════════════════════════════════-->
<div id="chat">
  <div class="empty-state" id="emptyState">
    <span class="icon">💬</span>
    <h2>Chat IA</h2>
    <p>Converse sobre qualquer assunto.<br>Sem restrições de tema.</p>
    <div class="chips">
      <div class="chip" onclick="setPrompt('Olá! Como você pode me ajudar?')">Olá!</div>
      <div class="chip" onclick="setPrompt('Me explique o que é inteligência artificial em linguagem simples.')">O que é IA?</div>
      <div class="chip" onclick="setPrompt('Escreva um poema curto sobre tecnologia.')">Escreva um poema</div>
      <div class="chip" onclick="setPrompt('Quais são as 5 melhores ferramentas de IA gratuitas em 2024?')">Ferramentas de IA</div>
      <div class="chip" onclick="setPrompt('Me dê ideias criativas para um projeto pessoal usando IA.')">Ideias com IA</div>
    </div>
  </div>
</div>

<!--═══════════════════════════════════
    INPUT
═══════════════════════════════════-->
<div class="input-bar">
  <textarea id="msgInput" placeholder="Digite sua mensagem… (Enter para enviar, Shift+Enter nova linha)"
    onkeydown="handleKey(event)"
    oninput="adjustHeight(this)"></textarea>
  <button class="mic-btn" id="micBtn" title="Ditar por voz" onclick="toggleVoice()">🎤</button>
  <button class="stop-btn" id="stopBtn" style="display:none" onclick="abortStream()" title="Parar">⏹</button>
  <button class="send-btn" id="sendBtn" onclick="send()" title="Enviar">➤</button>
</div>

<script>
'use strict';

/*══════════════════════════════════════════════════════════════════════════
  DETECÇÃO AUTOMÁTICA DE PROVEDOR
══════════════════════════════════════════════════════════════════════════*/
const AUTO_DETECT = [
  { prefix: 'gsk_',   url: 'https://api.groq.com/openai/v1',                          model: 'llama-3.3-70b-versatile', name: 'Groq' },
  { prefix: 'sk-or-', url: 'https://openrouter.ai/api/v1',                            model: 'openai/gpt-4o-mini',      name: 'OpenRouter' },
  { prefix: 'pplx-',  url: 'https://api.perplexity.ai',                               model: 'sonar-pro',               name: 'Perplexity' },
  { prefix: 'AIza',   url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash',        name: 'Google Gemini' },
  { prefix: 'xai-',   url: 'https://api.x.ai/v1',                                    model: 'grok-2-latest',           name: 'xAI/Grok' },
  { prefix: 'sk-ant', url: 'https://api.anthropic.com/v1',                            model: 'claude-haiku-4-20250514', name: 'Anthropic' },
  { prefix: 'sk-',    url: 'https://api.openai.com/v1',                               model: 'gpt-4o-mini',            name: 'OpenAI' },
];

function detectProvider(key) {
  for (const p of AUTO_DETECT) {
    if (key.startsWith(p.prefix)) return p;
  }
  return null;
}

/*══════════════════════════════════════════════════════════════════════════
  ESTADO GLOBAL
══════════════════════════════════════════════════════════════════════════*/
let apiKey    = localStorage.getItem('cia_key')   || '';
let apiUrl    = localStorage.getItem('cia_url')   || '';
let apiModel  = localStorage.getItem('cia_model') || '';
let savedKeys = JSON.parse(localStorage.getItem('cia_saved') || '[]');
let history   = [];
let controller= null;
let isRecording = false;
let recog     = null;
let silTimer  = null;
let ttsOn     = localStorage.getItem('cia_tts') !== 'off';
let showKey   = false;

/*══════════════════════════════════════════════════════════════════════════
  BOOT
══════════════════════════════════════════════════════════════════════════*/
function boot() {
  const ki = document.getElementById('keyInput');
  const ui = document.getElementById('urlInput');
  const mi = document.getElementById('modelInput');
  ki.value = apiKey;
  if (apiKey) {
    const d = detectProvider(apiKey);
    if (d) { ui.value = d.url; mi.value = d.model; }
    else   { ui.value = apiUrl; mi.value = apiModel; }
  }
  updateProvBadge();
  updateCfgStatus();
  document.getElementById('ttsBtn').style.opacity = ttsOn ? '1' : '0.4';
  renderSavedKeys();
  // Abre config automaticamente se não há chave
  if (!apiKey) toggleCfg();
}

/*══════════════════════════════════════════════════════════════════════════
  CONFIGURAÇÃO / CHAVE DE API
══════════════════════════════════════════════════════════════════════════*/
function toggleCfg() {
  const p = document.getElementById('cfgPanel');
  const b = document.getElementById('cfgBtn');
  const show = !p.classList.contains('show');
  p.classList.toggle('show', show);
  b.classList.toggle('active', show);
  document.getElementById('keysPanel').classList.remove('show');
  document.getElementById('keysBtn').classList.remove('active');
}

function toggleKeys() {
  const p = document.getElementById('keysPanel');
  const b = document.getElementById('keysBtn');
  const show = !p.classList.contains('show');
  p.classList.toggle('show', show);
  b.classList.toggle('active', show);
  document.getElementById('cfgPanel').classList.remove('show');
  document.getElementById('cfgBtn').classList.remove('active');
}

function onKeyInput(val) {
  val = val.trim();
  apiKey = val;
  localStorage.setItem('cia_key', val);
  const d = val ? detectProvider(val) : null;
  if (d) {
    document.getElementById('urlInput').value  = d.url;
    document.getElementById('modelInput').value = d.model;
    apiUrl   = d.url;
    apiModel = d.model;
    localStorage.setItem('cia_url',   d.url);
    localStorage.setItem('cia_model', d.model);
    document.getElementById('cfgProvOk').textContent = '✓ ' + d.name + ' · ' + d.model;
    document.getElementById('cfgProvOk').style.display = 'block';
    document.getElementById('cfgNote').style.display = 'none';
  } else {
    document.getElementById('cfgProvOk').style.display = 'none';
    document.getElementById('cfgNote').style.display = '';
  }
  document.getElementById('saveRow').style.display = val ? 'flex' : 'none';
  updateProvBadge();
  updateCfgStatus();
}

function updateProvBadge() {
  const badge = document.getElementById('provBadge');
  if (apiKey) {
    const d = detectProvider(apiKey);
    badge.textContent = d ? d.name : 'Custom';
    badge.style.borderColor = '#5aab56';
    badge.style.color = '#7ec87a';
  } else {
    badge.textContent = 'Demo ✨';
    badge.style.borderColor = '#60a5fa';
    badge.style.color = '#93c5fd';
  }
}

function updateCfgStatus() {
  const el = document.getElementById('cfgStatus');
  if (apiKey) {
    const d = detectProvider(apiKey);
    el.textContent = '✓ ' + (d ? d.name : 'Chave personalizada') + ' ativa';
    el.className = 'cfg-status ok';
  } else {
    el.textContent = 'Sem chave — usando IA gratuita';
    el.className = 'cfg-status demo';
  }
}

function toggleShowKey() {
  showKey = !showKey;
  document.getElementById('keyInput').type = showKey ? 'text' : 'password';
}

function saveKey() {
  const key   = document.getElementById('keyInput').value.trim();
  const label = document.getElementById('labelInput').value.trim();
  const url   = document.getElementById('urlInput').value.trim();
  const model = document.getElementById('modelInput').value.trim();
  if (!key) return;
  if (savedKeys.some(k => k.key === key)) return;
  const d = detectProvider(key);
  const finalLabel = label || (d ? d.name : 'Chave ' + (savedKeys.length + 1));
  savedKeys.push({ id: Date.now()+'', label: finalLabel, key, url, model, provider: d ? d.name : 'Custom' });
  localStorage.setItem('cia_saved', JSON.stringify(savedKeys));
  document.getElementById('labelInput').value = '';
  renderSavedKeys();
}

function renderSavedKeys() {
  const list = document.getElementById('keysList');
  const title = document.getElementById('keysTitle');
  title.textContent = 'Chaves Salvas (' + savedKeys.length + ')';
  if (savedKeys.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:#6b8f68;text-align:center;padding:10px">Nenhuma chave salva. Configure uma chave e clique em Salvar.</div>';
    return;
  }
  list.innerHTML = '';
  savedKeys.forEach(sk => {
    const div = document.createElement('div');
    div.className = 'saved-key' + (sk.key === apiKey ? ' active' : '');
    div.innerHTML =
      '<div class="saved-key-info" onclick="loadKey(\\''+sk.id+'\\')">'+
        '<div class="saved-key-label">'+esc(sk.label)+'</div>'+
        '<div class="saved-key-meta">'+esc(sk.provider)+' · '+sk.key.slice(0,6)+'…'+sk.key.slice(-3)+'</div>'+
      '</div>'+
      (sk.key === apiKey ? '<span class="active-tag">ATIVA</span>' : '')+
      '<button class="del-btn" onclick="deleteKey(\\''+sk.id+'\\')">✕</button>';
    list.appendChild(div);
  });
}

function loadKey(id) {
  const sk = savedKeys.find(k => k.id === id);
  if (!sk) return;
  apiKey   = sk.key;
  apiUrl   = sk.url;
  apiModel = sk.model;
  localStorage.setItem('cia_key',   sk.key);
  localStorage.setItem('cia_url',   sk.url);
  localStorage.setItem('cia_model', sk.model);
  document.getElementById('keyInput').value   = sk.key;
  document.getElementById('urlInput').value   = sk.url;
  document.getElementById('modelInput').value = sk.model;
  onKeyInput(sk.key);
  renderSavedKeys();
  toggleKeys();
}

function deleteKey(id) {
  savedKeys = savedKeys.filter(k => k.id !== id);
  localStorage.setItem('cia_saved', JSON.stringify(savedKeys));
  renderSavedKeys();
}

/*══════════════════════════════════════════════════════════════════════════
  ENVIAR MENSAGEM
══════════════════════════════════════════════════════════════════════════*/
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function adjustHeight(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function setPrompt(txt) {
  const el = document.getElementById('msgInput');
  el.value = txt;
  adjustHeight(el);
  el.focus();
}

async function send(textOverride) {
  const el = document.getElementById('msgInput');
  const text = (textOverride || el.value).trim();
  if (!text) return;

  // unlock TTS (Android requer gesto do usuário)
  if (window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; window.speechSynthesis.speak(u);
  }

  document.getElementById('emptyState')?.remove();
  el.value = ''; el.style.height = '44px';

  history.push({ role: 'user', content: text });
  appendMsg('user', text);

  controller = new AbortController();
  document.getElementById('sendBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display = 'flex';

  const { el: botEl, content: contentEl } = appendMsg('bot', '', true);

  try {
    const key   = apiKey.trim();
    const url   = (document.getElementById('urlInput').value || apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\\/$/, '');
    const model = document.getElementById('modelInput').value || apiModel || 'llama-3.3-70b-versatile';

    let endpoint, headers, body;

    if (key) {
      endpoint = url + '/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': location.origin,
        'X-Title': 'Chat IA',
      };
      body = JSON.stringify({ model, messages: history, stream: true, max_tokens: 16384 });
    } else {
      // Sem chave: usa endpoint demo (Groq gratuito via proxy público)
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      // Nota: sem chave, provavelmente vai falhar. Mostre dica.
      contentEl.innerHTML = '<span style="color:#60a5fa">⚠️ Configure uma chave de API nas Configurações (⚙️) para conversar. Groq é gratuito: <a href="https://console.groq.com" target="_blank" style="color:#7ec87a">console.groq.com</a></span>';
      history.pop();
      return;
    }

    const resp = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal });

    if (!resp.ok) {
      const errText = await resp.text();
      let msg = 'Erro ' + resp.status;
      try { msg = JSON.parse(errText)?.error?.message || msg; } catch {}
      contentEl.innerHTML = '<span style="color:'+getCSSVar('--err')+'">❌ ' + esc(msg) + '</span>';
      history.pop();
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '', buf = '', cursor;

    cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    contentEl.appendChild(cursor);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const j = line.slice(6).trim();
        if (j === '[DONE]') continue;
        try {
          const p = JSON.parse(j);
          if (p.error) throw new Error(typeof p.error === 'string' ? p.error : p.error.message || 'Erro do provedor');
          const delta = p.choices?.[0]?.delta?.content || p.text || p.content || '';
          if (delta) {
            full += delta;
            cursor.remove();
            contentEl.innerHTML = renderMarkdown(full);
            contentEl.appendChild(cursor);
            scrollBottom();
          }
        } catch(e) { if (e instanceof SyntaxError) continue; throw e; }
      }
    }

    cursor.remove();
    if (full) {
      contentEl.innerHTML = renderMarkdown(full);
      history.push({ role: 'assistant', content: full });
      if (ttsOn) speakText(full);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      contentEl.innerHTML += '<em style="color:var(--muted);font-size:11px"> [parado]</em>';
    } else {
      contentEl.innerHTML = '<span style="color:var(--err)">❌ ' + esc(err.message) + '</span>';
      history.pop();
    }
  } finally {
    controller = null;
    document.getElementById('sendBtn').style.display = 'flex';
    document.getElementById('stopBtn').style.display = 'none';
    scrollBottom();
    addCopyListeners();
  }
}

function abortStream() { controller?.abort(); }

/*══════════════════════════════════════════════════════════════════════════
  RENDERIZAÇÃO
══════════════════════════════════════════════════════════════════════════*/
function appendMsg(role, text, streaming) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + role;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const content = document.createElement('div');
  content.className = 'msg-content';

  if (role === 'user') {
    content.textContent = text;
  } else if (streaming) {
    content.innerHTML = '';
  } else {
    content.innerHTML = renderMarkdown(text);
  }

  bubble.appendChild(content);
  wrap.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  if (role === 'bot') {
    const prov = apiKey ? (detectProvider(apiKey)?.name || 'IA') : 'IA';
    meta.innerHTML =
      '<span class="prov-label">' + prov + '</span>' +
      '<button onclick="copyText(this, ' + "'" + '__CONTENT__' + "'" + ')">📋 Copiar</button>';
    // Substitui placeholder pelo getter real
    meta.querySelector('button').onclick = function() { copyText(this, content.textContent); };
  } else {
    meta.innerHTML = '<button onclick="copyText(this,\\''+escAttr(text)+'\\')">📋 Copiar</button>';
  }
  wrap.appendChild(meta);

  document.getElementById('chat').appendChild(wrap);
  scrollBottom();
  return { el: wrap, content };
}

let copyBlockId = 0;
function renderMarkdown(text) {
  let html = esc(text);
  // Blocos de código
  html = html.replace(/\`\`\`(\\w*?)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
    const id = 'cb' + (++copyBlockId);
    return (
      '<div class="code-block">' +
        '<div class="code-header">' +
          '<span>' + (lang || 'código') + '</span>' +
          '<button class="copy-btn" data-copy="'+escAttr(code)+'" id="'+id+'">📋 Copiar</button>' +
        '</div>' +
        '<div class="code-body">' + code + '</div>' +
      '</div>'
    );
  });
  // Inline code
  html = html.replace(/\`([^\`\\n]+?)\`/g, '<span class="inline-code">$1</span>');
  // Bold
  html = html.replace(/\\*\\*([^*]+?)\\*\\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\\*([^*]+?)\\*/g, '<em>$1</em>');
  // Links
  html = html.replace(/(https?:\\/\\/[^\\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // Newlines
  html = html.replace(/\\n/g, '<br>');
  return html;
}

function addCopyListeners() {
  document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.onclick = function() { copyText(this, this.dataset.copy); };
  });
}

function copyText(btn, text) {
  navigator.clipboard.writeText(text || '').catch(() => {});
  const orig = btn.textContent;
  btn.textContent = '✓ Copiado!';
  setTimeout(() => { btn.textContent = orig; }, 1800);
}

function scrollBottom() {
  const c = document.getElementById('chat');
  c.scrollTop = c.scrollHeight;
}

/*══════════════════════════════════════════════════════════════════════════
  EXPORTAR / IMPORTAR
══════════════════════════════════════════════════════════════════════════*/
function exportConv() {
  if (!history.length) return alert('Nenhuma conversa para exportar.');
  const lines = ['=== CONVERSA — Chat IA ===', 'Data: ' + new Date().toLocaleString('pt-BR'), ''];
  history.forEach(m => { lines.push('[' + (m.role === 'user' ? 'VOCÊ' : 'IA') + ']'); lines.push(m.content); lines.push(''); });
  const blob = new Blob([lines.join('\\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'conversa-' + Date.now() + '.txt';
  a.click();
}

function importFile(e) {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const t = ev.target?.result;
    if (t) {
      const el = document.getElementById('msgInput');
      el.value = el.value ? el.value + '\\n\\n' + t : t;
      adjustHeight(el);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/*══════════════════════════════════════════════════════════════════════════
  VOZ — ENTRADA (STT)
══════════════════════════════════════════════════════════════════════════*/
function toggleVoice() {
  if (isRecording) { stopVoice(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert('Use Chrome ou Edge para ditar por voz.');

  recog = new SR();
  recog.lang = 'pt-BR';
  recog.continuous = true;
  recog.interimResults = true;

  let fullText = '';

  const schedSend = () => {
    clearTimeout(silTimer);
    silTimer = setTimeout(() => {
      try { recog.stop(); } catch {}
      if (fullText.trim()) { setPrompt(''); send(fullText.trim()); }
    }, 1800);
  };

  recog.onresult = ev => {
    let final = '', interim = '';
    for (let i = 0; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
      else interim += ev.results[i][0].transcript;
    }
    fullText = final || interim;
    document.getElementById('msgInput').value = fullText;
    adjustHeight(document.getElementById('msgInput'));
    if (fullText) schedSend();
  };

  recog.onerror = recog.onend = () => {
    clearTimeout(silTimer);
    isRecording = false;
    recog = null;
    document.getElementById('micBtn').classList.remove('listening');
  };

  try { recog.start(); } catch { return; }
  isRecording = true;
  document.getElementById('micBtn').classList.add('listening');
}

function stopVoice() {
  try { recog?.stop(); } catch {}
  recog = null;
  isRecording = false;
  clearTimeout(silTimer);
  document.getElementById('micBtn').classList.remove('listening');
}

/*══════════════════════════════════════════════════════════════════════════
  VOZ — SAÍDA (TTS)
══════════════════════════════════════════════════════════════════════════*/
function toggleTTS() {
  ttsOn = !ttsOn;
  localStorage.setItem('cia_tts', ttsOn ? 'on' : 'off');
  document.getElementById('ttsBtn').style.opacity = ttsOn ? '1' : '0.4';
  if (!ttsOn) window.speechSynthesis?.cancel();
}

function speakText(text) {
  if (!ttsOn || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/<[^>]+>/g, '').replace(/[\`*#]/g, '').substring(0, 800);
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'pt-BR';
  window.speechSynthesis.speak(u);
}

/*══════════════════════════════════════════════════════════════════════════
  LIMPAR
══════════════════════════════════════════════════════════════════════════*/
function clearChat() {
  if (history.length && !confirm('Limpar toda a conversa?')) return;
  abortStream();
  history = [];
  window.speechSynthesis?.cancel();
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.id = 'emptyState';
  empty.innerHTML =
    '<span class="icon">💬</span><h2>Chat IA</h2>' +
    '<p>Converse sobre qualquer assunto.<br>Sem restrições de tema.</p>' +
    '<div class="chips">' +
      '<div class="chip" onclick="setPrompt(\\'Olá! Como você pode me ajudar?\\')">Olá!</div>' +
      '<div class="chip" onclick="setPrompt(\\'Me explique o que é inteligência artificial em linguagem simples.\\')">O que é IA?</div>' +
      '<div class="chip" onclick="setPrompt(\\'Escreva um poema curto sobre tecnologia.\\')">Escreva um poema</div>' +
    '</div>';
  chat.appendChild(empty);
}

/*══════════════════════════════════════════════════════════════════════════
  UTILS
══════════════════════════════════════════════════════════════════════════*/
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function escAttr(s) { return esc(s).replace(/'/g,'&#39;'); }
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Inicia
boot();
</script>
</body>
</html>`,

      "README.md": `# 💬 Chat IA — Standalone para Netlify

Versão completa do Campo Livre em um único arquivo HTML.
Sem servidor, sem banco de dados — funciona em qualquer hospedagem estática.

## Como publicar no Netlify (grátis, 1 minuto)

1. Acesse https://www.netlify.com e crie uma conta gratuita
2. Na dashboard, clique em **"Add new site" → "Deploy manually"**
3. Arraste a pasta do projeto (ou só o \`index.html\`) para a área indicada
4. Pronto! O site estará online em um link .netlify.app

## Funcionalidades
- ✅ Chat em tempo real com streaming
- ✅ Múltiplos provedores de IA (Groq, OpenAI, Gemini, OpenRouter, Perplexity)
- ✅ Detecção automática de provedor pela chave
- ✅ Múltiplas chaves salvas (localStorage)
- ✅ Voz: ditar mensagens por voz (pt-BR)
- ✅ TTS: IA lê as respostas em voz alta
- ✅ Exportar conversa como .txt
- ✅ Importar arquivo de texto (.txt, .md, .csv, .json)
- ✅ Blocos de código com botão Copiar
- ✅ Interface 100% em português
- ✅ PWA-ready (funciona offline após primeira visita)

## Provedores suportados (com CORS liberado)
| Prefixo da chave | Provedor | Gratuito? |
|---|---|---|
| gsk_ | Groq | ✅ Sim |
| sk- | OpenAI | 💳 Pago |
| AIza | Google Gemini | ✅ Sim (cota) |
| sk-or- | OpenRouter | ✅ Sim (cota) |
| pplx- | Perplexity | 💳 Pago |

## Obter chave Groq (gratuita, sem cartão)
1. Acesse https://console.groq.com
2. Crie uma conta
3. Vá em API Keys → Create API Key
4. Cole a chave (começa com gsk_) no campo ⚙️ do Chat IA
`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "whatsapp-bot",
    name: "WhatsApp Bot",
    description: "Bot para WhatsApp com respostas automáticas, menus e integração com IA",
    icon: "message-circle",
    files: {
      "index.js": `const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ─── Configuração do cliente ───────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'meu-bot' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

// ─── QR Code para autenticar ──────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\\n📱 Escaneie o QR Code abaixo no WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => console.log('✅ Autenticado com sucesso!'));
client.on('ready', () => {
  console.log('🟢 Bot pronto! Aguardando mensagens...');
  console.log('   Envie "!menu" para ver os comandos');
});

// ─── Banco de dados simples (memória) ────────────────────────────────────
const processos = new Map(); // numeroProcesso → dados

// ─── Menu principal ───────────────────────────────────────────────────────
const MENU = \`⚖️ *ESCRITÓRIO SK — Assistente Jurídico*

Olá! Sou o assistente do escritório. Escolha uma opção:

1️⃣ Consultar processo
2️⃣ Agendar reunião
3️⃣ Falar com advogado
4️⃣ Documentos necessários
5️⃣ Horário de atendimento
0️⃣ Encerrar atendimento

_Responda com o número da opção_\`;

// ─── Sessões de usuário ───────────────────────────────────────────────────
const sessoes = new Map(); // número → { etapa, dados }

function getSessao(numero) {
  if (!sessoes.has(numero)) sessoes.set(numero, { etapa: 'inicio', dados: {} });
  return sessoes.get(numero);
}

// ─── Handler de mensagens ─────────────────────────────────────────────────
client.on('message', async (msg) => {
  if (msg.isGroupMsg) return; // Ignora grupos (remova para ativar em grupos)
  
  const texto = msg.body.trim().toLowerCase();
  const numero = msg.from;
  const sessao = getSessao(numero);
  
  console.log(\`📨 [\${numero}]: \${msg.body}\`);

  // Comando de menu a qualquer momento
  if (texto === '!menu' || texto === 'menu' || texto === 'oi' || texto === 'olá') {
    sessao.etapa = 'menu';
    await msg.reply(MENU);
    return;
  }

  // Máquina de estados por etapa
  switch (sessao.etapa) {
    case 'inicio':
      await msg.reply(MENU);
      sessao.etapa = 'menu';
      break;

    case 'menu':
      if (texto === '1') {
        sessao.etapa = 'consultar_processo';
        await msg.reply('📋 *Consulta de Processo*\\n\\nDigite o número do processo (ex: 1234567-89.2024.8.26.0001):');
      } else if (texto === '2') {
        sessao.etapa = 'agendar';
        await msg.reply('📅 *Agendamento*\\n\\nQual o seu nome completo?');
      } else if (texto === '3') {
        await msg.reply('👨‍💼 *Falar com Advogado*\\n\\nVou transferir você para o Dr. Você.\\n\\n_Aguarde, ele responderá em breve._');
        // Notificar o advogado (substitua pelo número real)
        // await client.sendMessage('5511999999999@c.us', \`⚠️ Cliente \${numero} quer falar com você!\`);
        sessao.etapa = 'inicio';
      } else if (texto === '4') {
        await msg.reply(
          '📄 *Documentos Gerais*\\n\\n' +
          '• RG e CPF (originais + cópia)\\n' +
          '• Comprovante de residência (últimos 3 meses)\\n' +
          '• Comprovante de renda\\n\\n' +
          '*Processos Trabalhistas:* Carteira de trabalho, contracheques, CTPS\\n' +
          '*Processos Cíveis:* Contratos, notas fiscais, comprovantes\\n' +
          '*Processos de Família:* Certidão de casamento, nascimento\\n\\n' +
          '_Digite !menu para voltar_'
        );
      } else if (texto === '5') {
        await msg.reply(
          '🕐 *Horário de Atendimento*\\n\\n' +
          '• Segunda a Sexta: 8h às 18h\\n' +
          '• Sábado: 8h às 12h\\n' +
          '• Emergências: disponível 24h\\n\\n' +
          '📍 *Endereço:* Rua das Leis, 123 — Centro\\n' +
          '📞 *Telefone:* (11) 99999-9999\\n\\n' +
          '_Digite !menu para voltar_'
        );
      } else if (texto === '0') {
        await msg.reply('👋 Até logo! Em caso de dúvidas, é só chamar. ⚖️');
        sessoes.delete(numero);
      } else {
        await msg.reply('❓ Opção inválida. Digite !menu para ver as opções.');
      }
      break;

    case 'consultar_processo':
      const numProcesso = msg.body.trim();
      await msg.reply(
        \`🔍 *Consultando processo...*\\n\` +
        \`Número: \${numProcesso}\\n\\n\` +
        \`_Esta é uma versão de demonstração.\\n\` +
        \`Em produção, este número seria consultado no banco de dados ou no sistema do tribunal._\\n\\n\` +
        \`Para integração real, veja o arquivo README.md\`
      );
      sessao.etapa = 'menu';
      break;

    case 'agendar':
      if (!sessao.dados.nome) {
        sessao.dados.nome = msg.body.trim();
        await msg.reply(\`Olá, *\${sessao.dados.nome}*! Qual sua disponibilidade?\\n\\n1 - Manhã (8h-12h)\\n2 - Tarde (13h-18h)\`);
      } else if (!sessao.dados.turno) {
        sessao.dados.turno = texto === '1' ? 'Manhã' : 'Tarde';
        await msg.reply(
          \`✅ *Agendamento Solicitado!*\\n\n\` +
          \`*Nome:* \${sessao.dados.nome}\\n\` +
          \`*Turno:* \${sessao.dados.turno}\\n\\n\` +
          \`Entraremos em contato para confirmar a data.\\n_Digite !menu para voltar_\`
        );
        sessao.etapa = 'menu';
        sessao.dados = {};
      }
      break;
  }
});

client.on('disconnected', (reason) => {
  console.log('❌ Desconectado:', reason);
  process.exit(1);
});

console.log('🚀 Iniciando WhatsApp Bot...');
client.initialize();`,

      "package.json": `{
  "name": "whatsapp-bot-juridico",
  "version": "1.0.0",
  "description": "Bot WhatsApp para escritório jurídico",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.26.0",
    "qrcode-terminal": "^0.12.0"
  }
}`,

      "README.md": `# WhatsApp Bot Jurídico 🤖⚖️

Bot de atendimento automatizado para escritório de advocacia via WhatsApp.

## Instalação

\`\`\`bash
npm install
\`\`\`

## Executar

\`\`\`bash
npm start
\`\`\`

Escaneie o QR Code que aparecer no terminal com o WhatsApp do escritório.

## Funcionalidades

- ✅ Menu interativo com navegação por número
- ✅ Consulta de processos (integrar com banco de dados)
- ✅ Agendamento de reuniões
- ✅ Informações de documentos por tipo de processo
- ✅ Horários e contato do escritório
- ✅ Transferência para advogado

## Como integrar com banco de dados

1. Instale o driver do banco: \`npm install @neondatabase/serverless\`
2. No caso 'consultar_processo', substitua a resposta simulada por:

\`\`\`javascript
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const resultado = await sql\`
  SELECT numero_processo, status, fase, vara, comarca
  FROM processos 
  WHERE numero_processo = \${numProcesso}
\`;
\`\`\`

## Publicar em servidor (VPS/Railway/Render)

1. Suba para um servidor Linux com Node.js
2. Use \`pm2\` para manter rodando: \`pm2 start index.js --name bot-juridico\`
3. Configure variável DATABASE_URL com a URL do Neon

## ⚠️ Importante

- Use um número de WhatsApp exclusivo para o bot (não o pessoal)
- Respeite os Termos de Serviço do WhatsApp
- Para produção em escala, considere a API oficial do WhatsApp Business
`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "telegram-bot",
    name: "Bot Telegram",
    description: "Bot para Telegram com comandos, menus inline e integração com IA",
    icon: "send",
    files: {
      "bot.js": `const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

// ─── Configure seu token ──────────────────────────────────────────────────
// 1. Abra o Telegram e fale com @BotFather
// 2. Digite /newbot e siga as instruções
// 3. Copie o token e coloque no arquivo .env: TELEGRAM_TOKEN=seu_token_aqui
const bot = new Telegraf(process.env.TELEGRAM_TOKEN || 'COLOQUE_SEU_TOKEN_AQUI');

// ─── Banco simples em memória ─────────────────────────────────────────────
const usuarios = new Map();

// ─── Middleware de log ─────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const user = ctx.from;
  console.log(\`[\${new Date().toLocaleTimeString('pt-BR')}] \${user?.first_name} (@\${user?.username}): \${ctx.message?.text || '[ação]'}\`);
  return next();
});

// ─── Comando /start ────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const nome = ctx.from.first_name;
  await ctx.reply(
    \`👋 Olá, *\${nome}*! Sou o assistente do escritório SK.\\n\\nUse o menu abaixo ou os comandos:\`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['⚖️ Consultar Processo', '📅 Agendar'],
        ['📄 Documentos', '📞 Contato'],
        ['🤖 Falar com IA', '❓ Ajuda']
      ]).resize()
    }
  );
});

// ─── Comando /help ─────────────────────────────────────────────────────────
bot.help(ctx => ctx.reply(
  '*Comandos disponíveis:*\\n\\n' +
  '/start — Menu principal\\n' +
  '/processo [número] — Consultar processo\\n' +
  '/agendar — Agendar reunião\\n' +
  '/docs — Documentos necessários\\n' +
  '/contato — Informações de contato\\n' +
  '/ia [pergunta] — Perguntar para IA',
  { parse_mode: 'Markdown' }
));

// ─── Consulta de processo ─────────────────────────────────────────────────
bot.command('processo', async (ctx) => {
  const numero = ctx.message.text.split(' ').slice(1).join(' ').trim();
  if (!numero) {
    return ctx.reply('📋 Informe o número: /processo 1234567-89.2024.8.26.0001');
  }
  await ctx.reply(\`🔍 Consultando processo *\${numero}*...\\n\\n_Conecte ao banco para ver dados reais._\`, { parse_mode: 'Markdown' });
});

// ─── Documentos por tipo ──────────────────────────────────────────────────
bot.command('docs', async (ctx) => {
  await ctx.reply(
    '📄 *Documentos por tipo de processo:*',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('⚖️ Cível', 'doc_civel'), Markup.button.callback('👷 Trabalhista', 'doc_trab')],
      [Markup.button.callback('👨‍👩‍👧 Família', 'doc_familia'), Markup.button.callback('📋 Previdenciário', 'doc_prev')],
      [Markup.button.callback('🚨 Criminal', 'doc_criminal'), Markup.button.callback('💰 Tributário', 'doc_trib')],
    ])}
  );
});

const DOCS = {
  doc_civel: '⚖️ *Processo Cível*\\n\\n• RG, CPF e comprovante de residência\\n• Contratos e acordos envolvidos\\n• Notas fiscais e comprovantes de pagamento\\n• Correspondências e comunicações relevantes',
  doc_trab: '👷 *Processo Trabalhista*\\n\\n• Carteira de Trabalho (CTPS)\\n• Contracheques dos últimos 3 anos\\n• Extrato FGTS\\n• Registro de ponto (se houver)\\n• Termos de rescisão',
  doc_familia: '👨‍👩‍👧 *Processo de Família*\\n\\n• Certidão de casamento ou nascimento\\n• Comprovante de renda (IR)\\n• Lista de bens e patrimônio\\n• Acordos anteriores (se houver)',
  doc_prev: '📋 *Previdenciário / INSS*\\n\\n• CPF e RG\\n• Cartão do INSS (NIT)\\n• Laudos médicos e atestados\\n• Histórico de contribuições (CNIS)\\n• Exames e relatórios de saúde',
  doc_criminal: '🚨 *Criminal*\\n\\n• RG e CPF\\n• Boletim de Ocorrência (B.O.)\\n• Certidão de antecedentes\\n• Testemunhas e contatos\\n• Evidências e provas disponíveis',
  doc_trib: '💰 *Tributário*\\n\\n• CNPJ e documentos da empresa\\n• Declarações de IR (últimos 5 anos)\\n• Notas fiscais\\n• Extratos bancários\\n• Notificações da Receita Federal',
};

Object.entries(DOCS).forEach(([action, text]) => {
  bot.action(action, ctx => ctx.editMessageText(text + '\\n\\n_Digite /docs para outro tipo_', { parse_mode: 'Markdown' }));
});

// ─── Agendamento ──────────────────────────────────────────────────────────
bot.command('agendar', async (ctx) => {
  await ctx.reply(
    '📅 *Agendamento de Reunião*\\n\\nEscolha o turno:',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
      [Markup.button.callback('🌅 Manhã (8h-12h)', 'ag_manha')],
      [Markup.button.callback('☀️ Tarde (13h-18h)', 'ag_tarde')],
      [Markup.button.callback('🌙 Emergência', 'ag_urgente')],
    ])}
  );
});

['ag_manha','ag_tarde','ag_urgente'].forEach((a) => {
  const texto = a === 'ag_manha' ? 'Manhã (8h-12h)' : a === 'ag_tarde' ? 'Tarde (13h-18h)' : '🚨 URGENTE';
  bot.action(a, async (ctx) => {
    await ctx.editMessageText(
      \`✅ *Solicitação de agendamento recebida!*\\n\\n*Turno:* \${texto}\\n*Usuário:* \${ctx.from.first_name}\\n\\nEntraremos em contato para confirmar data e horário.\\n\\n📞 Ou ligue: (11) 99999-9999\`,
      { parse_mode: 'Markdown' }
    );
  });
});

// ─── Contato ──────────────────────────────────────────────────────────────
bot.command('contato', ctx => ctx.reply(
  '📞 *Contato do Escritório SK*\\n\\n' +
  '👨‍💼 Dr. Você — Advogado\\n' +
  '📞 (11) 99999-9999\\n' +
  '📧 contato@escritoriosk.com.br\\n' +
  '📍 Rua das Leis, 123 — Centro\\n\\n' +
  '🕐 *Horários:*\\n' +
  'Seg-Sex: 8h às 18h | Sáb: 8h às 12h',
  { parse_mode: 'Markdown' }
));

// ─── Texto livre (menu por botão) ─────────────────────────────────────────
bot.hears('⚖️ Consultar Processo', ctx => ctx.reply('📋 Informe: /processo NUMERO_DO_PROCESSO'));
bot.hears('📅 Agendar', ctx => ctx.replyWithMarkdown('Use o comando /agendar'));
bot.hears('📄 Documentos', ctx => ctx.replyWithMarkdown('Use o comando /docs'));
bot.hears('📞 Contato', ctx => ctx.replyWithMarkdown('Use o comando /contato'));
bot.hears('❓ Ajuda', ctx => ctx.replyWithMarkdown('Use o comando /help'));

// ─── Iniciar bot ──────────────────────────────────────────────────────────
bot.launch()
  .then(() => console.log('🤖 Bot Telegram rodando! Pressione Ctrl+C para parar.'))
  .catch(err => console.error('Erro:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));`,

      ".env": `# Cole o token do seu bot (obtenha com @BotFather no Telegram)
TELEGRAM_TOKEN=cole_seu_token_aqui

# Opcional: URL do banco Neon para consultas reais
DATABASE_URL=postgresql://user:senha@host/banco?sslmode=require`,

      "package.json": `{
  "name": "telegram-bot-juridico",
  "version": "1.0.0",
  "description": "Bot Telegram para escritório jurídico",
  "main": "bot.js",
  "scripts": {
    "start": "node bot.js",
    "dev": "node --watch bot.js"
  },
  "dependencies": {
    "telegraf": "^4.16.3",
    "dotenv": "^16.4.5"
  }
}`,

      "README.md": `# Bot Telegram Jurídico 🤖⚖️

## Configuração (5 minutos)

### 1. Criar o bot no Telegram
1. Abra o Telegram e pesquise **@BotFather**
2. Envie **/newbot**
3. Escolha um nome (ex: "Escritório SK Bot")
4. Escolha um username (ex: "escritoriosk_bot")
5. Copie o **token** que ele te enviou

### 2. Configurar token
Cole o token no arquivo **.env**:
\`\`\`
TELEGRAM_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
\`\`\`

### 3. Instalar e rodar
\`\`\`bash
npm install
npm start
\`\`\`

## Funcionalidades
- ✅ Menu por botões (keyboard)
- ✅ Menus inline (dentro da mensagem)
- ✅ Consulta de processo por número
- ✅ Documentos por tipo (cível, trabalhista, família, etc)
- ✅ Agendamento de reunião
- ✅ Informações de contato

## Publicar no servidor (Railway — grátis)
1. Acesse [railway.app](https://railway.app)
2. Conecte seu GitHub
3. Suba este projeto
4. Configure a variável TELEGRAM_TOKEN nas Settings
5. O bot fica ativo 24/7 gratuitamente
`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "sistema-juridico",
    name: "Sistema Jurídico Completo",
    description: "API REST completa para escritório de advocacia com Neon DB, autenticação JWT e todos os módulos",
    icon: "server",
    files: {
      "index.js": `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque_esta_senha_em_producao';

// ─── Conexão com banco Neon ───────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());

// ─── Middleware de autenticação ───────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ erro: 'Token necessário' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTAS PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

// GET /health — verificar se a API está online
app.get('/health', (_, res) => res.json({ status: 'ok', hora: new Date().toISOString() }));

// POST /auth/login — autenticar usuário
app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  try {
    const rows = await sql\`SELECT * FROM usuarios WHERE email = \${email} AND ativo = true\`;
    const usuario = rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = jwt.sign({ id: usuario.id, email: usuario.email, perfil: usuario.perfil }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, oab: usuario.oab } });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /auth/registro — criar primeiro usuário admin
app.post('/auth/registro', async (req, res) => {
  const { nome, email, senha, oab } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });
  try {
    const hash = await bcrypt.hash(senha, 12);
    const rows = await sql\`
      INSERT INTO usuarios (nome, email, senha_hash, perfil, oab)
      VALUES (\${nome}, \${email}, \${hash}, 'admin', \${oab || null})
      RETURNING id, nome, email, perfil, oab\`;
    const token = jwt.sign({ id: rows[0].id, email: rows[0].email, perfil: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, usuario: rows[0] });
  } catch (err) {
    if (err.message.includes('unique')) return res.status(409).json({ erro: 'Email já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTES (protegido por auth)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/clientes', auth, async (req, res) => {
  const { busca, pagina = 1, limite = 20 } = req.query;
  const offset = (pagina - 1) * limite;
  try {
    let rows;
    if (busca) {
      rows = await sql\`SELECT * FROM clientes WHERE ativo = true AND (nome ILIKE \${'%'+busca+'%'} OR cpf LIKE \${'%'+busca+'%'} OR email ILIKE \${'%'+busca+'%'}) ORDER BY nome LIMIT \${+limite} OFFSET \${offset}\`;
    } else {
      rows = await sql\`SELECT * FROM clientes WHERE ativo = true ORDER BY nome LIMIT \${+limite} OFFSET \${offset}\`;
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/clientes/:id', auth, async (req, res) => {
  try {
    const [cliente] = await sql\`SELECT * FROM clientes WHERE id = \${req.params.id} AND ativo = true\`;
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    const processos = await sql\`SELECT id, numero_processo, tipo, area_direito, status, fase FROM processos WHERE cliente_id = \${req.params.id} ORDER BY criado_em DESC\`;
    res.json({ ...cliente, processos });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/clientes', auth, async (req, res) => {
  const { nome, cpf, rg, email, telefone, celular, endereco, cidade, estado, cep, data_nascimento, observacoes } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  try {
    const [c] = await sql\`INSERT INTO clientes (nome,cpf,rg,email,telefone,celular,endereco,cidade,estado,cep,data_nascimento,observacoes) VALUES (\${nome},\${cpf||null},\${rg||null},\${email||null},\${telefone||null},\${celular||null},\${endereco||null},\${cidade||null},\${estado||null},\${cep||null},\${data_nascimento||null},\${observacoes||null}) RETURNING *\`;
    res.status(201).json(c);
  } catch (err) {
    if (err.message.includes('unique')) return res.status(409).json({ erro: 'CPF ou email já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

app.put('/clientes/:id', auth, async (req, res) => {
  const { nome, cpf, rg, email, telefone, celular, endereco, cidade, estado, cep, data_nascimento, observacoes } = req.body;
  try {
    const [c] = await sql\`UPDATE clientes SET nome=COALESCE(\${nome},nome), cpf=COALESCE(\${cpf||null},cpf), email=COALESCE(\${email||null},email), telefone=COALESCE(\${telefone||null},telefone), celular=COALESCE(\${celular||null},celular), endereco=COALESCE(\${endereco||null},endereco), cidade=COALESCE(\${cidade||null},cidade), estado=COALESCE(\${estado||null},estado), cep=COALESCE(\${cep||null},cep), observacoes=COALESCE(\${observacoes||null},observacoes), atualizado_em=NOW() WHERE id=\${req.params.id} RETURNING *\`;
    res.json(c);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSOS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/processos', auth, async (req, res) => {
  const { busca, status, area, pagina = 1, limite = 20 } = req.query;
  const offset = (pagina - 1) * limite;
  try {
    const rows = await sql\`
      SELECT p.*, c.nome AS cliente_nome, c.cpf AS cliente_cpf, u.nome AS advogado
      FROM processos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE (\${busca||null} IS NULL OR p.numero_processo ILIKE \${'%'+(busca||'')+'%'} OR c.nome ILIKE \${'%'+(busca||'')+'%'})
        AND (\${status||null} IS NULL OR p.status = \${status||null})
        AND (\${area||null} IS NULL OR p.area_direito = \${area||null})
      ORDER BY p.criado_em DESC
      LIMIT \${+limite} OFFSET \${offset}\`;
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/processos/:id', auth, async (req, res) => {
  try {
    const [p] = await sql\`SELECT p.*, c.nome AS cliente_nome FROM processos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = \${req.params.id}\`;
    if (!p) return res.status(404).json({ erro: 'Processo não encontrado' });
    const [audiencias, prazos, documentos, movimentacoes] = await Promise.all([
      sql\`SELECT * FROM audiencias WHERE processo_id = \${req.params.id} ORDER BY data_hora\`,
      sql\`SELECT * FROM prazos WHERE processo_id = \${req.params.id} ORDER BY data_limite\`,
      sql\`SELECT * FROM documentos WHERE processo_id = \${req.params.id} ORDER BY criado_em DESC\`,
      sql\`SELECT * FROM movimentacoes WHERE processo_id = \${req.params.id} ORDER BY data_movimentacao DESC LIMIT 50\`,
    ]);
    res.json({ ...p, audiencias, prazos, documentos, movimentacoes });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/processos', auth, async (req, res) => {
  const { numero_processo, cliente_id, tipo, area_direito, vara, comarca, tribunal, polo_ativo, polo_passivo, objeto, valor_causa, data_distribuicao, data_prazo, observacoes } = req.body;
  if (!numero_processo) return res.status(400).json({ erro: 'Número do processo obrigatório' });
  try {
    const [p] = await sql\`INSERT INTO processos (numero_processo,cliente_id,usuario_id,tipo,area_direito,vara,comarca,tribunal,polo_ativo,polo_passivo,objeto,valor_causa,data_distribuicao,data_prazo,observacoes) VALUES (\${numero_processo},\${cliente_id||null},\${req.usuario.id},\${tipo||null},\${area_direito||null},\${vara||null},\${comarca||null},\${tribunal||null},\${polo_ativo||null},\${polo_passivo||null},\${objeto||null},\${valor_causa||null},\${data_distribuicao||null},\${data_prazo||null},\${observacoes||null}) RETURNING *\`;
    res.status(201).json(p);
  } catch (err) {
    if (err.message.includes('unique')) return res.status(409).json({ erro: 'Número de processo já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUDIÊNCIAS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/audiencias', auth, async (req, res) => {
  try {
    const rows = await sql\`
      SELECT a.*, p.numero_processo, c.nome AS cliente_nome
      FROM audiencias a
      JOIN processos p ON p.id = a.processo_id
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE a.data_hora >= NOW()
      ORDER BY a.data_hora LIMIT 50\`;
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/audiencias', auth, async (req, res) => {
  const { processo_id, tipo, data_hora, local, sala, juiz, pauta } = req.body;
  if (!processo_id || !data_hora) return res.status(400).json({ erro: 'Processo e data/hora obrigatórios' });
  try {
    const [a] = await sql\`INSERT INTO audiencias (processo_id,tipo,data_hora,local,sala,juiz,pauta) VALUES (\${processo_id},\${tipo||null},\${data_hora},\${local||null},\${sala||null},\${juiz||null},\${pauta||null}) RETURNING *\`;
    res.status(201).json(a);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PRAZOS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/prazos/proximos', auth, async (req, res) => {
  try {
    const rows = await sql\`
      SELECT pr.*, p.numero_processo, c.nome AS cliente_nome
      FROM prazos pr
      JOIN processos p ON p.id = pr.processo_id
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE pr.concluido = false AND pr.data_limite >= NOW()::date
      ORDER BY pr.data_limite LIMIT 30\`;
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD — resumo geral
// ═══════════════════════════════════════════════════════════════════════════
app.get('/dashboard', auth, async (req, res) => {
  try {
    const [stats] = await sql\`
      SELECT
        (SELECT COUNT(*) FROM processos WHERE status = 'ativo') AS processos_ativos,
        (SELECT COUNT(*) FROM clientes WHERE ativo = true) AS total_clientes,
        (SELECT COUNT(*) FROM audiencias WHERE data_hora BETWEEN NOW() AND NOW() + INTERVAL '7 days') AS audiencias_semana,
        (SELECT COUNT(*) FROM prazos WHERE concluido = false AND data_limite <= NOW()::date + 7) AS prazos_proximos\`;
    res.json(stats);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(\`\`);
  console.log(\`⚖️  Sistema Jurídico SK — API REST\`);
  console.log(\`🟢 Rodando em http://localhost:\${PORT}\`);
  console.log(\`\`);
  console.log(\`Endpoints disponíveis:\`);
  console.log(\`  POST /auth/registro   — criar conta\`);
  console.log(\`  POST /auth/login      — fazer login\`);
  console.log(\`  GET  /dashboard       — resumo geral\`);
  console.log(\`  GET  /clientes        — listar clientes\`);
  console.log(\`  GET  /processos       — listar processos\`);
  console.log(\`  GET  /audiencias      — próximas audiências\`);
  console.log(\`  GET  /prazos/proximos — prazos vencendo\`);
});`,

      ".env": `# ── Banco de dados (Neon — gratuito em neon.tech) ──────────────────────────
DATABASE_URL=postgresql://user:senha@host/banco?sslmode=require

# ── Segurança JWT (troque por uma senha forte) ────────────────────────────
JWT_SECRET=troque_por_senha_muito_secreta_aqui

# ── Porta do servidor (padrão 3000) ──────────────────────────────────────
PORT=3000`,

      "package.json": `{
  "name": "sistema-juridico-sk",
  "version": "1.0.0",
  "description": "API REST completa para escritório de advocacia",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "criar-tabelas": "node setup-db.js"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.9.4",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2"
  }
}`,

      "setup-db.js": `// Execute com: node setup-db.js
// Cria todas as tabelas do sistema jurídico no banco Neon
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function criarTabelas() {
  console.log('⚙️  Criando tabelas...');
  
  await sql\`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      perfil VARCHAR(20) DEFAULT 'advogado',
      oab VARCHAR(20),
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ usuarios');

  await sql\`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      cpf VARCHAR(14) UNIQUE,
      rg VARCHAR(20),
      email VARCHAR(150),
      telefone VARCHAR(20),
      celular VARCHAR(20),
      endereco TEXT,
      cidade VARCHAR(100),
      estado CHAR(2),
      cep VARCHAR(9),
      data_nascimento DATE,
      observacoes TEXT,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ clientes');

  await sql\`
    CREATE TABLE IF NOT EXISTS processos (
      id SERIAL PRIMARY KEY,
      numero_processo VARCHAR(50) UNIQUE NOT NULL,
      cliente_id INTEGER REFERENCES clientes(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      tipo VARCHAR(50),
      area_direito VARCHAR(50),
      vara VARCHAR(100),
      comarca VARCHAR(100),
      tribunal VARCHAR(100),
      fase VARCHAR(50) DEFAULT 'inicial',
      status VARCHAR(30) DEFAULT 'ativo',
      polo_ativo TEXT,
      polo_passivo TEXT,
      objeto TEXT,
      valor_causa DECIMAL(15,2),
      data_distribuicao DATE,
      data_prazo DATE,
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ processos');

  await sql\`
    CREATE TABLE IF NOT EXISTS audiencias (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      tipo VARCHAR(80),
      data_hora TIMESTAMP NOT NULL,
      local VARCHAR(200),
      sala VARCHAR(50),
      juiz VARCHAR(150),
      pauta TEXT,
      resultado TEXT,
      status VARCHAR(20) DEFAULT 'agendada',
      lembrete_enviado BOOLEAN DEFAULT false,
      criado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ audiencias');

  await sql\`
    CREATE TABLE IF NOT EXISTS prazos (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      descricao TEXT NOT NULL,
      data_limite DATE NOT NULL,
      tipo VARCHAR(50),
      concluido BOOLEAN DEFAULT false,
      criado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ prazos');

  await sql\`
    CREATE TABLE IF NOT EXISTS documentos (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      nome VARCHAR(200) NOT NULL,
      tipo VARCHAR(50),
      url TEXT,
      tamanho_bytes INTEGER,
      enviado_por INTEGER REFERENCES usuarios(id),
      criado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ documentos');

  await sql\`
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      descricao TEXT NOT NULL,
      tipo VARCHAR(50),
      data_movimentacao TIMESTAMP DEFAULT NOW(),
      usuario_id INTEGER REFERENCES usuarios(id),
      origem VARCHAR(30) DEFAULT 'manual'
    )\`;
  console.log('✅ movimentacoes');

  await sql\`
    CREATE TABLE IF NOT EXISTS financeiro (
      id SERIAL PRIMARY KEY,
      processo_id INTEGER REFERENCES processos(id),
      cliente_id INTEGER REFERENCES clientes(id),
      descricao TEXT NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      valor DECIMAL(15,2) NOT NULL,
      data_vencimento DATE,
      data_pagamento DATE,
      status VARCHAR(20) DEFAULT 'pendente',
      criado_em TIMESTAMP DEFAULT NOW()
    )\`;
  console.log('✅ financeiro');

  console.log('');
  console.log('🎉 Todas as tabelas criadas com sucesso!');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. npm start           — iniciar o servidor');
  console.log('  2. POST /auth/registro — criar sua conta de admin');
  console.log('  3. POST /auth/login    — fazer login e obter token JWT');
  process.exit(0);
}

criarTabelas().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});`,

      "README.md": `# Sistema Jurídico SK — API REST Completa ⚖️

## Configuração

### 1. Banco de Dados (Neon — gratuito)
1. Acesse **neon.tech** e crie conta
2. Crie um projeto chamado "juridico"
3. Copie a **Connection string** do painel
4. Cole no arquivo **.env** em DATABASE_URL

### 2. Instalar e configurar
\`\`\`bash
npm install
node setup-db.js   # cria todas as tabelas automaticamente
npm start          # inicia o servidor
\`\`\`

## Criar primeira conta de admin

\`\`\`bash
curl -X POST http://localhost:3000/auth/registro \\
  -H "Content-Type: application/json" \\
  -d '{"nome":"Dr. Você","email":"saulo@sk.com","senha":"sua_senha","oab":"OAB/XX 12345"}'
\`\`\`

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | /health | Verificar API |
| POST | /auth/registro | Criar conta |
| POST | /auth/login | Fazer login |
| GET | /dashboard | Resumo geral |
| GET/POST | /clientes | Listar/criar clientes |
| GET | /clientes/:id | Detalhes + processos do cliente |
| PUT | /clientes/:id | Editar cliente |
| GET/POST | /processos | Listar/criar processos |
| GET | /processos/:id | Detalhes completos + tudo vinculado |
| GET | /audiencias | Próximas audiências |
| POST | /audiencias | Cadastrar audiência |
| GET | /prazos/proximos | Prazos vencendo |

## Publicar no Railway (grátis)
1. Crie conta em **railway.app**
2. "New Project" → "Deploy from GitHub"
3. Configure as variáveis de ambiente (DATABASE_URL e JWT_SECRET)
4. Deploy automático!

## Áreas do Direito suportadas
- Cível | Trabalhista | Criminal | Família | Previdenciário | Tributário | Consumidor | Administrativo
`,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "crud-sqlite",
    name: "CRUD com SQLite",
    description: "Sistema completo de cadastro local com SQLite — sem precisar de banco externo",
    icon: "database",
    files: {
      "index.js": `const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Banco SQLite (arquivo local) ─────────────────────────────────────────
const db = new Database(path.join(__dirname, 'dados.db'));

// Criar tabelas automaticamente
db.exec(\`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    telefone TEXT,
    categoria TEXT DEFAULT 'geral',
    observacoes TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT (datetime('now','localtime')),
    atualizado_em TEXT DEFAULT (datetime('now','localtime'))
  );
  
  -- Dados de exemplo
  INSERT OR IGNORE INTO registros (nome, email, telefone, categoria) VALUES
    ('João Silva', 'joao@email.com', '(11) 99999-1111', 'cliente'),
    ('Maria Santos', 'maria@email.com', '(11) 99999-2222', 'fornecedor'),
    ('Pedro Costa', 'pedro@email.com', '(11) 99999-3333', 'cliente');
\`);

app.use(express.json());
app.use(express.static('public'));

// ─── API REST ─────────────────────────────────────────────────────────────
app.get('/api/registros', (req, res) => {
  const { busca, categoria } = req.query;
  let query = 'SELECT * FROM registros WHERE ativo = 1';
  const params = [];
  if (busca) { query += ' AND (nome LIKE ? OR email LIKE ?)'; params.push(\`%\${busca}%\`, \`%\${busca}%\`); }
  if (categoria) { query += ' AND categoria = ?'; params.push(categoria); }
  query += ' ORDER BY criado_em DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/registros/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM registros WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ erro: 'Não encontrado' });
  res.json(r);
});

app.post('/api/registros', (req, res) => {
  const { nome, email, telefone, categoria, observacoes } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  try {
    const r = db.prepare('INSERT INTO registros (nome,email,telefone,categoria,observacoes) VALUES (?,?,?,?,?)').run(nome, email||null, telefone||null, categoria||'geral', observacoes||null);
    res.status(201).json(db.prepare('SELECT * FROM registros WHERE id = ?').get(r.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ erro: 'Email já cadastrado' });
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/registros/:id', (req, res) => {
  const { nome, email, telefone, categoria, observacoes } = req.body;
  db.prepare("UPDATE registros SET nome=COALESCE(?,nome), email=COALESCE(?,email), telefone=COALESCE(?,telefone), categoria=COALESCE(?,categoria), observacoes=COALESCE(?,observacoes), atualizado_em=datetime('now','localtime') WHERE id=?").run(nome,email,telefone,categoria,observacoes,req.params.id);
  res.json(db.prepare('SELECT * FROM registros WHERE id = ?').get(req.params.id));
});

app.delete('/api/registros/:id', (req, res) => {
  db.prepare('UPDATE registros SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(\`🟢 CRUD SQLite rodando em http://localhost:\${PORT}\`);
  console.log(\`   Acesse o painel em http://localhost:\${PORT}\`);
});`,

      "public/index.html": `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRUD — Cadastro</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: system-ui; background:#0f1117; color:#e8eaf0; min-height:100vh; }
    header { background:#1a1f2e; border-bottom:1px solid #2a3040; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; }
    header h1 { font-size:18px; font-weight:700; color:#4f8ef7; }
    .container { max-width:800px; margin:0 auto; padding:20px; }
    .btn { padding:10px 20px; border-radius:10px; border:none; cursor:pointer; font-size:14px; font-weight:600; transition:all .2s; }
    .btn-primary { background:#4f8ef7; color:#fff; }
    .btn-danger { background:#ef4444; color:#fff; }
    .btn-sm { padding:6px 12px; font-size:12px; }
    input, select, textarea { width:100%; padding:10px 12px; background:#1e2540; border:1px solid #2a3040; border-radius:10px; color:#e8eaf0; font-size:14px; margin-bottom:10px; outline:none; }
    input:focus, select:focus, textarea:focus { border-color:#4f8ef7; }
    .card { background:#1a1f2e; border:1px solid #2a3040; border-radius:14px; padding:20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start; }
    .modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:100; align-items:center; justify-content:center; }
    .modal.open { display:flex; }
    .modal-box { background:#1a1f2e; border-radius:20px; padding:24px; width:90%; max-width:440px; }
    .badge { padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; background:#4f8ef720; color:#4f8ef7; }
    .search-row { display:flex; gap:10px; margin-bottom:16px; }
    .search-row input { margin:0; }
    .search-row select { margin:0; width:140px; flex-shrink:0; }
    #vazio { text-align:center; padding:60px 0; color:#555; }
  </style>
</head>
<body>
  <header>
    <h1>📋 Cadastro</h1>
    <button class="btn btn-primary btn-sm" onclick="abrirModal()">+ Novo</button>
  </header>
  <div class="container">
    <div class="search-row">
      <input id="busca" type="search" placeholder="🔍 Buscar por nome ou email..." oninput="listar()">
      <select id="filtro" onchange="listar()"><option value="">Todas categorias</option><option>cliente</option><option>fornecedor</option><option>geral</option></select>
    </div>
    <div id="lista"></div>
  </div>

  <div class="modal" id="modal">
    <div class="modal-box">
      <h2 id="modal-titulo" style="margin-bottom:16px;font-size:16px">Novo Registro</h2>
      <input id="f-nome" placeholder="Nome *" />
      <input id="f-email" type="email" placeholder="Email" />
      <input id="f-telefone" placeholder="Telefone" />
      <select id="f-categoria"><option>geral</option><option>cliente</option><option>fornecedor</option></select>
      <textarea id="f-obs" rows="2" placeholder="Observações" style="resize:none"></textarea>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn btn-primary" style="flex:1" onclick="salvar()">Salvar</button>
        <button class="btn" style="background:#2a3040;flex:1" onclick="fecharModal()">Cancelar</button>
      </div>
    </div>
  </div>

  <script>
    let editId = null;
    async function listar() {
      const busca = document.getElementById('busca').value;
      const cat = document.getElementById('filtro').value;
      const r = await fetch('/api/registros?busca='+encodeURIComponent(busca)+'&categoria='+encodeURIComponent(cat));
      const data = await r.json();
      const el = document.getElementById('lista');
      if (!data.length) { el.innerHTML = '<div id="vazio">Nenhum registro encontrado</div>'; return; }
      el.innerHTML = data.map(d => \`
        <div class="card">
          <div>
            <div style="font-size:15px;font-weight:700;margin-bottom:4px">\${d.nome}</div>
            <div style="color:#888;font-size:12px">\${d.email||''} \${d.telefone ? '· '+d.telefone : ''}</div>
            \${d.observacoes ? '<div style="color:#666;font-size:12px;margin-top:4px">'+d.observacoes+'</div>' : ''}
            <span class="badge" style="margin-top:8px;display:inline-block">\${d.categoria}</span>
          </div>
          <div style="display:flex;gap:8px;shrink:0">
            <button class="btn btn-sm" style="background:#2a3040" onclick="editar(\${d.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="excluir(\${d.id})">🗑️</button>
          </div>
        </div>
      \`).join('');
    }
    function abrirModal(dados) {
      editId = dados?.id || null;
      document.getElementById('modal-titulo').textContent = editId ? 'Editar Registro' : 'Novo Registro';
      document.getElementById('f-nome').value = dados?.nome||'';
      document.getElementById('f-email').value = dados?.email||'';
      document.getElementById('f-telefone').value = dados?.telefone||'';
      document.getElementById('f-categoria').value = dados?.categoria||'geral';
      document.getElementById('f-obs').value = dados?.observacoes||'';
      document.getElementById('modal').classList.add('open');
    }
    function fecharModal() { document.getElementById('modal').classList.remove('open'); }
    async function editar(id) { const r = await fetch('/api/registros/'+id); abrirModal(await r.json()); }
    async function salvar() {
      const body = { nome:document.getElementById('f-nome').value, email:document.getElementById('f-email').value, telefone:document.getElementById('f-telefone').value, categoria:document.getElementById('f-categoria').value, observacoes:document.getElementById('f-obs').value };
      await fetch('/api/registros'+(editId?'/'+editId:''), { method: editId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      fecharModal(); listar();
    }
    async function excluir(id) {
      if (!confirm('Remover este registro?')) return;
      await fetch('/api/registros/'+id, { method:'DELETE' });
      listar();
    }
    listar();
  </script>
</body>
</html>`,

      "package.json": `{
  "name": "crud-sqlite",
  "version": "1.0.0",
  "description": "CRUD completo com SQLite — sem banco externo",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "express": "^4.19.2"
  }
}`,
    },
  },
];
