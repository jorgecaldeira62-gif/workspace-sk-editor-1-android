# SK-Editor v3 — Como Rodar Localmente

## Pré-requisito
- Node.js 18+ → https://nodejs.org (versão LTS)

## Rodar (2 terminais)

**Terminal 1 — Backend (API + Terminal real):**
```
node server.cjs
```

**Terminal 2 — Frontend:**
```
npm install
npm run dev
```

Depois abra: **http://localhost:5000**

---

## Ou rodar tudo junto:
```
npm install
npm run dev:full
```

---

## Configurar IA
Dentro do app → Configurações → cole sua chave:
- Claude: `sk-ant-...`
- Gemini: `AIza...` (gratuito: aistudio.google.com)
- Groq: `gsk_...` (gratuito: console.groq.com)
- OpenAI: `sk-...`

---

## Gerar executável .exe (Windows)
```
npm install
npm run electron:build:win
```
O .exe estará em `dist/electron/`

---

## Deploy no Netlify
1. `npm run build`
2. Sobe a pasta `dist/public/` no Netlify
3. ⚠️ O terminal NÃO funciona no Netlify (precisa de servidor)
4. O chat de IA funciona se configurar a chave no app

---

## Problemas comuns
| Erro | Solução |
|------|---------|
| `npm install` falha | Delete `node_modules` e tente de novo |
| `vite: not found` | Rode `npm install` primeiro |
| Terminal não responde | Verifique se `node server.cjs` está rodando |
| IA não responde | Configure a chave nas Configurações |
