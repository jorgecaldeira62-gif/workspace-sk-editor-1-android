import { useState, useRef, useEffect, useCallback } from "react";
import { VirtualFileSystem } from "@/lib/virtual-fs";
import { Search } from "lucide-react";

interface TerminalProps {
  vfs: VirtualFileSystem;
  externalCommand?: string;
  onCommandExecuted?: () => void;
  onServerToggle?: (running: boolean, port?: number) => void;
  onGitClone?: (owner: string, repo: string) => Promise<void>;
  onCommandOutput?: (cmd: string, output: string, ok: boolean) => void;
  onBufferUpdate?: (buffer: string, hasError: boolean) => void;
}

interface TerminalLine {
  type: "input" | "output" | "error" | "info" | "success" | "warn";
  content: string;
}

const YOUTUBE_GUIDE = `
╔══════════════════════════════════════╗
║      GUIA: DOWNLOAD YOUTUBE/MEDIA    ║
╚══════════════════════════════════════╝

Para baixar videos/audio do YouTube no Node.js:

📦 Instalar dependencia:
   npm install ytdl-core

📄 Criar download.js:
   const ytdl = require('ytdl-core');
   const fs = require('fs');

   const url = 'https://www.youtube.com/watch?v=SEU_VIDEO_ID';

   // Baixar audio (MP3):
   ytdl(url, { quality: 'lowestaudio' })
     .pipe(fs.createWriteStream('audio.mp4'));

   // Baixar video (MP4):
   ytdl(url, { quality: 'highest' })
     .pipe(fs.createWriteStream('video.mp4'));

   // Obter informacoes do video:
   ytdl.getInfo(url).then(info => {
     console.log('Titulo:', info.videoDetails.title);
     console.log('Duracao:', info.videoDetails.lengthSeconds + 's');
     console.log('Autor:', info.videoDetails.author.name);
   });

🎵 Para converter para MP3 (com fluent-ffmpeg):
   npm install fluent-ffmpeg ytdl-core
   const ffmpeg = require('fluent-ffmpeg');
   const ytdl = require('ytdl-core');

   ffmpeg(ytdl(url, { quality: 'lowestaudio' }))
     .audioBitrate(128)
     .save('audio.mp3')
     .on('end', () => console.log('MP3 salvo!'));

📊 Para analisar conteudo (transcricao):
   Use a API do YouTube Data:
   npm install googleapis
   ou: pip install youtube-transcript-api (Python)

🌐 Alternativas online (sem backend):
   - yt-dlp (Python): pip install yt-dlp
   - youtube-dl: mais antigo

💡 Use "youtube setup" para criar o projeto completo automaticamente!
`;

const DB_GUIDE = `
╔══════════════════════════════════════╗
║         GUIA DE BANCO DE DADOS       ║
╚══════════════════════════════════════╝

Para usar banco de dados no seu projeto:

📦 SQLite (mais simples - no arquivo):
   npm install better-sqlite3
   Crie db.js:
   \`\`\`
   const db = require('better-sqlite3')('app.db');
   db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
   const insert = db.prepare('INSERT INTO users (name) VALUES (?)');
   insert.run('Joao');
   const rows = db.prepare('SELECT * FROM users').all();
   console.log(rows);
   \`\`\`

🐘 PostgreSQL:
   npm install pg
   Crie db.js:
   \`\`\`
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   const res = await pool.query('SELECT NOW()');
   \`\`\`

🍃 MongoDB:
   npm install mongoose
   \`\`\`
   const mongoose = require('mongoose');
   await mongoose.connect(process.env.MONGODB_URI);
   \`\`\`

🔥 Firebase Firestore:
   npm install firebase
   \`\`\`
   import { initializeApp } from 'firebase/app';
   import { getFirestore, collection, addDoc } from 'firebase/firestore';
   \`\`\`

☁️ Neon (PostgreSQL na nuvem - gratuito):
   1. Crie conta em: console.neon.tech
   2. Crie um banco de dados
   3. Copie a connection string (DATABASE_URL)
   4. npm install pg
   5. Use: const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: true })

💡 Use "db <tipo>" para criar template automatico:
   db sqlite | db postgres | db mongo | db firebase | db neon | db supabase
`;

