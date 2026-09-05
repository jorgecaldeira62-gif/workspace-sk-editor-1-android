# SK Editor v3

Editor de código PWA/Electron com IA, terminal, banco de dados e assistente jurídico.

## Como rodar

```
pnpm install
pnpm dev
```

Acessa em: http://localhost:5000

## Estrutura principal

- `src/components/CampoLivre.tsx` — Chat de IA com auto-detecção de chave
- `src/components/AssistenteJuridico.tsx` — Processamento jurídico com IA
- `src/components/SKTerminal.tsx` — Terminal com suporte Electron, Termux e proxy
- `src/components/EditorLayout.tsx` — Editor principal com Monaco
- `src/lib/ai-service.ts` — Serviço de IA multi-provedor

## Dependências

O projeto usa pnpm com workspace catalog (pnpm-workspace.yaml).

## User preferences

- Interface em português brasileiro
- Auto-detecção de chave de API: basta colar a chave e o provedor é detectado automaticamente (gsk_=Groq, sk-=OpenAI, AIza=Gemini, sk-or-=OpenRouter, xai-=xAI, sk-ant=Anthropic)
- Terminal deve auto-iniciar no Electron
- Botões rápidos de npm no terminal
