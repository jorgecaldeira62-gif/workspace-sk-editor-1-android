import { useState, useCallback } from "react";
import {
  Package, Smartphone, Globe, Zap, GitBranch, X,
  ChevronDown, ChevronRight, Copy, Check, Download,
  Settings2, Key, RefreshCw, FileCode2, AlertCircle,
  ExternalLink, Play, Archive, HardDriveDownload, Code2,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import HTMLPlayground from "./HTMLPlayground";

interface BuildPanelProps {
  vfs: { listFiles: () => string[]; readFile: (p: string) => string | null; writeFile: (p: string, c: string) => void };
  projectName: string;
  onClose: () => void;
  onRunCommand?: (cmd: string) => void;
}

type BuildTarget = "eas" | "capacitor" | "githubpages" | "electron" | "pwa" | "git" | "clean" | "netlify" | "vercel";

const SECTIONS = [
  { id: "eas"         as BuildTarget, label: "APK via EAS (Expo)",      icon: "📱", color: "bg-blue-900/30 border-blue-500/40 text-blue-300",     desc: "Build APK/AAB pelo serviço EAS da Expo" },
  { id: "capacitor"   as BuildTarget, label: "APK via Capacitor",        icon: "⚡", color: "bg-cyan-900/30 border-cyan-500/40 text-cyan-300",     desc: "Empacota o projeto web como APK Android" },
  { id: "githubpages" as BuildTarget, label: "GitHub Pages",             icon: "🌐", color: "bg-green-900/30 border-green-500/40 text-green-300",  desc: "Publica no GitHub Pages gratuitamente" },
  { id: "electron"    as BuildTarget, label: "Executável (Electron)",    icon: "🖥", color: "bg-purple-900/30 border-purple-500/40 text-purple-300",desc: "Executável Desktop (Win/Mac/Linux)" },
  { id: "pwa"         as BuildTarget, label: "PWA (Instalável no Cel.)", icon: "📲", color: "bg-orange-900/30 border-orange-500/40 text-orange-300",desc: "Instala como app no celular sem APK" },
  { id: "git"         as BuildTarget, label: "Deploy via Git",           icon: "🚀", color: "bg-pink-900/30 border-pink-500/40 text-pink-300",     desc: "Configura e publica via repositório Git" },
  { id: "netlify"     as BuildTarget, label: "Netlify (Publicar grátis)", icon: "🔷", color: "bg-teal-900/30 border-teal-500/40 text-teal-300",    desc: "Deploy gratuito com URL pública em minutos" },
  { id: "vercel"      as BuildTarget, label: "Vercel (Publicar grátis)",  icon: "▲", color: "bg-gray-900/50 border-gray-400/40 text-gray-200",    desc: "Deploy grátis + SSL automático via Vercel" },
  { id: "clean"       as BuildTarget, label: "Versão Limpa (Standalone)", icon: "✨", color: "bg-gray-800/50 border-gray-500/40 text-gray-300",     desc: "ZIP limpo sem dependências do Replit" },
];

function CodeBlock({ code, onCopy }: { code: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => { navigator.clipboard.writeText(code); setCopied(true); onCopy?.(); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative bg-[#0d1117] border border-gray-800/60 rounded-xl overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-gray-800/40">
        <span className="text-[10px] text-gray-600 font-mono">terminal</span>
        <button onClick={doCopy} className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors">
          {copied ? <><Check size={10} className="text-green-400" /> Copiado</> : <><Copy size={10} /> Copiar</>}
        </button>
      </div>
      <pre className="px-3 py-2.5 text-[11px] font-mono text-gray-300 whitespace-pre-wrap break-all">{code}</pre>
    </div>
  );
}

// ── Helpers para geração de ZIPs ─────────────────────────────────────────────

const CLEAN_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
  },
});
`;

const GITIGNORE = `node_modules/
dist/
build/
.expo/
.expo-shared/
*.local
.env
.DS_Store
*.log
android/
ios/
`;

function cleanDeps(deps: Record<string, string> = {}): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    if (!k.startsWith("@replit/") && !k.startsWith("@workspace/")) r[k] = v;
  }
  return r;
}

function parseVfsPkg(vfs: BuildPanelProps["vfs"]): any {
  try { return JSON.parse(vfs.readFile("package.json") || "{}"); } catch { return {}; }
}

function makeCleanPkg(pkg: any, name: string, overrides?: Partial<any>): string {
  const cleanName = (pkg.name || name).toLowerCase().replace(/\s+/g, "-");
  return JSON.stringify({
    name: cleanName,
    version: pkg.version || "1.0.0",
    description: pkg.description || cleanName,
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: cleanDeps(pkg.dependencies),
    devDependencies: { ...cleanDeps(pkg.devDependencies), "vite": "^6.0.0", "@vitejs/plugin-react": "^4.0.0", "@tailwindcss/vite": "^4.0.0", "tailwindcss": "^4.0.0" },
    ...overrides,
  }, null, 2);
}

function getAllVfsFiles(vfs: BuildPanelProps["vfs"]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const f of vfs.listFiles()) {
    const content = vfs.readFile(f);
    if (content !== null) files[f] = content;
  }
  return files;
}

async function generatePlatformZip(
  target: BuildTarget,
  vfs: BuildPanelProps["vfs"],
  projectName: string,
  extras: { easToken?: string; ghUser?: string; ghRepo?: string; ghToken?: string }
): Promise<Blob> {
  const zip = new JSZip();
  const pkg = parseVfsPkg(vfs);
  const name = (pkg.name || projectName).toLowerCase().replace(/\s+/g, "-");
  const allFiles = getAllVfsFiles(vfs);

  // Adiciona arquivos VFS (exceto package.json e vite.config.ts que serão substituídos)
  const skipFiles = new Set(["package.json", "vite.config.ts", "vite.config.js"]);
  for (const [path, content] of Object.entries(allFiles)) {
    if (!skipFiles.has(path)) zip.file(path, content);
  }
  zip.file(".gitignore", GITIGNORE);

  if (target === "eas") {
    const appJson = {
      expo: {
        name: projectName,
        slug: name,
        version: pkg.version || "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        splash: { image: "./assets/splash.png", resizeMode: "contain", backgroundColor: "#ffffff" },
        platforms: ["ios", "android", "web"],
        android: { adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#ffffff" }, package: `com.${name.replace(/-/g, "")}.app` },
        ios: { supportsTablet: true, bundleIdentifier: `com.${name.replace(/-/g, "")}.app` },
        web: { favicon: "./assets/favicon.png" },
        extra: { eas: { projectId: "" } },
      },
    };
    zip.file("app.json", JSON.stringify(appJson, null, 2));
    zip.file("eas.json", JSON.stringify({
      cli: { version: ">= 5.9.1" },
      build: {
        development: { developmentClient: true, distribution: "internal", env: {} },
        preview: { distribution: "internal", android: { buildType: "apk" }, env: {} },
        production: { android: { buildType: "apk" }, env: { EXPO_TOKEN: extras.easToken || "" } },
      },
      submit: { production: {} },
    }, null, 2));
    zip.file("babel.config.js", `module.exports = function(api) {\n  api.cache(true);\n  return { presets: ['babel-preset-expo'] };\n};\n`);
    zip.file(".env.example", `# Cole seu token EAS aqui\nEXPO_TOKEN=${extras.easToken || "seu_token_eas_aqui"}\n`);
    zip.file("package.json", JSON.stringify({
      name, version: pkg.version || "1.0.0", main: "node_modules/expo/AppEntry.js",
      scripts: { start: "expo start", android: "expo run:android", ios: "expo run:ios", web: "expo start --web", "build:apk": "eas build --platform android --profile preview" },
      dependencies: { expo: "~51.0.0", "expo-status-bar": "~1.12.1", react: "18.2.0", "react-native": "0.74.1", ...cleanDeps(pkg.dependencies) },
      devDependencies: { "@babel/core": "^7.20.0", "typescript": "^5.1.3" },
    }, null, 2));
    zip.file("README-EAS.md", `# Build APK via EAS\n\n## Pré-requisitos\n\`\`\`bash\nnpm install -g @expo/eas-cli\nnpm install\nexpo login\neas login\n\`\`\`\n\n## Configurar token EAS\n1. Acesse https://expo.dev/accounts/[user]/settings/access-tokens\n2. Crie um token e cole no \`.env\`\n\n## Build APK\n\`\`\`bash\neas build --platform android --profile preview\n# ou para produção:\neas build --platform android --profile production\n\`\`\`\n\n## Build local (sem EAS cloud)\n\`\`\`bash\neas build --platform android --profile preview --local\n\`\`\`\n`);

  } else if (target === "capacitor") {
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", makeCleanPkg(pkg, name, {
      dependencies: { ...cleanDeps(pkg.dependencies), "@capacitor/core": "^6.0.0", "@capacitor/android": "^6.0.0", "@capacitor/ios": "^6.0.0", "@capacitor/cli": "^6.0.0" },
    }));
    zip.file("capacitor.config.ts", `import { CapacitorConfig } from '@capacitor/cli';\n\nconst config: CapacitorConfig = {\n  appId: 'com.${name.replace(/-/g,"")}.app',\n  appName: '${projectName}',\n  webDir: 'dist',\n  bundledWebRuntime: false,\n  server: {\n    androidScheme: 'https',\n  },\n};\n\nexport default config;\n`);
    zip.file("android/build.gradle", `buildscript {\n  repositories { google(); mavenCentral() }\n  dependencies { classpath 'com.android.tools.build:gradle:8.2.2' }\n}\nallprojects { repositories { google(); mavenCentral() } }\n`);
    zip.file("android/app/build.gradle", `apply plugin: 'com.android.application'\nandroid {\n  compileSdkVersion 34\n  defaultConfig {\n    applicationId "com.${name.replace(/-/g,"")}.app"\n    minSdkVersion 22\n    targetSdkVersion 34\n    versionCode 1\n    versionName "${pkg.version || "1.0.0"}"\n  }\n  buildTypes { release { minifyEnabled false } }\n}\n`);
    zip.file("android/app/src/main/AndroidManifest.xml", `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <uses-permission android:name="android.permission.INTERNET" />\n  <application android:label="${projectName}" android:usesCleartextTraffic="true">\n    <activity android:name=".MainActivity" android:exported="true">\n      <intent-filter>\n        <action android:name="android.intent.action.MAIN" />\n        <category android:name="android.intent.category.LAUNCHER" />\n      </intent-filter>\n    </activity>\n  </application>\n</manifest>\n`);
    zip.file("android/app/src/main/res/values/strings.xml", `<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="app_name">${projectName}</string></resources>\n`);
    zip.file("scripts/build-android.sh", `#!/bin/bash\nset -e\necho "Construindo projeto web..."\nnpm run build\necho "Sincronizando com Capacitor..."\nnpx cap sync android\necho "Pronto! Abra 'android/' no Android Studio para gerar o APK."\n`);
    zip.file("README-CAPACITOR.md", `# APK via Capacitor\n\n## Instalar dependências\n\`\`\`bash\nnpm install\nnpm install @capacitor/core @capacitor/android @capacitor/ios @capacitor/cli\n\`\`\`\n\n## Inicializar Capacitor (primeira vez)\n\`\`\`bash\nnpx cap init "${projectName}" "com.${name.replace(/-/g,"")}.app" --web-dir dist\nnpx cap add android\n\`\`\`\n\n## Build e gerar APK\n\`\`\`bash\nnpm run build\nnpx cap sync\nnpx cap open android\n# No Android Studio: Build → Generate Signed APK\n\`\`\`\n\n## Build APK por linha de comando\n\`\`\`bash\nbash scripts/build-android.sh\ncd android && ./gradlew assembleDebug\n# APK estará em: android/app/build/outputs/apk/debug/app-debug.apk\n\`\`\`\n`);

  } else if (target === "githubpages") {
    const repo = extras.ghRepo || name;
    const viteGhPages = CLEAN_VITE_CONFIG.replace("outDir: \"dist\"", `outDir: "dist",\n    // GitHub Pages base path\n    // base: "/${repo}/",  // Descomente se o repo não for o site principal`);
    zip.file("vite.config.ts", viteGhPages);
    zip.file("package.json", makeCleanPkg(pkg, name));
    zip.file(".github/workflows/deploy.yml", `name: Deploy to GitHub Pages\n\non:\n  push:\n    branches: [main, master]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n  pages: write\n  id-token: write\n\nconcurrency:\n  group: "pages"\n  cancel-in-progress: false\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: '20', cache: 'npm' }\n      - run: npm ci\n      - run: npm run build\n      - uses: actions/upload-pages-artifact@v3\n        with: { path: ./dist }\n\n  deploy:\n    environment:\n      name: github-pages\n      url: \${{ steps.deployment.outputs.page_url }}\n    runs-on: ubuntu-latest\n    needs: build\n    steps:\n      - id: deployment\n        uses: actions/deploy-pages@v4\n`);
    zip.file("README-GHPAGES.md", `# Deploy no GitHub Pages\n\n## Setup inicial\n1. Crie um repositório no GitHub\n2. \`git init && git add . && git commit -m "inicial" && git remote add origin https://github.com/${extras.ghUser || "SEU_USUARIO"}/${repo}.git\`\n3. \`git push -u origin main\`\n\n## Habilitar GitHub Pages\n1. Acesse Settings → Pages no repositório\n2. Em **Source**, selecione **GitHub Actions**\n3. O deploy ocorrerá automaticamente a cada push em main\n\n## URL do site\nhttps://${extras.ghUser || "SEU_USUARIO"}.github.io/${repo}/\n\n## Build manual\n\`\`\`bash\nnpm install\nnpm run build\n# Os arquivos ficam em dist/\n\`\`\`\n`);

  } else if (target === "electron") {
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", JSON.stringify({
      name, version: pkg.version || "1.0.0", description: pkg.description || name,
      main: "electron/main.js", type: "commonjs",
      scripts: {
        dev: "vite",
        build: "vite build",
        "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
        "electron:build": "npm run build && electron-builder",
      },
      dependencies: cleanDeps(pkg.dependencies),
      devDependencies: {
        ...cleanDeps(pkg.devDependencies),
        electron: "^29.0.0",
        "electron-builder": "^24.0.0",
        concurrently: "^8.0.0",
        "wait-on": "^7.0.0",
        vite: "^6.0.0",
        "@vitejs/plugin-react": "^4.0.0",
      },
    }, null, 2));
    zip.file("electron/main.js", `const { app, BrowserWindow } = require('electron');\nconst path = require('path');\nconst isDev = process.env.NODE_ENV === 'development';\n\nfunction createWindow() {\n  const win = new BrowserWindow({\n    width: 1280, height: 800,\n    webPreferences: {\n      nodeIntegration: false,\n      contextIsolation: true,\n      preload: path.join(__dirname, 'preload.js'),\n    },\n    title: '${projectName}',\n  });\n\n  if (isDev) {\n    win.loadURL('http://localhost:5173');\n    win.webContents.openDevTools();\n  } else {\n    win.loadFile(path.join(__dirname, '../dist/index.html'));\n  }\n}\n\napp.whenReady().then(() => {\n  createWindow();\n  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });\n});\n\napp.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });\n`);
    zip.file("electron/preload.js", `const { contextBridge, ipcRenderer } = require('electron');\n\ncontextBridge.exposeInMainWorld('electronAPI', {\n  platform: process.platform,\n  versions: process.versions,\n});\n`);
    zip.file("electron-builder.yml", `appId: com.${name.replace(/-/g,"")}.app\nproductName: "${projectName}"\ndirectories:\n  buildResources: assets\n  output: dist-electron\nfiles:\n  - dist/**/*\n  - electron/**/*\n  - package.json\nwin:\n  target:\n    - target: nsis\n      arch: [x64]\nmac:\n  target: dmg\nlinux:\n  target: AppImage\n`);
    zip.file("README-ELECTRON.md", `# Executável Desktop (Electron)\n\n## Instalar\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Desenvolver\n\`\`\`bash\nnpm run electron:dev\n\`\`\`\n\n## Build executável\n\`\`\`bash\nnpm run electron:build\n\`\`\`\n\nOs executáveis ficarão em \`dist-electron/\`:\n- **Windows**: \`.exe\` (instalador NSIS)\n- **macOS**: \`.dmg\`\n- **Linux**: \`.AppImage\`\n`);

  } else if (target === "pwa") {
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", makeCleanPkg(pkg, name));
    const manifest = {
      name: projectName, short_name: name, start_url: "/",
      display: "standalone", background_color: "#111a0a", theme_color: "#2d5a1b",
      description: `App ${projectName} — instalável sem loja`,
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
    };
    zip.file("public/manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("public/sw.js", `// Service Worker — ${projectName}
const CACHE_NAME = 'pwa-cache-v1';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
`);
    zip.file("index.html", `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#2d5a1b" />
  <meta name="description" content="${projectName} — app instalável" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="${projectName}" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icon-192.png" />
  <title>${projectName}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(r => console.log('[PWA] SW registrado:', r.scope))
          .catch(e => console.warn('[PWA] SW falhou:', e));
      });
    }
  </script>