const PACKAGES_DB: Record<string, { version: string; description: string; files?: Record<string, string> }> = {
  express: { version: "4.21.2", description: "Framework web rapido e minimalista para Node.js" },
  react: { version: "18.3.1", description: "Biblioteca para construir interfaces de usuario" },
  "react-dom": { version: "18.3.1", description: "Renderizador DOM para React" },
  axios: { version: "1.7.9", description: "Cliente HTTP baseado em Promises" },
  lodash: { version: "4.17.21", description: "Biblioteca utilitaria JavaScript" },
  moment: { version: "2.30.1", description: "Biblioteca para manipulacao de datas" },
  cors: { version: "2.8.5", description: "Middleware CORS para Express" },
  "body-parser": { version: "1.20.3", description: "Middleware para parsear body HTTP" },
  mongoose: { version: "8.9.5", description: "ODM elegante para MongoDB" },
  pg: { version: "8.13.1", description: "Cliente PostgreSQL para Node.js" },
  "better-sqlite3": { version: "11.7.0", description: "API SQLite3 rapida e simples" },
  dotenv: { version: "16.4.7", description: "Carrega variaveis de ambiente de .env" },
  jsonwebtoken: { version: "9.0.2", description: "Implementacao de JSON Web Tokens" },
  bcryptjs: { version: "2.4.3", description: "Biblioteca de hashing de senha" },
  socket_io: { version: "4.8.1", description: "Comunicacao em tempo real bidirecional" },
  "socket.io": { version: "4.8.1", description: "Comunicacao em tempo real bidirecional" },
  nodemon: { version: "3.1.9", description: "Reinicia automaticamente apps Node.js" },
  webpack: { version: "5.97.1", description: "Empacotador de modulos JavaScript" },
  babel: { version: "7.26.0", description: "Compilador JavaScript" },
  typescript: { version: "5.7.3", description: "JavaScript com tipagem estatica" },
  tailwindcss: { version: "3.4.17", description: "Framework CSS utility-first" },
  vite: { version: "6.0.7", description: "Ferramenta de build rapida para web" },
  jest: { version: "29.7.0", description: "Framework de testes JavaScript" },
  "next": { version: "15.1.6", description: "Framework React para producao" },
  "vue": { version: "3.5.13", description: "Framework JavaScript progressivo" },
  "svelte": { version: "5.19.0", description: "Framework UI compilado" },
  firebase: { version: "11.2.0", description: "SDK Firebase para web" },
  "chart.js": { version: "4.4.7", description: "Biblioteca de graficos simples e flexivel" },
  "three": { version: "0.171.0", description: "Biblioteca 3D para JavaScript" },
  "d3": { version: "7.9.0", description: "Documentos orientados por dados" },
  "uuid": { version: "11.0.5", description: "Geracao de UUID" },
  "zod": { version: "3.24.1", description: "Validacao de schema TypeScript-first" },
  "date-fns": { version: "4.1.0", description: "Utilitarios modernos para datas JavaScript" },
  "ytdl-core": { version: "4.11.5", description: "Downloader de YouTube para Node.js" },
  "fluent-ffmpeg": { version: "2.1.3", description: "Wrapper do FFmpeg para Node.js" },
  "googleapis": { version: "144.0.0", description: "APIs do Google para Node.js" },
  "sharp": { version: "0.33.5", description: "Processamento de imagens de alta performance" },
  "multer": { version: "2.0.0", description: "Middleware para upload de arquivos" },
  "nodemailer": { version: "6.10.0", description: "Envio de emails com Node.js" },
  "stripe": { version: "17.5.0", description: "SDK do Stripe para pagamentos" },
  "openai": { version: "4.77.0", description: "SDK oficial da OpenAI para Node.js" },
  "@anthropic-ai/sdk": { version: "0.36.3", description: "SDK da Anthropic para Node.js" },
  "telegraf": { version: "4.16.3", description: "Framework moderno de bots Telegram" },
  "discord.js": { version: "14.18.0", description: "SDK do Discord para Node.js" },
  "whatsapp-web.js": { version: "1.26.1", description: "API nao oficial do WhatsApp" },
  "puppeteer": { version: "23.11.1", description: "Automacao de Chrome/Chromium" },
  "cheerio": { version: "1.0.0", description: "Parsing de HTML no servidor" },
  "playwright": { version: "1.49.1", description: "Automacao de browser cross-browser" },
  "sequelize": { version: "6.37.5", description: "ORM multi-banco para Node.js" },
  "typeorm": { version: "0.3.20", description: "ORM TypeScript para Node.js" },
  "prisma": { version: "6.2.1", description: "ORM moderno para Node.js com TypeScript" },
  "@supabase/supabase-js": { version: "2.47.10", description: "SDK do Supabase para JavaScript" },
  "ioredis": { version: "5.4.2", description: "Cliente Redis robusto para Node.js" },
  "bull": { version: "4.16.5", description: "Fila de jobs com Redis" },
  "passport": { version: "0.7.0", description: "Autenticacao para Node.js" },
  "express-validator": { version: "7.2.1", description: "Validacao de dados para Express" },
  "helmet": { version: "8.0.0", description: "Seguranca HTTP para Express" },
  "rate-limiter-flexible": { version: "5.0.4", description: "Rate limiting flexivel" },
  "compression": { version: "1.8.0", description: "Compressao gzip para Express" },
  "morgan": { version: "1.10.0", description: "Logger HTTP para Node.js" },
  "winston": { version: "3.17.0", description: "Logger versatil para Node.js" },
  "pino": { version: "9.6.0", description: "Logger rapido para Node.js" },
  "pm2": { version: "5.4.3", description: "Gerenciador de processos para Node.js" },
  "joi": { version: "17.13.3", description: "Validacao de objetos JavaScript" },
  "yup": { version: "1.6.1", description: "Validacao de schema JavaScript" },
  "luxon": { version: "3.5.0", description: "Biblioteca de datas moderna" },
  "nanoid": { version: "5.1.2", description: "Gerador de IDs pequenos e seguros" },
  "slugify": { version: "1.6.6", description: "Cria slugs de strings" },
  "marked": { version: "15.0.6", description: "Parser de Markdown rapido" },
  "pdf-lib": { version: "1.17.1", description: "Criacao e modificacao de PDFs" },
  "exceljs": { version: "4.4.0", description: "Criacao de planilhas Excel" },
  "csv-parser": { version: "3.0.0", description: "Parser de arquivos CSV" },
  "archiver": { version: "7.0.1", description: "Criacao de arquivos ZIP/TAR" },
  "chokidar": { version: "4.0.3", description: "Watcher de sistema de arquivos" },
  "dotenv-safe": { version: "9.1.0", description: "dotenv com validacao de variaveis obrigatorias" },
  "cross-env": { version: "7.0.3", description: "Variaveis de ambiente cross-platform" },
  "concurrently": { version: "9.1.2", description: "Executa multiplos comandos simultaneamente" },
  "husky": { version: "9.1.7", description: "Git hooks faceis" },
  "lint-staged": { version: "15.4.3", description: "Linting em arquivos staged" },
  "eslint": { version: "9.18.0", description: "Linter para JavaScript/TypeScript" },
  "prettier": { version: "3.4.2", description: "Formatador de codigo" },
  "vitest": { version: "3.0.4", description: "Framework de testes rapido para Vite" },
  "supertest": { version: "7.0.0", description: "Testes HTTP para Node.js" },
  "@testing-library/react": { version: "16.2.0", description: "Testes para componentes React" },
  "cypress": { version: "13.17.0", description: "Testes end-to-end para web" },
  "react-router-dom": { version: "7.1.5", description: "Roteamento para React" },
  "react-query": { version: "5.63.0", description: "Gerenciamento de estado servidor para React" },
  "@tanstack/react-query": { version: "5.63.0", description: "Gerenciamento de estado assíncrono" },
  "zustand": { version: "5.0.3", description: "Gerenciamento de estado minimalista para React" },
  "recoil": { version: "0.7.7", description: "Biblioteca de estado para React" },
  "jotai": { version: "2.11.3", description: "Estado primitivo para React" },
  "framer-motion": { version: "12.0.6", description: "Biblioteca de animacoes para React" },
  "react-spring": { version: "9.7.5", description: "Animacoes baseadas em fisica para React" },
  "gsap": { version: "3.12.7", description: "Animacoes JavaScript de alta performance" },
  "p5": { version: "1.11.2", description: "Biblioteca criativa de JavaScript" },
  "konva": { version: "9.3.18", description: "Canvas 2D para JavaScript" },
  "leaflet": { version: "1.9.4", description: "Mapas interativos para web" },
  "mapbox-gl": { version: "3.9.4", description: "Mapas vetoriais interativos" },
  "pixi.js": { version: "8.7.4", description: "Renderizador 2D WebGL mais rapido" },
  "babylon.js": { version: "7.45.0", description: "Motor de jogo 3D para web" },
};

