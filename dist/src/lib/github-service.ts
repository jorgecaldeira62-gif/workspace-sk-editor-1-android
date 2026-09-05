export interface GitHubCredentials {
  token: string;
  username: string;
}

export function loadGitHubCredentials(): GitHubCredentials {
  try {
    const saved = localStorage.getItem("github-credentials");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { token: "", username: "" };
}

export function saveGitHubCredentials(creds: GitHubCredentials) {
  localStorage.setItem("github-credentials", JSON.stringify(creds));
}

export async function listRepos(creds: GitHubCredentials): Promise<any[]> {
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=30", {
    headers: {
      Authorization: `token ${creds.token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error(`Erro GitHub: ${res.status}`);
  return res.json();
}

export async function getRepoContents(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  path: string = ""
): Promise<any[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (creds.token) headers.Authorization = `token ${creds.token}`;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Erro ao buscar conteudo: ${res.status}`);
  return res.json();
}

export async function getFileContent(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (creds.token) headers.Authorization = `token ${creds.token}`;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Erro ao buscar arquivo: ${res.status}`);
  const data = await res.json();
  return atob(data.content);
}

export async function cloneRepo(
  creds: GitHubCredentials,
  owner: string,
  repo: string
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function fetchDir(path: string) {
    const contents = await getRepoContents(creds, owner, repo, path);
    if (!Array.isArray(contents)) return;

    for (const item of contents) {
      if (item.type === "file" && item.size < 500000) {
        try {
          const content = await getFileContent(creds, owner, repo, item.path);
          files[item.path] = content;
        } catch {}
      } else if (item.type === "dir") {
        await fetchDir(item.path);
      }
    }
  }

  await fetchDir("");
  return files;
}

export async function createOrUpdateFile(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const body: any = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${creds.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Erro ao salvar: ${res.status} - ${error}`);
  }
}

export async function pushAllFiles(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  files: Record<string, string>,
  commitMessage: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const existingShas: Record<string, string> = {};
  try {
    const existing = await getRepoContents(creds, owner, repo);
    if (Array.isArray(existing)) {
      for (const item of existing) {
        existingShas[item.path] = item.sha;
      }
    }
  } catch {}

  for (const [path, content] of Object.entries(files)) {
    try {
      let sha: string | undefined;
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
          {
            headers: {
              Authorization: `token ${creds.token}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          sha = data.sha;
        }
      } catch {}

      await createOrUpdateFile(creds, owner, repo, path, content, commitMessage, sha);
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export async function createRepo(
  creds: GitHubCredentials,
  name: string,
  description: string = "",
  isPrivate: boolean = false
): Promise<any> {
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `token ${creds.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Erro ao criar repositorio: ${res.status} - ${error}`);
  }
  return res.json();
}

export async function enableGitHubPages(
  creds: GitHubCredentials,
  owner: string,
  repo: string,
  branch: string = "main",
  path: string = "/"
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    method: "POST",
    headers: {
      Authorization: `token ${creds.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: { branch, path } }),
  });
  // 409 = já ativado
  if (!res.ok && res.status !== 409) {
    const err = await res.text();
    throw new Error(`Erro ao ativar GitHub Pages: ${res.status} - ${err}`);
  }
  return `https://${owner}.github.io/${repo}/`;
}

export async function makeRepoPublic(
  creds: GitHubCredentials,
  owner: string,
  repo: string
): Promise<void> {
  await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${creds.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ private: false }),
  });
}