</body>
</html>
`);
    zip.file("README-PWA.md", `# PWA — ${projectName}

## O que está incluso

| Arquivo | Função |
|---|---|
| \`index.html\` | HTML completo com manifest + SW registration |
| \`public/manifest.json\` | Manifesto PWA (nome, ícones, tema) |
| \`public/sw.js\` | Service Worker com cache offline |

## Como publicar

### Netlify (mais fácil)
\`\`\`bash
npm install
npm run build
# Arraste a pasta dist/ para https://app.netlify.com/drop
\`\`\`

### Vercel
\`\`\`bash
npm install
npx vercel
\`\`\`

## Como instalar no celular

1. Publique em algum host HTTPS (Netlify, Vercel, GitHub Pages)
2. Acesse a URL no Chrome (Android) ou Safari (iPhone)
3. Menu → **"Adicionar à tela inicial"** ou **"Instalar app"**
4. ✅ O app fica no celular sem loja!

## Tags importantes do index.html

\`\`\`html
<!-- Manifesto PWA -->
<link rel="manifest" href="/manifest.json">

<!-- Tema e cor de fundo -->
<meta name="theme-color" content="#2d5a1b">

<!-- Suporte iPhone -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${projectName}">

<!-- Ícone no iPhone -->
<link rel="apple-touch-icon" href="/icon-192.png">
\`\`\`

## Service Worker (public/sw.js)
Já configurado com:
- Cache de assets na instalação
- Estratégia "cache first" para requests GET
- Limpeza automática de versões antigas
- Fallback para /index.html (SPA routing)
`);

  } else if (target === "git") {
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", makeCleanPkg(pkg, name));
    zip.file(".github/workflows/ci.yml", `name: CI\non: [push, pull_request]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: '20' }\n      - run: npm ci\n      - run: npm run build\n      - uses: actions/upload-artifact@v4\n        with: { name: dist, path: dist/ }\n`);
    zip.file("README-GIT.md", `# Deploy via Git\n\n## Setup inicial\n\`\`\`bash\ngit init\ngit add .\ngit commit -m "feat: versão inicial"\n\`\`\`\n\n## Conectar ao GitHub\n\`\`\`bash\ngit remote add origin https://github.com/${extras.ghUser || "SEU_USUARIO"}/${extras.ghRepo || name}.git\ngit push -u origin main\n\`\`\`\n\n## Vercel (deploy automático)\n\`\`\`bash\nnpm i -g vercel\nvercel\n\`\`\`\n\n## Netlify\n\`\`\`bash\nnpm i -g netlify-cli\nnetlify deploy --dir dist --prod\n\`\`\`\n`);

  } else if (target === "netlify") {
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", makeCleanPkg(pkg, name));
    zip.file("netlify.toml", `[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`);
    zip.file("README-NETLIFY.md", `# Deploy no Netlify

## Método 1 — Arrastar e soltar (mais fácil)
1. Rode \`npm install && npm run build\` localmente
2. Acesse https://app.netlify.com/drop
3. Arraste a pasta \`dist/\` para a área de deploy
4. ✅ Site publicado com URL automática!

## Método 2 — Via CLI
\`\`\`bash
npm install
npm run build
npx netlify-cli deploy --dir dist --prod
\`\`\`

## Método 3 — Via GitHub (deploy automático)
1. Envie o projeto para um repositório GitHub
2. Acesse https://app.netlify.com → "Add new site" → "Import from Git"
3. Configure:
   - Build command: \`npm run build\`
   - Publish directory: \`dist\`
4. ✅ Deploy automático a cada push!

## URL do seu site
Após o deploy, a Netlify fornece uma URL gratuita como:
\`https://seu-nome-abc123.netlify.app\`

Você pode configurar um domínio personalizado grátis.
`);

  } else if (target === "vercel") {
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", makeCleanPkg(pkg, name));
    zip.file("vercel.json", JSON.stringify({
      buildCommand: "npm run build",
      outputDirectory: "dist",
      framework: "vite",
      rewrites: [{ source: "/(.*)", destination: "/index.html" }],
    }, null, 2));
    zip.file(".vercelignore", `node_modules\n.env\n*.log\n`);
    zip.file("README-VERCEL.md", `# Deploy na Vercel

## Método 1 — Via CLI (mais rápido)
\`\`\`bash
npm install
npm run build
npx vercel
# Siga as instruções no terminal
# Responda: "Qual framework?" → Vite
\`\`\`

## Método 2 — Via importação do GitHub
1. Envie o projeto para um repositório GitHub
2. Acesse https://vercel.com/new
3. Importe o repositório
4. Vercel detecta Vite automaticamente
5. ✅ Deploy automático a cada push!

## Método 3 — Via drag-and-drop
1. Rode \`npm run build\` localmente  
2. Acesse https://vercel.com/new
3. Arraste a pasta \`dist/\` 
4. ✅ Online em segundos!

## URL do site
Após o deploy:
\`https://seu-projeto.vercel.app\`

SSL gratuito e CDN global incluídos.
`);

  } else { // clean
    zip.file("vite.config.ts", CLEAN_VITE_CONFIG);
    zip.file("package.json", makeCleanPkg(pkg, name));
    zip.file("README.md", `# ${projectName}\n\n## Instalação\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Desenvolvimento\n\`\`\`bash\nnpm run dev\n# Acesse http://localhost:5173\n\`\`\`\n\n## Build de produção\n\`\`\`bash\nnpm run build\nnpm run preview\n\`\`\`\n\n## Publicar online\n\n### Netlify (grátis)\n1. \`npm run build\`\n2. Arraste a pasta \`dist/\` para https://app.netlify.com/drop\n\n### Vercel (grátis)\n\`\`\`bash\nnpx vercel\n\`\`\`\n\n## Estrutura do projeto\n\`\`\`\nsrc/\n  components/   # Componentes React\n  lib/          # Utilitários e serviços\n  App.tsx       # Componente raiz\n  main.tsx      # Ponto de entrada\n\`\`\`\n`);
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function BuildPanel({ vfs, projectName, onClose, onRunCommand }: BuildPanelProps) {
  const [expanded, setExpanded] = useState<BuildTarget | null>(null);
  const [easToken, setEasToken] = useState(() => localStorage.getItem("sk-eas-token") || "");
  const [githubUser, setGithubUser] = useState(() => localStorage.getItem("sk-gh-user") || "");
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem("sk-gh-repo") || projectName.toLowerCase().replace(/\s+/g, "-"));
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem("sk-gh-token") || "");
  const [generating, setGenerating] = useState<BuildTarget | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [showPlayground, setShowPlayground] = useState(false);

  const toggle = (id: BuildTarget) => setExpanded(e => e === id ? null : id);

  const saveConfig = useCallback(() => {
    localStorage.setItem("sk-eas-token", easToken);
    localStorage.setItem("sk-gh-user", githubUser);
    localStorage.setItem("sk-gh-repo", githubRepo);
    localStorage.setItem("sk-gh-token", githubToken);
  }, [easToken, githubUser, githubRepo, githubToken]);

  const handleDownloadZip = useCallback(async (target: BuildTarget) => {
    setGenerating(target); setGenerated(null);
    try {
      saveConfig();
      const blob = await generatePlatformZip(target, vfs, projectName, {
        easToken, ghUser: githubUser, ghRepo: githubRepo, ghToken: githubToken,
      });
      const labels: Record<string, string> = {
        eas: "eas", capacitor: "capacitor", githubpages: "github-pages",
        electron: "electron", pwa: "pwa", git: "git", clean: "clean",
        netlify: "netlify", vercel: "vercel",
      };
      saveAs(blob, `${projectName.toLowerCase().replace(/\s+/g, "-")}-${labels[target]}.zip`);
      setGenerated(`✅ ZIP ${target} gerado com sucesso!`);
    } catch (e: any) {
      setGenerated(`❌ Erro: ${e.message}`);
    } finally { setGenerating(null); }
  }, [vfs, projectName, easToken, githubUser, githubRepo, githubToken, saveConfig]);

  const handleDownloadAll = useCallback(async () => {
    setGeneratingAll(true); setGenerated(null);
    try {
      saveConfig();
      const targets: BuildTarget[] = ["clean", "netlify", "vercel", "githubpages", "pwa", "capacitor", "eas", "electron"];
      const superZip = new JSZip();
      for (const target of targets) {
        const blob = await generatePlatformZip(target, vfs, projectName, {
          easToken, ghUser: githubUser, ghRepo: githubRepo, ghToken: githubToken,
        });
        const bytes = await blob.arrayBuffer();
        const labels: Record<string, string> = {
          eas: "eas", capacitor: "capacitor", githubpages: "github-pages",
          electron: "electron", pwa: "pwa", git: "git", clean: "clean",
          netlify: "netlify", vercel: "vercel",
        };
        superZip.file(`${projectName.toLowerCase().replace(/\s+/g, "-")}-${labels[target]}.zip`, bytes);
      }
      const finalBlob = await superZip.generateAsync({ type: "blob" });
      saveAs(finalBlob, `${projectName.toLowerCase().replace(/\s+/g, "-")}-todos-os-builds.zip`);
      setGenerated("✅ Todos os ZIPs gerados com sucesso!");
    } catch (e: any) { setGenerated(`❌ Erro: ${e.message}`); }
    finally { setGeneratingAll(false); }
  }, [vfs, projectName, easToken, githubUser, githubRepo, githubToken, saveConfig]);

  const [planGenerated, setPlanGenerated] = useState(false);

  const handleGeneratePlano = useCallback(() => {
    const name = projectName;
    const allFiles = vfs.listFiles();
    const readSafe = (p: string) => { try { return vfs.readFile(p) || ""; } catch { return ""; } };

    let pkg: any = {};
    try { pkg = JSON.parse(readSafe("package.json")); } catch {}
    const deps: Record<string, string> = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const depNames = Object.keys(deps);

    const hasReact    = depNames.includes("react") || allFiles.some(f => f.endsWith(".tsx") || f.endsWith(".jsx"));
    const hasVite     = depNames.includes("vite");
    const hasNext     = depNames.includes("next");
    const hasExpress  = depNames.includes("express");
    const hasTS       = depNames.includes("typescript") || allFiles.some(f => f.endsWith(".ts") || f.endsWith(".tsx"));
    const hasTailwind = depNames.includes("tailwindcss");
    const hasPostgres = depNames.includes("pg") || depNames.includes("@neondatabase/serverless") || depNames.includes("postgres");
    const hasPrisma   = depNames.includes("@prisma/client") || depNames.includes("prisma");
    const hasMongo    = depNames.includes("mongoose") || depNames.includes("mongodb");
    const hasPython   = allFiles.some(f => f.endsWith(".py"));
    const hasHTML     = allFiles.some(f => f.endsWith(".html"));

    const stackFront: string[] = [];
    if (hasNext) stackFront.push("Next.js");
    else if (hasReact) stackFront.push(`React${hasVite ? " + Vite" : ""}`);
    if (hasTS) stackFront.push("TypeScript");
    if (hasTailwind) stackFront.push("Tailwind CSS");
    if (hasPython) stackFront.push("Python");
    if (hasHTML && !hasReact && !hasPython) stackFront.push("HTML/CSS/JS");

    const stackBack: string[] = [];
    if (hasExpress) stackBack.push("Node.js + Express");
    if (hasPostgres) stackBack.push("PostgreSQL");
    if (hasPrisma)  stackBack.push("Prisma ORM");
    if (hasMongo)   stackBack.push("MongoDB");

    const apiRoutes: string[] = [];
    allFiles.filter(f => f.endsWith(".ts") || f.endsWith(".js")).forEach(f => {
      const content = readSafe(f);
      const re = /(?:router|app)\.(get|post|put|patch|delete|use)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
      let m: RegExpExecArray | null;
      const reI = new RegExp(re.source, "gi");
      while ((m = reI.exec(content)) !== null) {
        const method = m[1].toUpperCase().padEnd(6);
        const path = m[2];
        if (!path.includes("{{") && path !== "/") apiRoutes.push(`${method} ${path}  (${f})`);
      }
    });

    const envVars = new Set<string>();
    allFiles.filter(f => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".py")).forEach(f => {
      const content = readSafe(f);
      const reI = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
      let m: RegExpExecArray | null;
      while ((m = reI.exec(content)) !== null) { if (m[1] !== "NODE_ENV") envVars.add(m[1]); }
    });
    [".env", ".env.example"].forEach(ef => {
      readSafe(ef).split("\n").forEach(line => {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
        if (m) envVars.add(m[1]);
      });
    });

    type TNode = { [k: string]: TNode };
    const root: TNode = {};
    allFiles.forEach(f => {
      const parts = f.split("/"); let cur = root;
      parts.forEach(p => { if (!cur[p]) cur[p] = {}; cur = cur[p]; });
    });
    function sortK(t: TNode) {
      return Object.keys(t).sort((a, b) => {
        const aD = Object.keys(t[a]).length > 0, bD = Object.keys(t[b]).length > 0;
        if (aD && !bD) return -1; if (!aD && bD) return 1;
        return a.localeCompare(b);
      });
    }
    function renderT(t: TNode, prefix: string, nm: string, isLast: boolean): string {
      const conn = isLast ? "└── " : "├── ";
      const keys = sortK(t); const isDir = keys.length > 0;
      let r = prefix + conn + nm + (isDir ? "/" : "") + "\n";
      keys.forEach((k, i) => { r += renderT(t[k], prefix + (isLast ? "    " : "│   "), k, i === keys.length - 1); });
      return r;
    }
    const topK = sortK(root);
    const asciiTree = topK.map((k, i) => renderT(root[k], "", k, i === topK.length - 1).trimEnd()).join("\n");

    const appType = hasNext ? "Full-Stack (Next.js)"
      : (hasReact && hasExpress) ? "Full-Stack (React + Express)"
      : hasReact ? "Frontend (React)"
      : hasExpress ? "Backend/API (Node.js + Express)"
      : hasHTML ? "Site Web (HTML/CSS/JS)"
      : hasPython ? "Aplicação Python"
      : "Projeto de Código";

    const scripts = pkg.scripts || {};
    const totalLines = allFiles.reduce((s, f) => s + readSafe(f).split("\n").length, 0);
    const now = new Date().toLocaleString("pt-BR");
    const slug = name.toLowerCase().replace(/\s+/g, "-");

    const depDeps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    const plano = `# PLANO DO PROJETO: ${name}

> Gerado em: ${now}
> Arquivos: ${allFiles.length} | Linhas de código: ~${totalLines.toLocaleString("pt-BR")}

---

## RESUMO EXECUTIVO

- **Tipo:** ${appType}
${stackFront.length ? `- **Frontend/Stack:** ${stackFront.join(", ")}` : ""}
${stackBack.length ? `- **Backend/Dados:** ${stackBack.join(", ")}` : ""}
${pkg.version ? `- **Versão:** ${pkg.version}` : ""}
${pkg.description ? `- **Descrição:** ${pkg.description}` : ""}
${pkg.author ? `- **Autor:** ${pkg.author}` : ""}

---

## ESTRUTURA DE ARQUIVOS

\`\`\`
${name}/
${asciiTree}
\`\`\`

---
${apiRoutes.length > 0 ? `
## ROTAS DA API DETECTADAS (${apiRoutes.length} endpoint(s))

\`\`\`
${apiRoutes.join("\n")}
\`\`\`

---
` : ""}${Object.keys(scripts).length > 0 ? `
## SCRIPTS DISPONÍVEIS (package.json)

\`\`\`bash
${Object.entries(scripts).map(([k, v]) => `npm run ${k.padEnd(12)}  # ${v}`).join("\n")}
\`\`\`

---
` : ""}${envVars.size > 0 ? `
## VARIÁVEIS DE AMBIENTE NECESSÁRIAS

Crie o arquivo \`.env\` na raiz do projeto:

\`\`\`env
${[...envVars].map(v => `${v}=seu_valor_aqui`).join("\n")}
\`\`\`

---
` : ""}
## DEPENDÊNCIAS (${depNames.length} pacotes)

