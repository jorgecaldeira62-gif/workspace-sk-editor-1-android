import JSZip from "jszip";
import { saveAs } from "file-saver";

// ── Exportar como ZIP ─────────────────────────────────────────────────────────
export async function exportAsZip(
  files: Record<string, string>,
  projectName: string = "projeto"
): Promise<void> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${projectName}.zip`);
}

// ── Gerar ZIP como base64 (para enviar ao Drive) ───────────────────────────
export async function generateZipBase64(
  files: Record<string, string>
): Promise<string> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const uint8 = await zip.generateAsync({ type: "uint8array" });
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// ── Pastas que sempre ignoramos ao importar ────────────────────────────────
const SKIP_DIRS = [
  "node_modules/", ".git/", ".svn/", "dist/", "build/", ".expo/",
  ".expo-shared/", ".cache/", "__pycache__/", ".venv/", "venv/",
  ".next/", ".nuxt/", ".output/", "coverage/", ".nyc_output/",
  ".turbo/", ".vercel/", ".netlify/",
];

// ── Extensões binárias que não têm sentido como texto ─────────────────────
const BINARY_EXTS = new Set([
  "png","jpg","jpeg","gif","webp","bmp","ico","tiff","avif",
  "mp4","mov","avi","webm","mkv","flv",
  "mp3","wav","ogg","aac","flac","m4a",
  "ttf","otf","woff","woff2","eot",
  "pdf","doc","docx","xls","xlsx","ppt","pptx",
  "zip","tar","gz","rar","7z",
  "exe","apk","ipa","dmg","pkg","deb","rpm",
  "so","dll","dylib","bin","dat","db","sqlite","sqlite3",
  "class","pyc","pyd","pyo",
  "DS_Store","lock",
]);

// ── Arquivos específicos a ignorar ────────────────────────────────────────
const SKIP_FILES = new Set([
  "package-lock.json","yarn.lock","pnpm-lock.yaml","npm-debug.log",
  ".DS_Store","Thumbs.db",".gitkeep",
]);

function shouldSkip(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  // Pastas proibidas
  for (const dir of SKIP_DIRS) {
    if (lower.includes("/" + dir) || lower.startsWith(dir)) return true;
  }
  // Arquivos específicos
  const basename = lower.split("/").pop() ?? "";
  if (SKIP_FILES.has(basename)) return true;
  // Extensão binária
  const ext = basename.split(".").pop() ?? "";
  if (BINARY_EXTS.has(ext)) return true;
  // Arquivos gigantes (mais de 500 KB de texto = provável lixo gerado)
  return false;
}

// ── Importar de ZIP ───────────────────────────────────────────────────────────
export async function importFromZip(
  file: File
): Promise<Record<string, string>> {
  const name = file.name.toLowerCase();

  // .tar.gz / .tgz / .tar — usar o parser tar nativo
  if (name.endsWith(".tar.gz") || name.endsWith(".tgz") || name.endsWith(".tar")) {
    return importFromTar(file);
  }

  // .zip — usar JSZip
  const zip = await JSZip.loadAsync(file);
  const files: Record<string, string> = {};
  const promises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    if (shouldSkip(relativePath)) return;

    const promise = zipEntry.async("uint8array").then((bytes) => {
      // Pula arquivos maiores que 500 KB (provavelmente binários disfarçados)
      if (bytes.length > 512 * 1024) return;
      // Detecta binário: se tiver bytes nulos nos primeiros 512 bytes, pula
      const probe = bytes.slice(0, 512);
      for (let i = 0; i < probe.length; i++) {
        if (probe[i] === 0) return; // byte nulo = binário
      }
      const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      files[relativePath] = content;
    });
    promises.push(promise);
  });

  await Promise.all(promises);
  return stripTopLevelFolder(files);
}

// ── Importar de TAR / TAR.GZ ──────────────────────────────────────────────────
async function importFromTar(file: File): Promise<Record<string, string>> {
  const name = file.name.toLowerCase();
  const raw = await file.arrayBuffer();
  let tarBuffer: ArrayBuffer;

  if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
    tarBuffer = await decompressGzip(raw);
  } else {
    tarBuffer = raw;
  }

  return parseTar(tarBuffer);
}

// Descompressão gzip usando DecompressionStream nativo do browser
async function decompressGzip(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(new Uint8Array(compressed));
  writer.close();
  return new Response(stream.readable).arrayBuffer();
}

// Parser tar puro em JavaScript (formato POSIX/ustar)
function parseTar(buffer: ArrayBuffer): Record<string, string> {
  const bytes = new Uint8Array(buffer);
  const files: Record<string, string> = {};
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let offset = 0;

  const readStr = (start: number, len: number) =>
    decoder.decode(bytes.slice(start, start + len)).replace(/\0+$/, "").trim();

  const parseOctal = (start: number, len: number) =>
    parseInt(readStr(start, len) || "0", 8) || 0;

  while (offset + 512 <= bytes.length) {
    const header = offset;

    // Bloco vazio = fim do arquivo
    if (bytes[header] === 0 && bytes[header + 1] === 0) {
      offset += 512;
      continue;
    }

    let name = readStr(header, 100);
    const typeflag = readStr(header + 156, 1);
    const size = parseOctal(header + 124, 12);

    // Prefixo ustar (POSIX)
    const prefix = readStr(header + 345, 155);
    if (prefix) name = prefix + "/" + name;

    offset += 512;

    const isRegularFile = typeflag === "0" || typeflag === "" || typeflag === "\0";

    if (isRegularFile && size > 0 && name) {
      const cleanName = name.replace(/^\.\//, "");
      if (cleanName && !cleanName.endsWith("/") && !shouldSkip(cleanName) && size <= 512 * 1024) {
        const slice = bytes.slice(offset, offset + Math.min(size, 512));
        let hasBinaryByte = false;
        for (let i = 0; i < slice.length; i++) { if (slice[i] === 0) { hasBinaryByte = true; break; } }
        if (!hasBinaryByte) {
          files[cleanName] = decoder.decode(bytes.slice(offset, offset + size));
        }
      }
    }

    // Avança para o próximo bloco (alinhado em 512 bytes)
    offset += Math.ceil(size / 512) * 512;
  }

  return stripTopLevelFolder(files);
}

// Remove pasta raiz única se todos os arquivos estiverem dentro dela
// Ex: "meu-projeto/src/index.ts" → "src/index.ts"
function stripTopLevelFolder(files: Record<string, string>): Record<string, string> {
  const keys = Object.keys(files);
  if (keys.length === 0) return files;

  const firstSlash = keys[0].indexOf("/");
  if (firstSlash <= 0) return files;

  const prefix = keys[0].slice(0, firstSlash + 1);
  const allHavePrefix = keys.every(k => k.startsWith(prefix));

  if (!allHavePrefix) return files;

  // Verifica se é só uma pasta raiz (não "src/" ou "public/" que são pastas reais do projeto)
  const topLevel = prefix.slice(0, -1);
  const isTechnicalFolder = ["src", "public", "lib", "dist", "components", "pages", "app"].includes(topLevel);
  if (isTechnicalFolder) return files;

  const stripped: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    stripped[k.slice(prefix.length)] = v;
  }
  return stripped;
}