const PIP_PACKAGES: Record<string, { version: string; description: string }> = {
  flask: { version: "3.1.0", description: "Microframework web para Python" },
  django: { version: "5.1.5", description: "Framework web de alto nivel para Python" },
  fastapi: { version: "0.115.6", description: "Framework web moderno e rapido para APIs" },
  requests: { version: "2.32.3", description: "Biblioteca HTTP elegante para Python" },
  numpy: { version: "2.2.1", description: "Computacao cientifica com Python" },
  pandas: { version: "2.2.3", description: "Analise de dados poderosa em Python" },
  matplotlib: { version: "3.10.0", description: "Biblioteca de visualizacao em Python" },
  sqlalchemy: { version: "2.0.37", description: "ORM Python SQL" },
  pydantic: { version: "2.10.5", description: "Validacao de dados para Python" },
  uvicorn: { version: "0.34.0", description: "Servidor ASGI para Python" },
  pytest: { version: "8.3.4", description: "Framework de testes para Python" },
  beautifulsoup4: { version: "4.12.3", description: "Analise de HTML e XML" },
  scikit_learn: { version: "1.6.1", description: "Machine learning em Python" },
  pillow: { version: "11.1.0", description: "Biblioteca de imagens para Python" },
  openai: { version: "1.59.7", description: "SDK oficial da OpenAI para Python" },
  anthropic: { version: "0.43.0", description: "SDK oficial da Anthropic para Python" },
  python_dotenv: { version: "1.0.1", description: "Carrega variaveis de .env para Python" },
  celery: { version: "5.4.0", description: "Fila de tarefas distribuida para Python" },
  redis: { version: "5.2.1", description: "Cliente Redis para Python" },
  aiohttp: { version: "3.11.11", description: "Cliente/servidor HTTP async para Python" },
  httpx: { version: "0.28.1", description: "Cliente HTTP async moderno para Python" },
  scrapy: { version: "2.12.0", description: "Framework de web scraping para Python" },
  selenium: { version: "4.27.1", description: "Automacao de browser para Python" },
  playwright: { version: "1.49.1", description: "Automacao de browser moderna para Python" },
  boto3: { version: "1.35.94", description: "SDK AWS para Python" },
  paramiko: { version: "3.5.0", description: "Implementacao SSHv2 para Python" },
  cryptography: { version: "44.0.0", description: "Biblioteca criptografica para Python" },
  jwt: { version: "1.3.1", description: "JSON Web Token para Python" },
  passlib: { version: "1.7.4", description: "Framework de hashing de senha" },
  alembic: { version: "1.14.1", description: "Migrations para SQLAlchemy" },
  psycopg2: { version: "2.9.10", description: "Adaptador PostgreSQL para Python" },
  pymongo: { version: "4.10.1", description: "Driver MongoDB para Python" },
  motor: { version: "3.7.0", description: "Driver MongoDB async para Python" },
  tortoise_orm: { version: "0.22.1", description: "ORM async inspirado no Django" },
  peewee: { version: "3.17.8", description: "ORM simples para Python" },
  tensorflow: { version: "2.18.0", description: "Machine learning de codigo aberto" },
  torch: { version: "2.6.0", description: "PyTorch - ML com aceleracao GPU" },
  transformers: { version: "4.47.1", description: "Modelos de ML prontos da Hugging Face" },
  langchain: { version: "0.3.14", description: "Framework para apps com LLMs" },
  yt_dlp: { version: "2025.1.7", description: "Downloader de YouTube e outros sites" },
  youtube_transcript_api: { version: "0.6.3", description: "Transcricoes de videos do YouTube" },
  pytube: { version: "15.0.0", description: "Downloader de YouTube para Python" },
  moviepy: { version: "2.1.1", description: "Edicao de video com Python" },
  pydub: { version: "0.25.1", description: "Manipulacao de audio simples para Python" },
  whisper: { version: "1.1.10", description: "Reconhecimento de voz da OpenAI" },
  gtts: { version: "2.5.4", description: "Texto para voz com Google TTS" },
  qrcode: { version: "8.0.0", description: "Gerador de QR Code para Python" },
  reportlab: { version: "4.2.5", description: "Criacao de PDFs para Python" },
  openpyxl: { version: "3.1.5", description: "Leitura e escrita de Excel em Python" },
  schedule: { version: "1.2.2", description: "Agendamento de tarefas em Python" },
  apscheduler: { version: "3.11.0", description: "Scheduler avancado para Python" },
  click: { version: "8.1.8", description: "Criacao de CLIs elegantes em Python" },
  typer: { version: "0.15.1", description: "CLIs com Python e type hints" },
  rich: { version: "13.9.4", description: "Output terminal bonito para Python" },
  loguru: { version: "0.7.3", description: "Logger simples e poderoso para Python" },
  python_telegram_bot: { version: "21.10", description: "Framework para bots do Telegram" },
  discord_py: { version: "2.4.0", description: "API Discord para Python" },
  tweepy: { version: "4.15.0", description: "SDK Twitter/X para Python" },
  stripe: { version: "11.4.1", description: "SDK Stripe para Python" },
  supabase: { version: "2.12.0", description: "SDK Supabase para Python" },
  firebase_admin: { version: "6.6.0", description: "SDK Firebase Admin para Python" },
};

