# @workspace/sk-editor_1 — Projeto Android (Capacitor)

## Origem
Arquivo: SK-Editor-v3-Corrigido-v2.zip (117 arquivos)

## Estrutura
```
├── dist/           ← Arquivos do PWA (já embutidos)
├── android/        ← Projeto Android Studio
│   ├── app/
│   │   └── src/main/
│   ├── build.gradle
│   └── settings.gradle
├── capacitor.config.ts
└── README.md
```

## Como compilar o APK

### Requisitos
- Android Studio (https://developer.android.com/studio)
- Java 17+
- Android SDK 34

### Passo a passo
1. Extraia este ZIP
2. Abra o Android Studio → File → Open → pasta `android/`
3. Aguarde Gradle sync (~5 min na primeira vez)
4. **Build → Build Bundle(s)/APK(s) → Build APK(s)**
5. APK gerado: `android/app/build/outputs/apk/debug/app-debug.apk`

### Para instalar no celular
- Configurações → Segurança → Fontes desconhecidas ✓
- Transfira o .apk e abra para instalar

### Para assinar (Google Play)
- Build → Generate Signed Bundle/APK
- Crie um keystore e guarde em segurança

## Configuração
- **Package:** `com.meuapp.workspaceskeditor`
- **Versão:** 1.0.1 (code: 2)
- **Min SDK:** Android 21+
- **Orientação:** any
