export interface VFSFile {
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface VFSDirectory {
  name: string;
  path: string;
  children: (VFSFile | VFSDirectory)[];
  expanded?: boolean;
}

export type VFSNode = VFSFile | VFSDirectory;

export function isDirectory(node: VFSNode): node is VFSDirectory {
  return "children" in node;
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    md: "markdown",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    graphql: "graphql",
    vue: "html",
    svelte: "html",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    dart: "dart",
  };
  return map[ext] || "plaintext";
}

export class VirtualFileSystem {
  private files: Map<string, string> = new Map();
  private listeners: Set<() => void> = new Set();

  onChange(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  writeFile(path: string, content: string) {
    const normalizedPath = this.normalizePath(path);
    this.files.set(normalizedPath, content);
    this.notify();
  }

  readFile(path: string): string | undefined {
    return this.files.get(this.normalizePath(path));
  }

  deleteFile(path: string) {
    const normalizedPath = this.normalizePath(path);
    this.files.delete(normalizedPath);
    const prefix = normalizedPath + "/";
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        this.files.delete(key);
      }
    }
    this.notify();
  }

  renameFile(oldPath: string, newPath: string) {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);
    const content = this.files.get(normalizedOld);
    if (content !== undefined) {
      this.files.delete(normalizedOld);
      this.files.set(normalizedNew, content);
    }
    const prefix = normalizedOld + "/";
    for (const [key, val] of this.files.entries()) {
      if (key.startsWith(prefix)) {
        this.files.delete(key);
        this.files.set(normalizedNew + key.slice(normalizedOld.length), val);
      }
    }
    this.notify();
  }

  exists(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    if (this.files.has(normalizedPath)) return true;
    const prefix = normalizedPath + "/";
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  listFiles(): string[] {
    return Array.from(this.files.keys()).sort();
  }

  getTree(): VFSDirectory {
    const root: VFSDirectory = { name: "root", path: "", children: [], expanded: true };
    const sortedPaths = this.listFiles();

    for (const filePath of sortedPaths) {
      const parts = filePath.split("/").filter(Boolean);
      let current = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        const dirPath = parts.slice(0, i + 1).join("/");
        let dir = current.children.find(
          (c) => isDirectory(c) && c.name === dirName
        ) as VFSDirectory | undefined;

        if (!dir) {
          dir = { name: dirName, path: dirPath, children: [], expanded: false };
          current.children.push(dir);
        }
        current = dir;
      }

      const fileName = parts[parts.length - 1];
      current.children.push({
        name: fileName,
        path: filePath,
        content: this.files.get(filePath) || "",
        language: getLanguageFromPath(filePath),
      });
    }

    this.sortTree(root);
    return root;
  }

  private sortTree(dir: VFSDirectory) {
    dir.children.sort((a, b) => {
      const aIsDir = isDirectory(a);
      const bIsDir = isDirectory(b);
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of dir.children) {
      if (isDirectory(child)) this.sortTree(child);
    }
  }

  clear() {
    this.files.clear();
    this.notify();
  }

  toJSON(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const [k, v] of this.files) {
      obj[k] = v;
    }
    return obj;
  }

  fromJSON(data: Record<string, string>) {
    this.files.clear();
    for (const [k, v] of Object.entries(data)) {
      this.files.set(this.normalizePath(k), v);
    }
    this.notify();
  }

  private normalizePath(p: string): string {
    return p.replace(/^\/+/, "").replace(/\/+$/, "");
  }
}