function simulateInstallDelay(pkg: string): Promise<void> {
  const delay = 800 + Math.random() * 1200;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export default function Terminal({ vfs, externalCommand, onCommandExecuted, onServerToggle, onGitClone, onCommandOutput, onBufferUpdate }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "info", content: "╔══════════════════════════════════╗" },
    { type: "info", content: "║   SK Code Editor - Terminal v2.0 ║" },
    { type: "info", content: "╚══════════════════════════════════╝" },
    { type: "info", content: 'Digite "help" para comandos · "db help" para banco de dados' },
    { type: "info", content: "" },
  ]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("/");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (externalCommand) {
      executeCommand(externalCommand);
      onCommandExecuted?.();
    }
  }, [externalCommand]);

  // Refs estáveis pros callbacks (evitam re-render loop)
  const onBufferUpdateRef = useRef(onBufferUpdate);
  const onCommandOutputRef = useRef(onCommandOutput);
  useEffect(() => { onBufferUpdateRef.current = onBufferUpdate; }, [onBufferUpdate]);
  useEffect(() => { onCommandOutputRef.current = onCommandOutput; }, [onCommandOutput]);

  // Emite buffer formatado pra Jasmim sempre que muda (limita aos últimos 50 linhas)
  useEffect(() => {
    if (!onBufferUpdateRef.current) return;
    const recent = lines.slice(-50);
    const buf = recent.map(l => l.content).join("\n");
    const hasErr = recent.some(l => l.type === "error");
    onBufferUpdateRef.current(buf, hasErr);
  }, [lines]);

  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    setLines((prev) => [...prev, { type, content }]);
  }, []);

  const addLines = useCallback((type: TerminalLine["type"], lines: string[]) => {
    setLines((prev) => [...prev, ...lines.map((content) => ({ type, content }))]);
  }, []);

  const resolvePath = useCallback((path: string): string => {
    if (path.startsWith("/")) return path.replace(/\/+$/, "") || "/";
    const parts = cwd === "/" ? [] : cwd.split("/").filter(Boolean);
    for (const seg of path.split("/")) {
      if (seg === "..") parts.pop();
      else if (seg !== "." && seg !== "") parts.push(seg);
    }
    return "/" + parts.join("/");
  }, [cwd]);

  const cmdStartIndexRef = useRef<number>(0);

  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory((prev) => [trimmed, ...prev].slice(0, 100));
    setHistoryIndex(-1);
    addLine("input", `${cwd} $ ${trimmed}`);

    // Marca onde começa a saída deste comando (pra emitir depois pra Jasmim)
    setLines((prev) => { cmdStartIndexRef.current = prev.length; return prev; });

    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const command = parts[0]?.toLowerCase() || "";
    const args = parts.slice(1).map((a) => a.replace(/^["']|["']$/g, ""));
    const allFiles = vfs.listFiles();

    if (isRunning && command !== "clear") {
      addLine("warn", "Aguarde... comando em execucao.");
      return;
    }

    switch (command) {
      case "help": {
        addLines("info", [
          "",
          "━━━ COMANDOS DE ARQUIVO ━━━",
          "  ls [dir]           Listar arquivos",
          "  cd <dir>           Mudar diretorio",
          "  pwd                Diretorio atual",
          "  cat <arquivo>      Ver conteudo",
          "  touch <arquivo>    Criar arquivo",
          "  mkdir <dir>        Criar diretorio",
          "  rm [-rf] <alvo>    Remover",
          "  mv <orig> <dest>   Mover/renomear",
          "  cp <orig> <dest>   Copiar",
          "  find <padrao>      Buscar arquivos",
          "  tree               Arvore",
          "",
          "━━━ EXECUCAO ━━━",
          "  node <arquivo>     Executar JavaScript",
          "  python <arquivo>   Executar Python",
          "  npm <comando>      Gerenciador npm",
          "  pip install <pkg>  Instalar pacote Python",
          "",
          "━━━ BANCO DE DADOS ━━━",
          "  db help            Guia de banco de dados",
          "  db sqlite          Template SQLite",
          "  db postgres        Template PostgreSQL",
          "  db mongo           Template MongoDB",
          "  db neon            Template Neon (Postgres cloud gratis)",
          "  db supabase        Template Supabase",
          "",
          "━━━ YOUTUBE / MIDIA ━━━",
          "  youtube            Guia de download do YouTube",
          "  youtube setup      Criar projeto completo de download",
          "  yt help            Mesmo que youtube",
          "",
          "━━━ UTILITARIOS ━━━",
          "  search <termo>     Buscar no projeto",
          "  env                Variaveis de ambiente",
          "  clear              Limpar terminal",
          "  date               Data e hora",
          "",
          "💡 100+ pacotes npm · 80+ pacotes pip · Use: npm install <nome>",
        ]);
        break;
      }

      case "ls": {
        const target = args[0] ? resolvePath(args[0]) : cwd;
        const prefix = target === "/" ? "" : target.replace(/^\//, "");
        const entries = new Map<string, boolean>();
        for (const f of allFiles) {
          if (prefix === "") {
            const first = f.split("/")[0];
            const isDir = allFiles.some((x) => x.startsWith(first + "/") && x !== first);
            entries.set(first, isDir);
          } else if (f.startsWith(prefix + "/")) {
            const rest = f.slice(prefix.length + 1);
            const first = rest.split("/")[0];
            const isDir = allFiles.some((x) => x.startsWith(prefix + "/" + first + "/"));
            entries.set(first, isDir);
          } else if (f === prefix) {
            entries.set(f.split("/").pop()!, false);
          }
        }
        if (entries.size === 0) { addLine("output", "(diretorio vazio)"); break; }
        const sorted = Array.from(entries.entries()).sort(([a, ad], [b, bd]) => {
          if (ad !== bd) return ad ? -1 : 1;
          return a.localeCompare(b);
        });
        for (const [name, isDir] of sorted) {
          addLine("output", isDir ? `📁 ${name}/` : `📄 ${name}`);
        }
        break;
      }

      case "cd": {
        if (!args[0] || args[0] === "~") { setCwd("/"); break; }
        const target = resolvePath(args[0]);
        if (target === "/") { setCwd("/"); break; }
        const prefix = target.replace(/^\//, "");
        const exists = allFiles.some((f) => f.startsWith(prefix + "/") || f === prefix);
        if (exists) setCwd(target);
        else addLine("error", `cd: ${args[0]}: Diretorio nao encontrado`);
        break;
      }

      case "pwd": addLine("output", cwd); break;

      case "cat": {
        if (!args[0]) { addLine("error", "cat: falta argumento"); break; }
        const target = resolvePath(args[0]).replace(/^\//, "");
        const content = vfs.readFile(target);
        if (content !== undefined) addLine("output", content || "(arquivo vazio)");
        else addLine("error", `cat: ${args[0]}: Arquivo nao encontrado`);
        break;
      }

      case "touch": {
        if (!args[0]) { addLine("error", "touch: falta nome do arquivo"); break; }
        const target = resolvePath(args[0]).replace(/^\//, "");
        vfs.writeFile(target, vfs.readFile(target) || "");
        addLine("success", `✓ Arquivo criado: ${target}`);
        break;
      }

      case "mkdir": {
        if (!args[0]) { addLine("error", "mkdir: falta nome"); break; }
        const target = resolvePath(args[0]).replace(/^\//, "");
        vfs.writeFile(`${target}/.gitkeep`, "");
        addLine("success", `✓ Pasta criada: ${target}/`);
        break;
      }

      case "rm": {
        const target_arg = args.find((a) => !a.startsWith("-")) || "";
        if (!target_arg) { addLine("error", "rm: falta argumento"); break; }
        const target = resolvePath(target_arg).replace(/^\//, "");
        if (vfs.exists(target)) { vfs.deleteFile(target); addLine("success", `✓ Removido: ${target}`); }
        else addLine("error", `rm: ${target_arg}: Nao encontrado`);
        break;
      }

      case "mv": {
        if (args.length < 2) { addLine("error", "mv: mv <origem> <destino>"); break; }
        const from = resolvePath(args[0]).replace(/^\//, "");
        const to = resolvePath(args[1]).replace(/^\//, "");
        if (vfs.exists(from)) { vfs.renameFile(from, to); addLine("success", `✓ ${from} → ${to}`); }
        else addLine("error", `mv: ${args[0]}: Nao encontrado`);
        break;
      }

      case "cp": {
        if (args.length < 2) { addLine("error", "cp: cp <origem> <destino>"); break; }
        const from = resolvePath(args[0]).replace(/^\//, "");
        const to = resolvePath(args[1]).replace(/^\//, "");
        const content = vfs.readFile(from);
        if (content !== undefined) { vfs.writeFile(to, content); addLine("success", `✓ Copiado: ${from} → ${to}`); }
        else addLine("error", `cp: ${args[0]}: Nao encontrado`);
        break;
      }

      case "echo": {
        const text = args.join(" ");
        if (trimmed.includes(">")) {
          const [, filePart] = trimmed.split(">");
          const filePath = filePart.trim().replace(/^\//, "");
          const content = text.split(">")[0].trim().replace(/^["']|["']$/g, "");
          vfs.writeFile(filePath, content + "\n");
          addLine("success", `✓ Escrito em ${filePath}`);
        } else {
          addLine("output", text);
        }
        break;
      }

      case "find": {
        const pattern = (args[0] || "").toLowerCase();
        const matches = allFiles.filter((f) => f.toLowerCase().includes(pattern));
        if (matches.length === 0) addLine("output", "Nenhum arquivo encontrado");
        else matches.forEach((m) => addLine("output", `./${m}`));
        break;
      }

      case "search": {
        if (!args[0]) { addLine("error", "search: falta termo"); break; }
        const term = args[0].toLowerCase();
        let found = 0;
        for (const f of allFiles) {
          const content = vfs.readFile(f) || "";
          const idx = content.toLowerCase().indexOf(term);
          if (idx !== -1) {
            const lines = content.split("\n");
            let lineNo = 0, charCount = 0;
            for (let i = 0; i < lines.length; i++) {
              charCount += lines[i].length + 1;
              if (charCount > idx) { lineNo = i + 1; break; }
            }
            addLine("output", `${f}:${lineNo}: ${lines[lineNo - 1]?.trim()}`);
            found++;
          }
        }
        if (found === 0) addLine("output", `Nenhuma ocorrencia de "${args[0]}" encontrada`);
        else addLine("success", `✓ ${found} arquivo(s) com "${args[0]}"`);
        break;
      }

      case "wc": {
        if (!args[0]) { addLine("error", "wc: falta argumento"); break; }
        const target = resolvePath(args[0]).replace(/^\//, "");
        const content = vfs.readFile(target);
        if (content !== undefined) {
          addLine("output", `  ${content.split("\n").length} linhas  ${content.split(/\s+/).filter(Boolean).length} palavras  ${content.length} chars  ${args[0]}`);
        } else addLine("error", `wc: ${args[0]}: Nao encontrado`);
        break;
      }

      case "head": case "tail": {
        if (!args[0]) { addLine("error", `${command}: falta argumento`); break; }
        const target = resolvePath(args[0]).replace(/^\//, "");
        const content = vfs.readFile(target);
        if (content !== undefined) {
          const lineArr = content.split("\n");
          const slice = command === "head" ? lineArr.slice(0, 10) : lineArr.slice(-10);
          addLine("output", slice.join("\n"));
        } else addLine("error", `${command}: ${args[0]}: Nao encontrado`);
        break;
      }

      case "tree": {
        const prefix = cwd === "/" ? "" : cwd.replace(/^\//, "");
        const relevant = prefix ? allFiles.filter((f) => f.startsWith(prefix + "/")) : allFiles;
        if (relevant.length === 0) { addLine("output", "(vazio)"); break; }
        const display = prefix ? relevant.map((f) => f.slice(prefix.length + 1)) : relevant;
        const sorted = display.sort();
        for (const f of sorted) {
          const depth = f.split("/").length - 1;
          const indent = "│  ".repeat(depth);
          const name = f.split("/").pop();
          addLine("output", `${indent}${depth > 0 ? "├─ " : ""}${name}`);
        }
        break;
      }

      case "clear": setLines([]); onServerToggle?.(false); break;
      case "date": addLine("output", new Date().toLocaleString("pt-BR")); break;
      case "whoami": addLine("output", "developer"); break;
      case "hostname": addLine("output", "sk-code-editor"); break;
      case "uname": addLine("output", "SK-OS 1.0 (Browser Runtime)"); break;

      case "env": {
        addLines("output", [
          "NODE_ENV=development",
          "EDITOR=SK-Code-Editor",
          "LANG=pt_BR.UTF-8",
          "PATH=/usr/local/bin:/usr/bin:/bin",
          "(Adicione variaveis em .env no projeto)",
        ]);
        break;
      }

      case "node": {
        if (!args[0]) { addLine("error", "node: falta nome do arquivo"); break; }
        const target = resolvePath(args[0]).replace(/^\//, "");
        const content = vfs.readFile(target);
        if (content === undefined) { addLine("error", `node: ${args[0]}: Arquivo nao encontrado`); break; }
        setIsRunning(true);
        addLine("info", `⚡ Executando ${args[0]}...`);
        try {
          const logLines: string[] = [];
          const addLog = (prefix: string, ...a: any[]) => {
            const line = prefix + a.map((x: any) => {
              try { return typeof x === "object" ? JSON.stringify(x, null, 2) : String(x); } catch { return String(x); }
            }).join(" ");
            logLines.push(line);
            addLine(prefix.startsWith("ERR") ? "error" : prefix.startsWith("WRN") ? "warn" : "output", line.replace(/^(ERR|WRN|INF): /, ""));
          };
          const fakeConsole = {
            log: (...a: any[]) => addLog("", ...a),
            error: (...a: any[]) => addLog("ERR: ", ...a),
            warn: (...a: any[]) => addLog("WRN: ", ...a),
            info: (...a: any[]) => addLog("INF: ", ...a),
            table: (d: any) => addLog("", typeof d === "object" ? JSON.stringify(d, null, 2) : String(d)),
          };
          // fetch real do browser disponivel — suporta APIs com CORS habilitado
          const browserFetch = (url: string, opts?: RequestInit) => {
            addLine("info", `  → fetch ${url}`);
            return window.fetch(url, opts).then(async r => {
              const clone = r.clone();
              addLine("info", `  ← ${r.status} ${r.statusText}`);
              return clone;
            });
          };
          const makeServerObj = (port: number) => ({
            listen: (p?: number | string, cbOrHost?: any, cb?: any) => {
              const listenPort = typeof p === "number" ? p : port;
              const callback = typeof cbOrHost === "function" ? cbOrHost : typeof cb === "function" ? cb : null;
              addLine("success", `✅ Servidor rodando na porta ${listenPort}`);
              addLine("info", `   Acesse: http://localhost:${listenPort}`);
              onServerToggle?.(true, listenPort);
              if (callback) try { callback(); } catch {}
              return { close: () => { onServerToggle?.(false); } };
            },
            get: (_: string, h: any) => { try { h({}, { json: () => {}, send: () => {}, status: () => ({ json: () => {} }) }); } catch {} },
            post: (_: string, h: any) => { try { h({body:{}}, { json: () => {}, send: () => {}, status: () => ({ json: () => {} }) }); } catch {} },
            use: () => {},
            set: () => {},
          });
          const fakeRequire = (mod: string) => {
            if (mod === "path") return { join: (...a: string[]) => a.join("/"), resolve: (...a: string[]) => "/" + a.join("/"), dirname: (p: string) => p.split("/").slice(0,-1).join("/"), basename: (p: string) => p.split("/").pop() };
            if (mod === "fs") return {
              readFileSync: (p: string) => vfs.readFile(p.replace(/^\//, "")) ?? "",
              writeFileSync: (p: string, d: string) => vfs.writeFile(p.replace(/^\//, ""), d),
              existsSync: (p: string) => vfs.readFile(p.replace(/^\//, "")) !== undefined,
            };
            if (mod === "express") {
              const app: any = Object.assign(() => {}, makeServerObj(3000), {
                Router: () => makeServerObj(3000),
                json: () => {},
                urlencoded: () => {},
                static: () => {},
              });
              const expressFn: any = () => app;
              expressFn.Router = () => app;
              expressFn.json = () => {};
              expressFn.urlencoded = () => {};
              expressFn.static = () => {};
              return expressFn;
            }
            if (mod === "http" || mod === "https") return {
              createServer: (_handler?: any) => makeServerObj(3000),
            };
            if (mod === "node-fetch" || mod === "axios") return Object.assign(browserFetch, { default: browserFetch, get: (u: string, o?: any) => browserFetch(u, { ...o, method: "GET" }), post: (u: string, d: any, o?: any) => browserFetch(u, { ...o, method: "POST", body: JSON.stringify(d) }) });
            if (mod === "dotenv") return { config: () => {} };
            if (mod === "cors") return () => {};
            if (mod === "body-parser") return { json: () => {}, urlencoded: () => {} };
            if (mod === "crypto") return { randomBytes: (n: number) => Array.from({length: n}, () => Math.floor(Math.random()*256)), createHash: () => ({ update: (s: string) => ({ digest: () => btoa(s) }) }) };
            throw new Error(`require('${mod}') nao disponivel no browser. Use fetch() diretamente para chamadas de API.`);
          };
          // AsyncFunction para suportar await/async no codigo do usuario
          const AsyncFn = Object.getPrototypeOf(async function(){}).constructor;
          const fn = new AsyncFn("console", "require", "process", "fetch", content);
          await fn(
            fakeConsole,
            fakeRequire,
            { env: {}, argv: ["node", args[0]], cwd: () => "/", exit: (c: number) => { throw new Error(`process.exit(${c})`); } },
            browserFetch
          );
          if (logLines.length === 0) addLine("success", "✓ Executado sem saida no console");
        } catch (e: any) {
          if (e.message?.includes("process.exit")) {
            addLine("info", e.message);
          } else {
            addLine("error", `Erro: ${e.message}`);
            if (e.message?.includes("CORS") || e.message?.includes("fetch")) {
              addLine("warn", "Dica: A API pode nao permitir chamadas do browser (CORS). Verifique se a API tem CORS habilitado.");
            }
          }
        } finally {
          setIsRunning(false);
        }
        break;
      }

      case "python": case "python3": {
        if (!args[0]) { addLine("error", "python: falta nome do arquivo"); break; }
        addLine("info", `⚡ Simulando execucao de ${args[0]}...`);
        addLine("warn", "Python nao pode ser executado no browser.");
        addLine("info", "Para executar Python, use: Replit, Google Colab, ou instale Python localmente.");
        const content = vfs.readFile(args[0].replace(/^\//, ""));
        if (content) {
          const printMatches = content.matchAll(/print\(([^)]+)\)/g);
          for (const m of printMatches) {
            addLine("output", `>>> ${m[1].replace(/["']/g, "")}`);
          }
        }
        break;
      }

      case "npm": {
        const subCmd = args[0]?.toLowerCase();

        if (subCmd === "init") {
          const pkgJson = vfs.readFile("package.json");
          if (!pkgJson) {
            const pkg = { name: "meu-projeto", version: "1.0.0", description: "", main: "index.js", scripts: { start: "node index.js", test: "echo \"Error: no test specified\"" }, keywords: [], author: "", license: "ISC", dependencies: {} };
            vfs.writeFile("package.json", JSON.stringify(pkg, null, 2));
            addLine("success", "✓ package.json criado!");
          } else {
            addLine("warn", "package.json ja existe.");
          }
          break;
        }

        if (subCmd === "run") {
          const script = args[1];
          if (!script) { addLine("error", "npm run: informe o script"); break; }
          const pkgJson = vfs.readFile("package.json");
          if (!pkgJson) { addLine("error", "package.json nao encontrado. Execute: npm init"); break; }
          try {
            const pkg = JSON.parse(pkgJson);
            const scriptCmd = pkg.scripts?.[script];
            if (!scriptCmd) { addLine("error", `Script "${script}" nao encontrado em package.json`); break; }
            addLine("info", `> ${pkg.name || "projeto"} ${script}`);
            addLine("info", `> ${scriptCmd}`);
            addLine("success", `✓ Script "${script}" iniciado (simulado)`);
          } catch { addLine("error", "Erro ao ler package.json"); }
          break;
        }

        if (subCmd === "install" || subCmd === "i" || subCmd === "add") {
          const pkgNames = args.slice(1).filter((a) => !a.startsWith("-"));
          const flags    = args.slice(1).filter((a) =>  a.startsWith("-"));
          const isSaveDev = flags.some(f => f === "--save-dev" || f === "-D");

          setIsRunning(true);

          try {
          // Modo Offline: simula direto, sem chamar servidor (rápido, previsível)
          addLine("warn", `📴 Modo Offline — simulação rápida (não baixa código real)`);
          addLine("info", `   Pra instalar de verdade: troque pra modo "🌐 Online" ou "⚡ Real" no botão do terminal.`);

          if (pkgNames.length === 0) {
            // npm install sem pacote: só processa o package.json existente
            const pkgRaw = vfs.readFile("package.json");
            if (!pkgRaw) {
              addLine("error", "package.json não encontrado. Use: npm init");
            } else {
              try {
                const pkg = JSON.parse(pkgRaw);
                const deps = Object.keys(pkg.dependencies || {}).length;
                const devDeps = Object.keys(pkg.devDependencies || {}).length;
                addLine("success", `✓ package.json processado: ${deps} dependência(s) + ${devDeps} dev`);
                addLine("info", `💡 As entradas estão no package.json mas sem node_modules real.`);
              } catch {
                addLine("error", "package.json com formato inválido");
              }
            }
          } else {
            for (const pkgName of pkgNames) {
              const info = PACKAGES_DB[pkgName.toLowerCase()];
              const version = info?.version || "latest";
              addLine("info", `  + ${pkgName}@${version}`);
              await simulateInstallDelay(pkgName);

              const pkgPath = "package.json";
              let pkg: any = {};
              try { pkg = JSON.parse(vfs.readFile(pkgPath) || "{}"); } catch {}
              if (!pkg.dependencies) pkg.dependencies = {};
              if (!pkg.devDependencies) pkg.devDependencies = {};
              if (isSaveDev) pkg.devDependencies[pkgName] = `^${version}`;
              else           pkg.dependencies[pkgName]    = `^${version}`;
              vfs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));

              addLine("success", `  ✓ ${pkgName}@${version} ESCRITO em package.json (simulado)`);
              if (info?.description) addLine("info", `    ${info.description}`);
            }
            addLine("warn", `⚠️  ${pkgNames.length} pacote(s) só no package.json. Sem node_modules.`);
            addLine("info", `💡 Abra o package.json pra confirmar — as entradas estão lá.`);
          }
          } catch (err: any) {
            addLine("error", `Erro inesperado: ${err?.message || String(err)}`);
          } finally {
            setIsRunning(false);
          }
          break;
        }

        if (subCmd === "uninstall" || subCmd === "remove" || subCmd === "rm") {
          const pkgName = args[1];
          if (!pkgName) { addLine("error", "npm uninstall: informe o pacote"); break; }
          const pkgPath = "package.json";
          let pkg: any = {};
          try { pkg = JSON.parse(vfs.readFile(pkgPath) || "{}"); } catch {}
          if (pkg.dependencies?.[pkgName]) {
            delete pkg.dependencies[pkgName];
            vfs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
            addLine("success", `✓ ${pkgName} removido do package.json`);
          } else {
            addLine("warn", `${pkgName} nao encontrado nas dependencias`);
          }
          break;
        }

        if (subCmd === "list" || subCmd === "ls") {
          const pkgPath = "package.json";
          try {
            const pkg = JSON.parse(vfs.readFile(pkgPath) || "{}");
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (Object.keys(deps).length === 0) { addLine("output", "(sem dependencias)"); break; }
            for (const [name, ver] of Object.entries(deps)) {
              addLine("output", `  ${name}@${ver}`);
            }
          } catch { addLine("error", "Erro ao ler package.json"); }
          break;
        }

        addLine("error", `npm ${subCmd}: subcomando desconhecido`);
        addLine("info", "Comandos: install, uninstall, run, list, init");
        break;
      }

      case "pip": case "pip3": {
        const subCmd = args[0]?.toLowerCase();
        if (subCmd === "install") {
          const pkgNames = args.slice(1).filter((a) => !a.startsWith("-"));
          if (pkgNames.length === 0) { addLine("error", "pip install: informe o pacote"); break; }
          setIsRunning(true);
          for (const pkgName of pkgNames) {
            const info = PIP_PACKAGES[pkgName.toLowerCase()];
            const version = info?.version || "latest";
            addLine("info", `Collecting ${pkgName}`);
            await simulateInstallDelay(pkgName);
            addLine("info", `  Downloading ${pkgName}-${version}.tar.gz`);
            await simulateInstallDelay(pkgName);
            addLine("info", `Installing collected packages: ${pkgName}`);
            await simulateInstallDelay(pkgName);

            let reqContent = vfs.readFile("requirements.txt") || "";
            if (!reqContent.includes(pkgName)) {
              reqContent += (reqContent && !reqContent.endsWith("\n") ? "\n" : "") + `${pkgName}==${version}\n`;
              vfs.writeFile("requirements.txt", reqContent);
            }
            addLine("success", `Successfully installed ${pkgName}-${version}`);
            if (info?.description) addLine("info", `  ${info.description}`);
          }
          setIsRunning(false);
          break;
        }
        if (subCmd === "list") {
          const reqs = vfs.readFile("requirements.txt") || "";
          if (!reqs.trim()) { addLine("output", "(sem pacotes instalados)"); break; }
          addLine("output", "Package          Version");
          addLine("output", "---------------- -------");
          for (const line of reqs.split("\n").filter(Boolean)) {
            const [name, ver] = line.split("==");
            addLine("output", `${name.padEnd(16)} ${ver || "latest"}`);
          }
          break;
        }
        addLine("error", `pip ${subCmd}: subcomando desconhecido`);
        addLine("info", "Comandos: install, list");
        break;
      }

      case "db": {
        const subCmd = args[0]?.toLowerCase();
        if (!subCmd || subCmd === "help") { addLine("info", DB_GUIDE); break; }

        const templates: Record<string, () => void> = {
          sqlite: () => {
            vfs.writeFile("db.js", `const Database = require('better-sqlite3');

const db = new Database('database.db');

// Criar tabelas
db.exec(\`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
\`);

// Inserir dados de exemplo
const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)');
insertUser.run('Joao Silva', 'joao@exemplo.com');
insertUser.run('Maria Santos', 'maria@exemplo.com');

// Consultar dados
const users = db.prepare('SELECT * FROM users').all();
console.log('Usuarios:', users);

// Exportar para uso em outros modulos
module.exports = db;
`);
            addLine("success", "✓ db.js criado com template SQLite");
            addLine("info", "Execute: npm install better-sqlite3");
          },
          postgres: () => {
            vfs.writeFile("db.js", `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Ou configure individualmente:
  // host: 'localhost',
  // port: 5432,
  // database: 'meu_banco',
  // user: 'postgres',
  // password: 'senha',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Testar conexao
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Erro ao conectar:', err);
  else console.log('PostgreSQL conectado:', res.rows[0].now);
});

// Criar tabelas
async function createTables() {
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  \`);
  console.log('Tabelas criadas!');
}

createTables();
module.exports = pool;
`);
            vfs.writeFile(".env", "DATABASE_URL=postgresql://user:password@localhost:5432/mydb\nNODE_ENV=development\n");
            addLine("success", "✓ db.js e .env criados com template PostgreSQL");
            addLine("info", "Execute: npm install pg");
            addLine("warn", "Configure DATABASE_URL no arquivo .env");
          },
          mongo: () => {
            vfs.writeFile("db.js", `const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meu-banco';

mongoose.connect(MONGODB_URI).then(() => {
  console.log('MongoDB conectado!');
}).catch((err) => {
  console.error('Erro ao conectar:', err);
});

// Definir schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

module.exports = { mongoose, User, Post };
`);
            vfs.writeFile(".env", "MONGODB_URI=mongodb://localhost:27017/meu-banco\n");
            addLine("success", "✓ db.js criado com template MongoDB");
            addLine("info", "Execute: npm install mongoose");
          },
          neon: () => {
            vfs.writeFile("db.js", `const { Pool } = require('pg');

// Neon PostgreSQL - Banco de dados PostgreSQL gratuito na nuvem
// 1. Crie uma conta em: console.neon.tech
// 2. Crie um projeto e copie a connection string
// 3. Cole a connection string no arquivo .env como DATABASE_URL

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessario para Neon
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testar conexao
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now, version()');
    console.log('✓ Neon PostgreSQL conectado!');
    console.log('  Hora:', res.rows[0].now);
    console.log('  Versao:', res.rows[0].version.split(' ').slice(0,2).join(' '));
  } catch (err) {
    console.error('✗ Erro ao conectar:', err.message);
    console.log('Verifique a DATABASE_URL no arquivo .env');
  }
}

// Criar tabelas de exemplo
async function setupDatabase() {
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  \`);
  console.log('✓ Tabelas criadas no Neon!');
}

// Funcoes utilitarias
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Query executada:', { text: text.slice(0, 50), duration: duration + 'ms', rows: res.rowCount });
  return res;
}

async function getClient() {
  const client = await pool.connect();
  const release = client.release;
  client.release = () => {
    client.release = release;
    return release.apply(client);
  };
  return client;
}

// Inicializar
testConnection()
  .then(() => setupDatabase())
  .catch(console.error);

module.exports = { pool, query, getClient };
`);
            vfs.writeFile(".env", `# Neon PostgreSQL Connection String
# Obtenha em: console.neon.tech -> seu projeto -> Connection String
DATABASE_URL=postgresql://usuario:senha@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require

NODE_ENV=development
PORT=3000
`);
            vfs.writeFile(".env.example", `DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
NODE_ENV=development
PORT=3000
`);
            vfs.writeFile(".gitignore", `.env
node_modules/
dist/
*.log
`);
            addLine("success", "✓ Template Neon PostgreSQL criado!");
            addLines("info", [
              "  Proximos passos:",
              "  1. Acesse: console.neon.tech e crie uma conta gratuita",
              "  2. Crie um projeto e copie a Connection String",
              "  3. Cole no arquivo .env como DATABASE_URL",
              "  4. Execute: npm install pg",
              "  5. Execute: node db.js",
              "",
              "  Neon oferece: 512MB gratis, PostgreSQL gerenciado, branching de banco!",
            ]);
          },

          supabase: () => {
            vfs.writeFile("supabase.js", `import { createClient } from '@supabase/supabase-js';

// Supabase - Backend completo com PostgreSQL + Auth + Storage + Realtime
// 1. Crie uma conta em: supabase.com
// 2. Crie um projeto
// 3. Va em Settings > API e copie a URL e a anon key

const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== AUTENTICACAO ====================
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ==================== DATABASE ====================
export async function getAll(table) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data;
}

export async function getById(table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function insert(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select();
  if (error) throw error;
  return data;
}

export async function update(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq('id', id).select();
  if (error) throw error;
  return data;
}

export async function remove(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ==================== STORAGE ====================
export async function uploadFile(bucket, path, file) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ==================== REALTIME ====================
export function subscribeToTable(table, callback) {
  return supabase.channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
}
`);
            vfs.writeFile(".env", `SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
`);
            vfs.writeFile(".env.example", `SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
`);
            addLine("success", "✓ Template Supabase criado!");
            addLines("info", [
              "  Proximos passos:",
              "  1. Acesse: supabase.com e crie uma conta",
              "  2. Crie um projeto (gratis ate 500MB)",
              "  3. Va em Settings > API",
              "  4. Copie Project URL e anon/public key para o .env",
              "  5. Execute: npm install @supabase/supabase-js",
              "",
              "  Supabase oferece: PostgreSQL + Auth + Storage + Edge Functions + Realtime!",
            ]);
          },

          firebase: () => {
            vfs.writeFile("firebase.js", `import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Exemplos de uso:
// const docRef = await addDoc(collection(db, 'users'), { name: 'Joao', email: 'joao@email.com' });
// const snapshot = await getDocs(collection(db, 'users'));
// snapshot.forEach((doc) => console.log(doc.id, doc.data()));
`);
            vfs.writeFile(".env", "VITE_FIREBASE_API_KEY=\nVITE_FIREBASE_AUTH_DOMAIN=\nVITE_FIREBASE_PROJECT_ID=\nVITE_FIREBASE_STORAGE_BUCKET=\nVITE_FIREBASE_MESSAGING_SENDER_ID=\nVITE_FIREBASE_APP_ID=\n");
            addLine("success", "✓ firebase.js e .env criados");
            addLine("info", "Execute: npm install firebase");
            addLine("warn", "Configure as variaveis no arquivo .env com suas credenciais do Firebase Console");
          },
        };

        if (templates[subCmd]) {
          templates[subCmd]();
        } else {
          addLine("error", `db: tipo desconhecido: ${subCmd}`);
          addLine("info", "Tipos: sqlite, postgres, mongo, firebase");
        }
        break;
      }

      case "youtube": case "yt": {
        const sub = args[0]?.toLowerCase();
        if (!sub || sub === "help") { addLine("info", YOUTUBE_GUIDE); break; }

        if (sub === "setup") {
          addLine("info", "Criando projeto de download do YouTube...");
          vfs.writeFile("package.json", JSON.stringify({
            name: "youtube-downloader",
            version: "1.0.0",
            description: "Downloader de videos do YouTube",
            main: "download.js",
            scripts: { start: "node download.js", download: "node download.js" },
            dependencies: { "ytdl-core": "^4.11.5", "fluent-ffmpeg": "^2.1.3" }
          }, null, 2));
          vfs.writeFile("download.js", `const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

// Configure a URL do video aqui:
const VIDEO_URL = process.env.YOUTUBE_URL || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

async function downloadVideo(url, format = 'video') {
  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_');
  console.log('Titulo:', info.videoDetails.title);
  console.log('Duracao:', Math.floor(info.videoDetails.lengthSeconds / 60) + ' min');

  const filename = format === 'audio' ? \`\${title}.mp4\` : \`\${title}_video.mp4\`;
  const output = fs.createWriteStream(filename);

  const quality = format === 'audio' ? 'lowestaudio' : 'highest';
  const stream = ytdl(url, { quality });

  let downloaded = 0;
  stream.on('progress', (_, total, grand) => {
    const pct = Math.floor((total / grand) * 100);
    process.stdout.write(\`\\rBaixando: \${pct}%\`);
  });

  stream.pipe(output);
  await new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });

  console.log(\`\\n✓ Salvo como: \${filename}\`);
  return filename;
}

async function getInfo(url) {
  const info = await ytdl.getInfo(url);
  console.log('=== Informacoes do Video ===');
  console.log('Titulo:', info.videoDetails.title);
  console.log('Canal:', info.videoDetails.author.name);
  console.log('Duracao:', Math.floor(info.videoDetails.lengthSeconds / 60) + 'min');
  console.log('Views:', parseInt(info.videoDetails.viewCount).toLocaleString('pt-BR'));
  console.log('Formatos disponiveis:', info.formats.length);
}

// Executar
const action = process.argv[2] || 'info';
if (action === 'info') getInfo(VIDEO_URL).catch(console.error);
else if (action === 'video') downloadVideo(VIDEO_URL, 'video').catch(console.error);
else if (action === 'audio') downloadVideo(VIDEO_URL, 'audio').catch(console.error);
else console.log('Use: node download.js [info|video|audio]');
`);
          vfs.writeFile("README.md", `# YouTube Downloader

## Instalacao
\`\`\`bash
npm install
\`\`\`

## Uso
\`\`\`bash
# Ver informacoes do video
YOUTUBE_URL="https://youtube.com/watch?v=..." node download.js info

# Baixar video
YOUTUBE_URL="https://youtube.com/watch?v=..." node download.js video

# Baixar audio
YOUTUBE_URL="https://youtube.com/watch?v=..." node download.js audio
\`\`\`
`);
          addLine("success", "✓ Projeto de download do YouTube criado!");
          addLine("info", "Execute: npm install");
          addLine("info", "Depois: YOUTUBE_URL=<url> node download.js [info|video|audio]");
          break;
        }

        if (args[0]?.startsWith("http")) {
          addLine("info", `Para baixar: ${args[0]}`);
          addLine("info", "Execute: youtube setup");
          addLine("info", "Depois configure a URL em download.js e rode: node download.js");
          break;
        }

        addLine("info", YOUTUBE_GUIDE);
        break;
      }

      case "git": {
        const sub = args[0];
        if (!sub) { addLine("info", "Uso: git clone <url-do-repositorio>"); break; }
        if (sub === "clone") {
          const url = args[1] || "";
          if (!url) { addLine("error", "git clone: informe a URL do repositorio"); addLine("info", "Exemplo: git clone github.com/usuario/repositorio"); break; }
          const clean = url.replace(/\.git$/, "").replace(/\/$/, "").replace(/^https?:\/\//, "");
          const m = clean.match(/github\.com\/([^/]+)\/([^/]+)/);
          const parts = m ? [m[1], m[2]] : clean.split("/").filter(Boolean);
          if (parts.length < 2) { addLine("error", `URL invalida: ${url}`); addLine("info", "Formato: github.com/usuario/repositorio"); break; }
          const [owner, repo] = parts;
          addLine("info", `Clonando ${owner}/${repo}...`);
          if (onGitClone) {
            onGitClone(owner, repo)
              .then(() => addLine("success", `✓ Repositorio '${repo}' importado com sucesso`))
              .catch((e: any) => addLine("error", `git clone falhou: ${e.message}`));
          } else {
            addLine("warn", "git clone: use o painel GitHub (icone GitBranch) para importar repositorios");
          }
          break;
        }
        addLine("info", `git ${sub}: use o painel GitHub (icone GitBranch na barra inferior)`);
        break;
      }

      case "curl": case "wget": {
        addLine("warn", `${command}: requisicoes HTTP diretas nao disponiveis no browser`);
        addLine("info", "Use o painel de IA para buscar informacoes ou APIs externas");
        addLine("info", "Em aplicacoes Node.js reais, use: npm install axios");
        break;
      }

      case "which": addLine("output", `/usr/local/bin/${args[0] || ""}`); break;
      case "exit": addLine("info", "exit: terminal browser nao pode ser fechado"); break;

      default: {
        addLine("error", `${command}: comando nao encontrado`);
        addLine("info", `Tente "help" para ver os comandos disponiveis`);
        const similar = ["ls", "cd", "cat", "npm", "pip", "node", "python", "mkdir", "rm", "mv", "cp", "clear", "help", "db"]
          .find((c) => c.startsWith(command[0]) || command.startsWith(c[0]));
        if (similar) addLine("info", `Voce quis dizer: ${similar}?`);
        break;
      }
    }

    // Emite resultado completo do comando pra Jasmim ler (lê estado mais atual via flushSync trick)
    if (onCommandOutputRef.current) {
      // Captura estado mais recente sem efeitos colaterais dentro do updater
      let latestLines: TerminalLine[] = [];
      let startIdx = cmdStartIndexRef.current;
      setLines((prev) => { latestLines = prev; return prev; });
      // Emite fora do updater
      const slice = latestLines.slice(startIdx);
      const out = slice.map(l => l.content).join("\n");
      const ok = !slice.some(l => l.type === "error");
      try { onCommandOutputRef.current?.(trimmed, out, ok); } catch {}
    }
  }, [cwd, vfs, addLine, addLines, resolvePath, isRunning]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRunning) {
      executeCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistory((hist) => {
        const newIndex = historyIndex === -1 ? 0 : Math.min(hist.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        setInput(hist[newIndex] || "");
        return hist;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setHistory((hist) => { setInput(hist[newIndex] || ""); return hist; });
      } else {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const partial = input.split(" ").pop() || "";
      if (partial) {
        const matches = vfs.listFiles().filter((f) => f.split("/").pop()?.startsWith(partial));
        if (matches.length === 1) {
          setInput((prev) => prev.slice(0, prev.length - partial.length) + matches[0].split("/").pop());
        }
      }
    } else if (e.key === "c" && e.ctrlKey) {
      if (isRunning) { setIsRunning(false); addLine("warn", "^C"); }
    } else if (e.key === "l" && e.ctrlKey) {
      setLines([]);
    }
  };

  return (
    <div className="h-full bg-[#0a0e14] font-mono text-xs flex flex-col" onClick={() => inputRef.current?.focus()}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all leading-relaxed ${
            line.type === "error" ? "text-red-400" :
            line.type === "info" ? "text-blue-300" :
            line.type === "success" ? "text-green-400" :
            line.type === "warn" ? "text-yellow-400" :
            line.type === "input" ? "text-cyan-300" :
            "text-gray-300"
          }`}>
            {line.content}
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="text-purple-400 shrink-0">{cwd}</span>
          <span className="text-gray-600 shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            className="flex-1 bg-transparent outline-none text-gray-200 caret-cyan-400 disabled:opacity-50"
            autoFocus autoCapitalize="off" autoCorrect="off" spellCheck={false}
          />
          {isRunning && (
            <span className="text-yellow-400 animate-pulse text-[10px]">executando...</span>
          )}
        </div>
      </div>
    </div>
  );
}
