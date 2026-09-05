# SK Editor v3 — Sem Replit
## Como rodar do codigo-fonte

### Pre-requisitos
- Node.js 20+
- pnpm: npm install -g pnpm

### Instalar e rodar
```
pnpm install
pnpm dev
```

### Build Electron (Windows)
```
pnpm build
npx electron-builder --win zip --x64
```

## Independencia do Replit
- Servidor: 127.0.0.1 (local)
- Projetos salvos em: ~/SKEditorV3/projetos/
- Zero chamadas externas
- Funciona 100% offline