${depDeps.length > 0 ? `### Produção (${depDeps.length})\n${depDeps.map(d => `- \`${d}\` ${deps[d]}`).join("\n")}` : ""}

${devDeps.length > 0 ? `### Desenvolvimento (${devDeps.length})\n${devDeps.map(d => `- \`${d}\` ${deps[d]}`).join("\n")}` : ""}

---

## GUIA COMPLETO PARA RECRIAR DO ZERO

> Siga este passo a passo em qualquer máquina com Node.js instalado para recriar o projeto ${name}.

### Pré-requisitos

\`\`\`bash
# Verificar Node.js 20+ instalado
node -v   # precisa ser v20 ou superior
npm -v    # precisa ser 10 ou superior
\`\`\`

> Não tem Node.js? Baixe em: https://nodejs.org (escolha LTS)

---

### Passo 1 — Criar a estrutura do projeto

\`\`\`bash
${hasNext
  ? `# Next.js
npx create-next-app@latest ${slug} --typescript --tailwind --eslint
cd ${slug}`
  : hasReact && hasVite
  ? `# React + Vite + TypeScript
npm create vite@latest ${slug} -- --template react-ts
cd ${slug}`
  : hasReact
  ? `# React com Create React App
npx create-react-app ${slug} --template typescript
cd ${slug}`
  : `# Projeto Node.js
