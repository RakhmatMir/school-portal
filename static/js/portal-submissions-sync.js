/** Выгрузка сдач из localStorage в data/submissions.json на GitHub (GitHub Contents API). */

export const PORTAL_GITHUB_SUBMISSIONS = {
  owner: "RakhmatMir",
  repo: "school-portal",
  branch: "main",
  path: "data/submissions.json",
};

const LOCAL_KEY = "portal_site_submissions_v1";
const SYNC_TOKEN_KEY = "portal_github_sync_token";
const SYNC_FP_KEY = "portal_submissions_sync_fingerprint";
const AUTO_SYNC_KEY = "portal_github_auto_sync";

export function readLocalSubmissionMap() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getGitHubSyncToken() {
  try {
    return localStorage.getItem(SYNC_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setGitHubSyncToken(token) {
  if (!token) {
    localStorage.removeItem(SYNC_TOKEN_KEY);
    return;
  }
  localStorage.setItem(SYNC_TOKEN_KEY, String(token).trim());
  if (localStorage.getItem(AUTO_SYNC_KEY) == null) {
    localStorage.setItem(AUTO_SYNC_KEY, "1");
  }
}

/** Один раз открыть ссылку с ?portal_sync_token=ghp_... — токен сохранится, параметр исчезнет из адреса. */
export function saveGitHubSyncTokenFromUrl() {
  const params = new URLSearchParams(location.search);
  const token = params.get("portal_sync_token");
  if (!token) return false;
  setGitHubSyncToken(token);
  params.delete("portal_sync_token");
  const qs = params.toString();
  const next = `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`;
  history.replaceState(null, "", next);
  return true;
}

export function isAutoSyncEnabled() {
  try {
    return localStorage.getItem(AUTO_SYNC_KEY) !== "0";
  } catch {
    return true;
  }
}

export function localSubmissionsFingerprint(map = readLocalSubmissionMap()) {
  const keys = Object.keys(map).sort();
  if (!keys.length) return "";
  let h = keys.length;
  for (const k of keys) {
    const s = map[k]?.score_percent;
    h = (h * 31 + k.length) | 0;
    if (s != null) h = (h * 17 + Number(s)) | 0;
  }
  return `${keys.join(",")}#${h}`;
}

export function mergeSubmissionMaps(...maps) {
  const out = {};
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [key, value] of Object.entries(map)) {
      if (value && typeof value === "object") out[key] = value;
    }
  }
  return out;
}

function apiHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodeFileContent(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

/** Скачать JSON для ручного commit (без токена). */
export function downloadSubmissionsJson(map, filename = "submissions-export.json") {
  const payload = {
    updated_at: new Date().toISOString(),
    submissions: map,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return payload;
}

/** Прочитать submissions.json с GitHub (ветка main, raw API). */
export async function fetchGitHubSubmissionFile(cfg = PORTAL_GITHUB_SUBMISSIONS) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`;
  const res = await fetch(url);
  if (res.status === 404) {
    return { sha: null, submissions: {}, updated_at: null };
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`github_get_failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const text = data.content ? atob(data.content.replace(/\n/g, "")) : "{}";
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }
  const submissions =
    body.submissions && typeof body.submissions === "object" ? body.submissions : body;
  return {
    sha: data.sha || null,
    submissions: submissions && typeof submissions === "object" ? submissions : {},
    updated_at: body.updated_at || null,
  };
}

async function pushSubmissionsToGitHubOnce(token, opts = {}) {
  const cfg = { ...PORTAL_GITHUB_SUBMISSIONS, ...opts.cfg };
  const mergeRemote = opts.mergeRemote !== false;
  const local = readLocalSubmissionMap();
  const localCount = Object.keys(local).length;

  if (!localCount && !mergeRemote) {
    throw new Error("local_empty");
  }

  let remote = { sha: null, submissions: {} };
  if (mergeRemote) {
    remote = await fetchGitHubSubmissionFile(cfg);
  }

  const merged = mergeSubmissionMaps(remote.submissions, local);
  const payload = {
    updated_at: new Date().toISOString(),
    submissions: merged,
  };

  if (opts.downloadOnly) {
    downloadSubmissionsJson(merged);
    return {
      localCount,
      remoteCount: Object.keys(remote.submissions).length,
      mergedCount: Object.keys(merged).length,
      downloaded: true,
    };
  }

  if (!token || typeof token !== "string") {
    throw new Error("token_required");
  }

  const content = encodeFileContent(JSON.stringify(payload, null, 2));
  const putUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const body = {
    message: opts.commitMessage || `Sync exam submissions (${Object.keys(merged).length} entries)`,
    content,
    branch: cfg.branch,
  };
  if (remote.sha) body.sha = remote.sha;

  const res = await fetch(putUrl, {
    method: "PUT",
    headers: { ...apiHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    const conflict = res.status === 409;
    throw Object.assign(new Error(`github_put_failed: ${res.status} ${err}`), { conflict });
  }
  const result = await res.json();
  return {
    localCount,
    remoteCount: Object.keys(remote.submissions).length,
    mergedCount: Object.keys(merged).length,
    commit: result.commit?.html_url || null,
  };
}

/**
 * Объединить localStorage с GitHub и записать в репозиторий.
 * @param {string} token — classic PAT или fine-grained с Contents: Read and write
 */
export async function pushSubmissionsToGitHub(token, opts = {}) {
  const attempts = Math.max(1, Number(opts.maxAttempts) || 3);
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await pushSubmissionsToGitHubOnce(token, opts);
    } catch (err) {
      lastErr = err;
      if (err?.conflict && i < attempts - 1) continue;
      throw err;
    }
  }
  throw lastErr;
}

/** Токен из portal.json (если submissions_upload.enabled) — для автовыгрузки с любого устройства. */
export function resolveUploadTokenFromBundle(bundle) {
  const cfg = bundle?.submissions_upload;
  if (!cfg?.enabled) return "";
  const t = String(cfg.github_token || "").trim();
  return t && t !== "REPLACE_WITH_GITHUB_TOKEN" ? t : "";
}

export async function resolveSyncToken(bundle = null) {
  const local = getGitHubSyncToken();
  if (local) return local;
  if (bundle) return resolveUploadTokenFromBundle(bundle);
  try {
    const mod = await import("./portal-data.js");
    const b = await mod.loadPortalBundle();
    return resolveUploadTokenFromBundle(b);
  } catch {
    return "";
  }
}

/** При загрузке страницы: если есть токен и локальные сдачи — отправить в GitHub. */
export async function autoSyncSubmissionsOnLoad(opts = {}) {
  if (!isAutoSyncEnabled()) return { skipped: "auto_off" };
  const token =
    opts.token ||
    (opts.bundle ? resolveUploadTokenFromBundle(opts.bundle) || getGitHubSyncToken() : "") ||
    (await resolveSyncToken(opts.bundle));
  if (!token) return { skipped: "no_token" };

  const local = readLocalSubmissionMap();
  const fp = localSubmissionsFingerprint(local);
  if (!fp) return { skipped: "local_empty" };

  const lastFp = localStorage.getItem(SYNC_FP_KEY) || "";
  if (fp === lastFp && !opts.force) return { skipped: "already_synced" };

  const result = await pushSubmissionsToGitHub(token, {
    commitMessage: opts.commitMessage || "Auto-sync exam submissions on page load",
  });
  localStorage.setItem(SYNC_FP_KEY, fp);
  return { synced: true, ...result };
}

/** Скопировать localStorage в буфер (для отправки учителю). */
export async function copyLocalSubmissionsToClipboard() {
  const map = readLocalSubmissionMap();
  const text = JSON.stringify({ updated_at: new Date().toISOString(), submissions: map }, null, 2);
  await navigator.clipboard.writeText(text);
  return Object.keys(map).length;
}