mkdir ${slug} && cd ${slug}
npm init -y`}
\`\`\`

---

### Passo 2 — Instalar dependências

\`\`\`bash
${depDeps.length > 0 ? `# Dependências de produção\nnpm install ${depDeps.join(" ")}` : "# Nenhuma dependência de produção detectada"}

${devDeps.length > 0 ? `# Dependências de desenvolvimento\nnpm install --save-dev ${devDeps.join(" ")}` : ""}
\`\`\`

---

### Passo 3 — Recriar os arquivos do projeto

> Importe o ZIP do projeto pelo SK Editor (ícone 📁 → Importar ZIP)
> ou copie os ${allFiles.length} arquivos manualmente:

\`\`\`
${allFiles.join("\n")}
\`\`\`

---
${envVars.size > 0 ? `
### Passo 4 — Configurar variáveis de ambiente

\`\`\`bash
# Crie o arquivo .env na raiz do projeto:
cat > .env << 'EOF'
${[...envVars].map(v => `${v}=seu_valor_aqui`).join("\n")}
EOF
\`\`\`

> ⚠️ NUNCA versione o .env no GitHub! Adicione ao .gitignore.

---
` : ""}
### Passo ${envVars.size > 0 ? "5" : "4"} — Rodar o projeto

\`\`\`bash
${scripts.dev ? "npm run dev" : scripts.start ? "npm start" : hasPython ? "python main.py" : "npm start"}
# O projeto estará disponível em http://localhost:${scripts.dev ? "5173" : "3000"}
\`\`\`

---
${hasPostgres || hasPrisma ? `
### Passo extra — Configurar banco de dados
${hasPrisma ? `\`\`\`bash
# Executar migrações Prisma
npx prisma generate
npx prisma migrate dev --name init
npx prisma studio  # interface visual (opcional)
\`\`\`` : ""}
${hasPostgres && !hasPrisma ? `> Configure a variável DATABASE_URL no .env com sua connection string PostgreSQL.` : ""}

---
` : ""}

## CONTEXTO PARA IA

> Copie e cole este bloco para continuar o projeto em qualquer IA (ChatGPT, Gemini, Claude...):

\`\`\`
Projeto: ${name}
Tipo: ${appType}
Stack: ${[...stackFront, ...stackBack].join(", ") || "Não detectado"}
Arquivos: ${allFiles.length} | Linhas: ~${totalLines.toLocaleString("pt-BR")}
${apiRoutes.length ? `Rotas API detectadas: ${apiRoutes.length}\n${apiRoutes.join("\n")}` : ""}
${envVars.size ? `Variáveis de ambiente: ${[...envVars].join(", ")}` : ""}

Estrutura completa do projeto:
${allFiles.join("\n")}
\`\`\`

---

## CHECKLIST DE RECRIAÇÃO

- [ ] Node.js 20+ instalado
- [ ] Projeto criado (\`npm create vite\` ou similar)
- [ ] Dependências instaladas (\`npm install\`)
${envVars.size > 0 ? "- [ ] Arquivo .env configurado com as variáveis necessárias" : ""}
${hasPostgres ? "- [ ] Banco de dados PostgreSQL configurado e acessível" : ""}
${hasPrisma ? "- [ ] Migrações Prisma executadas (\`npx prisma migrate dev\`)" : ""}
- [ ] Projeto rodando localmente sem erros
${scripts.build ? "- [ ] Build de produção testado (\`npm run build\`)" : ""}
- [ ] Deploy/publicação configurado (Netlify, Vercel, Replit...)

---

## FASES DE PUBLICAÇÃO

### Web (mais fácil — recomendado primeiro)
1. Baixe o ZIP **Netlify** em Build & Deploy
2. Extraia → \`npm install && npm run build\`
3. Arraste a pasta \`dist/\` para https://app.netlify.com/drop
4. ✅ URL pública em segundos!

### PWA no celular (sem APK)
1. Publique na web (passo acima)
2. Acesse no Chrome do Android → Menu → "Adicionar à tela inicial"
3. ✅ App instalado sem loja!

### APK Android
1. Baixe o ZIP **Capacitor** ou **EAS** em Build & Deploy
2. Siga as instruções do README dentro do ZIP

### Executável Desktop (Windows/Linux)
1. Baixe **MaikonJuridicoPro-windows.zip** ou **MaikonJuridicoPro-linux.AppImage**
   na seção "Executável Desktop — Electron"
2. Extraia e execute — roda offline, sem instalar nada

---

*Plano gerado automaticamente pelo SK Code Editor — ${now}*
`;

    vfs.writeFile("PLANO.md", plano);
    setPlanGenerated(true);
    setTimeout(() => setPlanGenerated(false), 3000);
  }, [projectName, vfs]);

  const files = vfs.listFiles();
  const hasPkg = files.some(f => f === "package.json");
  const hasIndexHtml = files.some(f => f === "index.html" || f.endsWith("/index.html"));

  const sectionContent: Record<BuildTarget, React.ReactNode> = {
    eas: (
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2 text-[12px] text-yellow-400 bg-yellow-900/10 border border-yellow-700/30 rounded-xl p-2.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>Requer conta <a href="https://expo.dev" target="_blank" rel="noreferrer" className="underline">expo.dev</a> + <a href="https://expo.dev/eas" target="_blank" rel="noreferrer" className="underline">EAS CLI</a> instalado</span>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Token EAS</label>
          <div className="flex gap-2">
            <input type="password" value={easToken} onChange={e => setEasToken(e.target.value)} placeholder="expo_..." className="flex-1 px-3 py-2 bg-[#0d1117] border border-gray-700/50 rounded-xl text-[12px] text-gray-200 outline-none focus:border-blue-500/60" />
            <button onClick={saveConfig} className="px-3 py-2 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-300 text-[12px] hover:bg-blue-600/30"><Key size={12} /></button>
          </div>
        </div>
        <div className="text-[12px] text-gray-500 font-semibold">Comandos:</div>
        <CodeBlock code={`npm install -g @expo/eas-cli\nnpm install\nexpo login\neas login\neas build --platform android --profile preview`} onCopy={() => onRunCommand?.("eas build --platform android --profile preview")} />
        <div className="text-[12px] text-gray-500 font-semibold">Build local (sem internet):</div>
        <CodeBlock code={`eas build --platform android --profile preview --local`} onCopy={() => onRunCommand?.("eas build --platform android --profile preview --local")} />
      </div>
    ),
    capacitor: (
      <div className="space-y-3 p-3">
        <div className="text-[12px] text-gray-500 font-semibold">Instalar Capacitor:</div>
        <CodeBlock code={`npm install\nnpm install @capacitor/core @capacitor/android @capacitor/cli\nnpx cap init\nnpx cap add android`} onCopy={() => onRunCommand?.("npm install @capacitor/core @capacitor/android @capacitor/cli")} />
        <div className="text-[12px] text-gray-500 font-semibold">Build APK:</div>
        <CodeBlock code={`npm run build\nnpx cap sync\nnpx cap open android\n# No Android Studio: Build → Generate Signed APK`} />
        <div className="text-[12px] text-gray-500 font-semibold">Build linha de comando:</div>
        <CodeBlock code={`npm run build && npx cap sync\ncd android && ./gradlew assembleDebug\n# APK: android/app/build/outputs/apk/debug/`} onCopy={() => onRunCommand?.("npm run build && npx cap sync")} />
      </div>
    ),
    githubpages: (
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Usuário GitHub</label>
            <input value={githubUser} onChange={e => setGithubUser(e.target.value)} placeholder="seu-usuario" className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700/50 rounded-xl text-[12px] text-gray-200 outline-none focus:border-green-500/60" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Nome do Repositório</label>
            <input value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="meu-projeto" className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700/50 rounded-xl text-[12px] text-gray-200 outline-none focus:border-green-500/60" />
          </div>
        </div>
        <div className="text-[12px] text-gray-500 font-semibold">Comandos:</div>
        <CodeBlock code={`git init && git add .\ngit commit -m "inicial"\ngit remote add origin https://github.com/${githubUser || "USUARIO"}/${githubRepo || "repo"}.git\ngit push -u origin main`} onCopy={() => onRunCommand?.("git init && git add . && git commit -m 'inicial'")} />
        <div className="text-[11px] text-gray-500">O workflow `.github/workflows/deploy.yml` fará o deploy automático no push.</div>
        {githubUser && githubRepo && (
          <a href={`https://${githubUser}.github.io/${githubRepo}/`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[12px] text-green-400 hover:underline">
            <ExternalLink size={11} /> {githubUser}.github.io/{githubRepo}/
          </a>
        )}
      </div>
    ),
    electron: (
      <div className="space-y-3 p-3">
        <div className="text-[12px] text-gray-500 font-semibold">Instalar dependências:</div>
        <CodeBlock code={`npm install\nnpm install --save-dev electron electron-builder concurrently wait-on`} onCopy={() => onRunCommand?.("npm install --save-dev electron electron-builder")} />
        <div className="text-[12px] text-gray-500 font-semibold">Desenvolver:</div>
        <CodeBlock code={`npm run electron:dev`} onCopy={() => onRunCommand?.("npm run electron:dev")} />
        <div className="text-[12px] text-gray-500 font-semibold">Build executável:</div>
        <CodeBlock code={`npm run electron:build\n# Saída em dist-electron/\n# Windows: .exe | macOS: .dmg | Linux: .AppImage`} onCopy={() => onRunCommand?.("npm run electron:build")} />
      </div>
    ),
    pwa: (
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2 text-[12px] text-blue-400 bg-blue-900/10 border border-blue-700/30 rounded-xl p-2.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>O ZIP inclui manifest.json e sw.js. Adicione as tags no index.html conforme o README.</span>
        </div>
        <div className="text-[12px] text-gray-500 font-semibold">Script de Service Worker incluído. Adicione no HTML:</div>
        <CodeBlock code={`<link rel="manifest" href="/manifest.json">\n<meta name="theme-color" content="#2d5a1b">`} />
        <div className="text-[12px] text-gray-500 font-semibold">Hospedar com HTTPS (GitHub Pages, Vercel, Netlify):</div>
        <CodeBlock code={`npm run build\n# Hospedar dist/ em qualquer servidor HTTPS`} onCopy={() => onRunCommand?.("npm run build")} />
      </div>
    ),
    git: (
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Usuário GitHub</label>
            <input value={githubUser} onChange={e => setGithubUser(e.target.value)} placeholder="seu-usuario" className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700/50 rounded-xl text-[12px] text-gray-200 outline-none focus:border-pink-500/60" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Token GitHub</label>
            <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_..." className="w-full px-3 py-2 bg-[#0d1117] border border-gray-700/50 rounded-xl text-[12px] text-gray-200 outline-none focus:border-pink-500/60" />
          </div>
        </div>
        <div className="text-[12px] text-gray-500 font-semibold">Criar repositório e fazer push:</div>
        <CodeBlock code={`git init && git add . && git commit -m "inicial"\ncurl -H "Authorization: token ${githubToken || "TOKEN"}" \\\n  https://api.github.com/user/repos \\\n  -d '{"name":"${githubRepo || "meu-repo"}","private":false}'\ngit remote add origin https://github.com/${githubUser || "USER"}/${githubRepo || "REPO"}.git\ngit push -u origin main`} onCopy={() => onRunCommand?.("git init && git add . && git commit -m 'inicial'")} />
        <div className="text-[12px] text-gray-500 font-semibold">Vercel (deploy rápido):</div>
        <CodeBlock code={`npx vercel`} onCopy={() => onRunCommand?.("npx vercel")} />
      </div>
    ),
    netlify: (
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2 text-[12px] text-teal-400 bg-teal-900/10 border border-teal-700/30 rounded-xl p-2.5">
          <span className="shrink-0">🔷</span>
          <span>Deploy grátis em <a href="https://netlify.com" target="_blank" rel="noreferrer" className="underline">netlify.com</a> — sem cartão de crédito.</span>
        </div>
        <div className="text-[12px] text-gray-500 font-semibold">Método mais fácil — arrastar pasta:</div>
        <CodeBlock code={`npm install\nnpm run build\n# Acesse https://app.netlify.com/drop\n# Arraste a pasta dist/ para o site`} onCopy={() => onRunCommand?.("npm run build")} />
        <div className="text-[12px] text-gray-500 font-semibold">Via CLI:</div>
        <CodeBlock code={`npm install\nnpm run build\nnpx netlify-cli deploy --dir dist --prod`} />
        <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[12px] text-teal-400 hover:underline">
          <ExternalLink size={11} /> Abrir Netlify Drop
        </a>
      </div>
    ),
    vercel: (
      <div className="space-y-3 p-3">
        <div className="flex items-start gap-2 text-[12px] text-gray-300 bg-gray-800/40 border border-gray-600/30 rounded-xl p-2.5">
          <span className="shrink-0">▲</span>
          <span>Deploy grátis em <a href="https://vercel.com" target="_blank" rel="noreferrer" className="underline">vercel.com</a> — SSL automático + CDN global.</span>
        </div>
        <div className="text-[12px] text-gray-500 font-semibold">Via CLI (recomendado):</div>
        <CodeBlock code={`npm install\nnpm run build\nnpx vercel\n# Siga o assistente: Framework → Vite\n# URL pública gerada automaticamente`} onCopy={() => onRunCommand?.("npm run build")} />
        <div className="text-[12px] text-gray-500 font-semibold">Via drag-and-drop:</div>
        <CodeBlock code={`npm run build\n# Acesse https://vercel.com/new\n# Arraste a pasta dist/`} />
        <a href="https://vercel.com/new" target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[12px] text-gray-300 hover:underline">
          <ExternalLink size={11} /> Abrir Vercel Dashboard
        </a>
      </div>
    ),
    clean: (
      <div className="space-y-3 p-3">
        <div className="text-[12px] text-gray-400">Versão limpa sem nenhuma dependência do Replit. Pronta para rodar localmente ou hospedar em qualquer servidor.</div>
        <div className="text-[12px] text-gray-500 font-semibold">Rodar localmente:</div>
        <CodeBlock code={`npm install\nnpm run dev\n# Acesse http://localhost:5173`} onCopy={() => onRunCommand?.("npm install && npm run dev")} />
        <div className="text-[12px] text-gray-500 font-semibold">Publicar online (mais fácil):</div>
        <CodeBlock code={`npm run build\n# Arraste dist/ para https://app.netlify.com/drop`} onCopy={() => onRunCommand?.("npm run build")} />
        <div className="space-y-1.5 bg-[#0d1117] border border-gray-800/40 rounded-xl p-3">
          <div className="text-[11px] text-gray-500 font-semibold">Conteúdo do ZIP:</div>
          <div className="text-[11px] text-gray-600 space-y-0.5">
            <div>✓ Todos os {files.length} arquivo(s) do projeto</div>
            <div>✓ package.json limpo (sem @replit/*)</div>
            <div>✓ vite.config.ts sem plugins Replit</div>
            <div>✓ .gitignore + README.md com instruções</div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <>
    <div className="fixed inset-0 z-[9990] flex flex-col bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60 bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-green-400" />
          <span className="text-[15px] font-bold text-white">Build & Deploy</span>
          {!hasPkg && !hasIndexHtml && (
            <span className="text-[11px] text-yellow-500 bg-yellow-900/20 border border-yellow-700/30 px-2 py-0.5 rounded-full">Projeto vazio</span>
          )}
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-gray-400"><X size={18} /></button>
      </div>

      {/* Botão "Baixar Todos" + PLANO.md */}
      <div className="px-4 py-3 border-b border-gray-700/30 shrink-0 bg-[#111622] space-y-2">
        <button
          onClick={handleDownloadAll}
          disabled={generatingAll}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-700/30 to-blue-700/30 border border-green-500/40 rounded-2xl text-[14px] text-white font-bold hover:from-green-600/40 hover:to-blue-600/40 transition-all disabled:opacity-60"
        >
          {generatingAll
            ? <><RefreshCw size={15} className="animate-spin" /> Gerando ZIPs ({SECTIONS.length} plataformas)...</>
            : <><Archive size={15} /> Baixar TODOS os ZIPs ({SECTIONS.length} plataformas)</>
          }
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleGeneratePlano}
            className="flex items-center justify-center gap-2 py-2.5 bg-amber-900/20 border border-amber-600/30 rounded-2xl text-[13px] text-amber-300 font-semibold hover:bg-amber-900/30 transition-all"
          >
            {planGenerated
              ? <><Check size={14} className="text-green-400" /> PLANO.md salvo!</>
              : <><FileCode2 size={14} /> Gerar PLANO.md</>
            }
          </button>
          <button
            onClick={() => setShowPlayground(true)}
            className="flex items-center justify-center gap-2 py-2.5 bg-orange-900/20 border border-orange-600/30 rounded-2xl text-[13px] text-orange-300 font-semibold hover:bg-orange-900/30 transition-all"
          >
            <Code2 size={14} /> Playground HTML
          </button>
        </div>
          {generated && (
          <div className={`text-[12px] text-center py-1.5 rounded-xl ${generated.startsWith("✅") ? "text-green-400 bg-green-900/20" : "text-red-400 bg-red-900/20"}`}>
            {generated}
          </div>
        )}
      </div>

      {/* ── Banner versão + changelog ─────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-700/30 shrink-0 bg-gradient-to-r from-purple-950/40 to-blue-950/20">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[18px]">📦</span>
          <div>
            <span className="text-[13px] font-bold text-white">Maikon Juridico Pro</span>
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-green-700/40 border border-green-600/30 text-green-300 font-bold">v1.2.0</span>
          </div>
          <span className="ml-auto text-[10px] text-gray-500">Build: 17/06/2026</span>
        </div>
        <div className="bg-black/20 border border-gray-700/30 rounded-xl px-3 py-2 space-y-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">O que há de novo nesta versão</p>
          {[
            "🚀 Terminal Real — npm install + npm run dev via SSE streaming com detecção de porta",
            "🔍 Preview automático — detecta porta do servidor e abre preview instantaneamente",
            "⚙️ /api/exec-stream — executa qualquer comando shell com saída em tempo real",
            "🔄 /api/proxy/:port/* — proxy para servers do usuário (React, Node, Python, etc.)",
            "💾 /api/settings — salva chaves AI no disco sem depender de Replit",
            "🛡 100% standalone — zero dependência de servidor externo, roda offline",
          ].map((item, i) => (
            <p key={i} className="text-[10px] text-gray-300 leading-relaxed">{item}</p>
          ))}
        </div>
      </div>

      {/* ── Executáveis compilados ────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-700/30 shrink-0 bg-[#0d1117]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-400">🖥</span>
          <span className="text-[12px] font-bold text-purple-300">Executável Desktop — Electron (pronto pra usar)</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <a
            href={`${import.meta.env.BASE_URL}downloads/MaikonJuridicoPro-linux.AppImage`}
            download="MaikonJuridicoPro-v1.2.0-linux.AppImage"
            className="flex items-center gap-2 px-3 py-2.5 bg-purple-900/20 border border-purple-500/40 rounded-xl hover:bg-purple-900/40 transition-colors text-purple-300"
          >
            <span className="text-[16px]">🐧</span>
            <div className="flex-1">
              <div className="text-[12px] font-bold">Linux — AppImage <span className="text-[10px] font-normal text-green-400 ml-1">v1.2.0</span></div>
              <div className="text-[10px] text-purple-400/70">Build 17/06/2026 · 64-bit · Baixe, dê permissão e execute</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-purple-400/60">849 MB</div>
              <Download size={12} className="ml-auto mt-0.5" />
            </div>
          </a>
          <a
            href={`${import.meta.env.BASE_URL}downloads/MaikonJuridicoPro-windows.zip`}
            download="MaikonJuridicoPro-v1.2.0-windows.zip"
            className="flex items-center gap-2 px-3 py-2.5 bg-blue-900/20 border border-blue-500/40 rounded-xl hover:bg-blue-900/40 transition-colors text-blue-300"
          >
            <span className="text-[16px]">🪟</span>
            <div className="flex-1">
              <div className="text-[12px] font-bold">Windows — Portátil <span className="text-[10px] font-normal text-green-400 ml-1">v1.2.0</span></div>
              <div className="text-[10px] text-blue-400/70">Build 17/06/2026 · 64-bit · Extraia e execute o .exe</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-blue-400/60">888 MB</div>
              <Download size={12} className="ml-auto mt-0.5" />
            </div>
          </a>
        </div>

        {/* ── Relatório de Independência ───────────────────────────────── */}
        <div className="mt-2.5 bg-green-950/30 border border-green-700/30 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[13px]">🛡</span>
            <span className="text-[11px] font-bold text-green-300">Certificado de Independência</span>
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-green-800/40 border border-green-600/30 text-green-400 font-bold">✓ LIMPO</span>
          </div>
          {[
            ["✅", "Servidor local 100% offline", "Roda em 127.0.0.1 com porta aleatória — igual ao app anterior que mostrava IP+porta"],
            ["✅", "Zero dependência Replit", "O executável NÃO chama nenhum servidor externo. Funciona sem internet."],
            ["✅", "Terminal real no PC", "Abre bash (Linux) ou cmd.exe (Windows) — npm, git, python rodam de verdade"],
            ["✅", "Projetos salvos no seu PC", "Pasta: ~/MaikonJuridicoPro/projetos/ — seus arquivos ficam só na sua máquina"],
            ["✅", "COOP/COEP habilitados", "Headers corretos para WebContainer — npm install real funciona no desktop"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex gap-1.5 items-start">
              <span className="text-[11px] shrink-0 mt-0.5">{icon}</span>
              <div>
                <span className="text-[10px] font-bold text-green-200">{title}</span>
                <span className="text-[10px] text-green-400/70 ml-1">— {desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 text-[10px] text-gray-600 text-center">
          App Electron completo · Roda 100% offline · Servidor local em 127.0.0.1
        </div>
      </div>

      {/* ── ZIP Limpo do SK Editor ────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-700/30 shrink-0 bg-[#0d1117]">
        <a
          href={`${import.meta.env.BASE_URL}downloads/sk-editor-source-v1.1.0-limpo.zip`}
          download="sk-editor-source-v1.1.0-limpo.zip"
          className="flex items-center gap-3 px-3 py-3 bg-yellow-950/40 border-2 border-yellow-500/50 rounded-xl hover:bg-yellow-900/40 transition-colors"
        >
          <span className="text-[22px]">📦</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-yellow-200">SK Editor — Código-Fonte Limpo</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-800/50 border border-green-600/40 text-green-300 font-bold">v1.1.0</span>
            </div>
            <div className="text-[10px] text-yellow-400/70 mt-0.5">Build 15/06/2026 · 109 arquivos · src/ + electron/ + configs · SEM node_modules</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-yellow-500/60">~0.4 MB</div>
            <Download size={13} className="ml-auto mt-0.5 text-yellow-400" />
          </div>
        </a>
        <p className="text-[10px] text-gray-600 text-center mt-1.5">
          Versão limpa para importar, corrigir e fazer novo build — sem mistura de versões anteriores
        </p>
      </div>

      {/* ── Backup pré-gerado do SK Editor ───────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-700/30 shrink-0 bg-[#0d1117]">
        <div className="flex items-center gap-2 mb-2">
          <HardDriveDownload size={14} className="text-yellow-400" />
          <span className="text-[12px] font-bold text-yellow-300">Projetos de Deploy — Pacotes prontos</span>
          <span className="text-[10px] text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded-full">~464 KB cada</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: "clean",        icon: "✨", label: "Versão Limpa",    color: "text-gray-300" },
            { name: "netlify",      icon: "🔷", label: "Netlify",         color: "text-teal-300" },
            { name: "vercel",       icon: "▲",  label: "Vercel",          color: "text-gray-200" },
            { name: "github-pages", icon: "🌐", label: "GitHub Pages",    color: "text-green-300" },
            { name: "pwa",          icon: "📲", label: "PWA",             color: "text-orange-300" },
            { name: "eas",          icon: "📱", label: "EAS (Expo APK)",  color: "text-blue-300" },
            { name: "capacitor",    icon: "⚡", label: "Capacitor APK",   color: "text-cyan-300" },
            { name: "electron",     icon: "🖥", label: "Electron Desktop",color: "text-purple-300" },
          ].map(item => (
            <a
              key={item.name}
              href={`${import.meta.env.BASE_URL}downloads/maikon-juridico-pro-${item.name}.zip`}
              download
              className={`flex items-center gap-1.5 px-2.5 py-2 bg-gray-900/60 border border-gray-700/40 rounded-xl hover:bg-gray-800/60 transition-colors ${item.color}`}
            >
              <span className="text-[13px]">{item.icon}</span>
              <span className="text-[11px] font-medium truncate">{item.label}</span>
              <Download size={10} className="ml-auto shrink-0 opacity-60" />
            </a>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-gray-600 text-center">
          Código-fonte real do SK Editor, sem dependências do Replit · Pronto para importar e rodar
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 space-y-2">
          {SECTIONS.map(sec => (
            <div key={sec.id} className={`border rounded-2xl overflow-hidden ${sec.color}`}>
              <button
                onClick={() => toggle(sec.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <span className="text-[18px]">{sec.icon}</span>
                <div className="flex-1 text-left">
                  <div className="text-[13px] font-bold">{sec.label}</div>
                  <div className="text-[11px] opacity-60">{sec.desc}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadZip(sec.id); }}
                    disabled={generating === sec.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-bold text-white transition-colors disabled:opacity-60"
                  >
                    {generating === sec.id
                      ? <RefreshCw size={11} className="animate-spin" />
                      : <Download size={11} />
                    }
                    {generating === sec.id ? "..." : "ZIP"}
                  </button>
                  {expanded === sec.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>
              {expanded === sec.id && (
                <div className="border-t border-white/10 bg-[#0d1117]/80">
                  {sectionContent[sec.id]}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 pb-4">
          <div className="bg-[#161b22] border border-gray-800/40 rounded-2xl p-4 space-y-2">
            <div className="text-[12px] text-gray-500 font-semibold uppercase tracking-wider">Projeto atual</div>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-gray-400">
              <div>📄 {files.length} arquivo(s)</div>
              <div>📦 {hasPkg ? "package.json ✓" : "sem package.json"}</div>
              <div>🌐 {hasIndexHtml ? "index.html ✓" : "sem index.html"}</div>
              <div>🔑 EAS token: {easToken ? "configurado ✓" : "não configurado"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {showPlayground && <HTMLPlayground onClose={() => setShowPlayground(false)} />}
    </>
  );
}
