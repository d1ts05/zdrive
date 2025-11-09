// ============================================================
// ZDRIVE - Google Drive Browser on Cloudflare Workers
// Version: 2.2.4 STABLE (2025-01-08)
// Author: d1ts05
// Changelog: Fixed modal structure restoration, event listener leaks, and various improvements
// ============================================================

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";

/* ============================================================
   OAUTH & SECURITY
============================================================ */

async function getAccessToken(env) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function isDescendantOfRoot(env, fileId) {
  const token = await getAccessToken(env);
  let current = fileId;
  for (let i = 0; i < 50; i++) {
    const res = await fetch(
      `${DRIVE}/files/${current}?fields=parents&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Ancestry check failed: ${res.status}`);
    const data = await res.json();
    const parents = data.parents || [];
    if (parents.includes(env.ROOT_FOLDER_ID)) return true;
    if (!parents.length) return current === env.ROOT_FOLDER_ID;
    current = parents[0];
  }
  return false;
}

/* ============================================================
   HELPERS
============================================================ */

function jsonOk(body, extra = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
      ...extra,
    },
  });
}

function jsonErr(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "access-control-allow-origin": "*",
    },
  });
}

function encodeRFC5987ValueChars(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
}

/* ============================================================
   API: LIST FILES
============================================================ */

async function listFiles(env, folderId, pageToken, ctx) {
  const token = await getAccessToken(env);
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "nextPageToken, files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink)",
    pageSize: "100",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const url = `${DRIVE}/files?${params}`;
  const req = new Request(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const cache = caches.default;
  let resp = await cache.match(req);

  if (!resp) {
    const res = await fetch(req);
    if (!res.ok) {
      throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
    }
    resp = new Response(await res.text(), {
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    });
    ctx.waitUntil(cache.put(req, resp.clone()));
  }
  return resp;
}

async function getMeta(env, fileId) {
  const token = await getAccessToken(env);
  const res = await fetch(
    `${DRIVE}/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
  return res.json();
}

async function downloadFile(env, fileId) {
  const allowed = await isDescendantOfRoot(env, fileId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const meta = await getMeta(env, fileId);
  const token = await getAccessToken(env);
  const url = `${DRIVE}/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  const name = meta?.name || fileId;
  const mime = meta?.mimeType || res.headers.get("content-type") || "application/octet-stream";

  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("content-type", mime);

  const ascii = name.replace(/[^\x20-\x7E]/g, "_");
  const utf8 = encodeRFC5987ValueChars(name);
  headers.set(
    "content-disposition",
    `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
  );

  return new Response(res.body, { status: res.status, headers });
}

async function previewFile(env, fileId) {
  const allowed = await isDescendantOfRoot(env, fileId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const meta = await getMeta(env, fileId);
  const token = await getAccessToken(env);
  const url = `${DRIVE}/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("content-type", meta?.mimeType || "application/pdf");
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");
  
  return new Response(res.body, { status: res.status, headers });
}

async function streamFile(env, request, fileId) {
  const allowed = await isDescendantOfRoot(env, fileId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const token = await getAccessToken(env);
  const range = request.headers.get("range");
  const url = `${DRIVE}/files/${fileId}?alt=media`;

  const headers = range
    ? { Authorization: `Bearer ${token}`, Range: range }
    : { Authorization: `Bearer ${token}` };

  const res = await fetch(url, { headers });

  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("accept-ranges", "bytes");
  return new Response(res.body, { status: res.status, headers: h });
}

function b64(json) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(json))));
}

function ub64(s) {
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

function escapeForDriveContains(q) {
  return (q || "").replace(/['\\]/g, "\\$&");
}

async function deepSearch(env, q, cursor) {
  const token = await getAccessToken(env);
  const MAX_PAGES = 30;
  const MAX_RESULTS = 300;

  let state = cursor
    ? ub64(cursor)
    : { queue: [env.ROOT_FOLDER_ID], current: null, q };

  const safe = escapeForDriveContains(q);
  const results = [];
  let pages = 0;

  while (pages < MAX_PAGES && results.length < MAX_RESULTS) {
    if (!state.current) {
      const next = state.queue.shift();
      if (!next) break;
      state.current = { id: next, pageToken: null };
    }

    const params = new URLSearchParams({
      q: `'${state.current.id}' in parents and trashed=false and (name contains '${safe}' or mimeType='application/vnd.google-apps.folder')`,
      fields: "nextPageToken, files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink)",
      pageSize: "100",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (state.current.pageToken) params.set("pageToken", state.current.pageToken);

    const req = new Request(`${DRIVE}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await fetch(req);
    if (!res.ok) {
      throw new Error(`Drive search failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    pages++;

    for (const it of data.files || []) {
      const isFolder = it.mimeType === "application/vnd.google-apps.folder";
      if (isFolder) state.queue.push(it.id);
      else results.push(it);
    }

    if (data.nextPageToken) state.current.pageToken = data.nextPageToken;
    else state.current = null;
  }

  const nextCursor =
    state.current || state.queue.length
      ? b64({ queue: state.queue, current: state.current, q })
      : null;

  return jsonOk({ files: results, nextCursor });
}

async function treeFiles(env, folderId) {
  const token = await getAccessToken(env);

  const head = await fetch(
    `${DRIVE}/files/${folderId}?fields=id,name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!head.ok) throw new Error(`Root metadata failed: ${head.status}`);
  const rootMeta = await head.json();

  const files = [];
  const queue = [{ id: folderId, path: "" }];

  while (queue.length) {
    const cur = queue.shift();
    const params = new URLSearchParams({
      q: `'${cur.id}' in parents and trashed=false`,
      fields: "nextPageToken, files(id,name,mimeType,size)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });

    let pageToken = null;
    do {
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(`${DRIVE}/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Tree listing failed: ${res.status}`);
      const data = await res.json();

      for (const it of data.files || []) {
        const isFolder = it.mimeType === "application/vnd.google-apps.folder";
        if (isFolder) {
          queue.push({
            id: it.id,
            path: (cur.path ? cur.path + "/" : "") + it.name,
          });
        } else {
          files.push({
            id: it.id,
            name: it.name,
            mimeType: it.mimeType,
            size: it.size || "0",
            path: (cur.path ? cur.path + "/" : "") + it.name,
          });
        }
      }
      pageToken = data.nextPageToken || null;
    } while (pageToken);
  }

  return { root: { id: folderId, name: rootMeta.name || "Folder" }, files };
}

/* ============================================================
   HTML + CSS + JS
============================================================ */

function html(env) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<title>Zivalez GDrive</title>

<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2360a5fa'/%3E%3Cstop offset='100%25' style='stop-color:%2334d399'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E">

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css">
<script defer src="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.polyfilled.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js"><\/script>
<script defer src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>

<style>
:root{
  --bg:#090e1c; --panel:rgba(17,24,39,.55); --line:rgba(255,255,255,.08);
  --text:#e8ecf1; --muted:#a6b0c3; --btn:rgba(255,255,255,.05);
  --btn-line:rgba(255,255,255,.12); --btn-hover:rgba(255,255,255,.10);
  --badge:rgba(255,255,255,.08); --glass:blur(10px) saturate(150%);
  --radius:14px; --folder:#60a5fa; --file:#34d399; --video:#fbbf24;
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#f7fafc; --panel:rgba(255,255,255,.6); --line:rgba(0,0,0,.08);
    --text:#0f172a; --muted:#475569; --btn:rgba(0,0,0,.04);
    --btn-line:rgba(0,0,0,.08); --btn-hover:rgba(0,0,0,.08);
    --badge:rgba(0,0,0,.06);
  }
}
:root[data-theme="dark"]{
  --bg:#090e1c; --panel:rgba(17,24,39,.55); --line:rgba(255,255,255,.08);
  --text:#e8ecf1; --muted:#a6b0c3; --btn:rgba(255,255,255,.05);
  --btn-line:rgba(255,255,255,.12); --btn-hover:rgba(255,255,255,.10);
  --badge:rgba(255,255,255,.08);
}
:root[data-theme="light"]{
  --bg:#f7fafc; --panel:rgba(255,255,255,.6); --line:rgba(0,0,0,.08);
  --text:#0f172a; --muted:#475569; --btn:rgba(0,0,0,.04);
  --btn-line:rgba(0,0,0,.08); --btn-hover:rgba(0,0,0,.08);
  --badge:rgba(0,0,0,.06);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

body {
  animation: fadeIn 0.3s ease;
}

.grid {
  animation: fadeIn 0.4s ease;
}

.card {
  animation: fadeIn 0.3s ease backwards;
}

.card:nth-child(1) { animation-delay: 0.03s; }
.card:nth-child(2) { animation-delay: 0.06s; }
.card:nth-child(3) { animation-delay: 0.09s; }
.card:nth-child(4) { animation-delay: 0.12s; }
.card:nth-child(5) { animation-delay: 0.15s; }
.card:nth-child(6) { animation-delay: 0.18s; }
.card:nth-child(7) { animation-delay: 0.21s; }
.card:nth-child(8) { animation-delay: 0.24s; }
.card:nth-child(9) { animation-delay: 0.27s; }
.card:nth-child(10) { animation-delay: 0.30s; }
.card:nth-child(11) { animation-delay: 0.33s; }
.card:nth-child(12) { animation-delay: 0.36s; }
.card:nth-child(13) { animation-delay: 0.39s; }
.card:nth-child(14) { animation-delay: 0.42s; }
.card:nth-child(15) { animation-delay: 0.45s; }
.card:nth-child(16) { animation-delay: 0.48s; }
.card:nth-child(17) { animation-delay: 0.51s; }
.card:nth-child(18) { animation-delay: 0.54s; }
.card:nth-child(19) { animation-delay: 0.57s; }
.card:nth-child(20) { animation-delay: 0.60s; }
.card:nth-child(21) { animation-delay: 0.63s; }
.card:nth-child(22) { animation-delay: 0.66s; }
.card:nth-child(23) { animation-delay: 0.69s; }
.card:nth-child(24) { animation-delay: 0.72s; }

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.skeleton-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 12px;
  min-height: 160px;
  overflow: hidden;
}

.skeleton-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255,255,255,0.08),
    transparent
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite;
}

.skeleton-line {
  height: 14px;
  background: var(--badge);
  border-radius: 6px;
  margin-bottom: 8px;
}

.skeleton-line.title {
  width: 70%;
  height: 18px;
  margin-top: 8px;
}

.skeleton-line.meta {
  width: 50%;
  height: 12px;
}

.skeleton-line.btn {
  height: 32px;
  margin-top: auto;
  border-radius: 12px;
}

.card .actions {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.card:hover .actions {
  opacity: 1;
  transform: translateY(0);
}

@media (hover: none) {
  .card .actions {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(400px);
    opacity: 0;
  }
}

@keyframes bounce {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.toast {
  animation: slideInRight 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.toast.removing {
  animation: slideOutRight 0.3s ease forwards;
}

.toast.err {
  animation: slideInRight 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55),
             bounce 0.3s ease 0.3s;
}

.toast.ok::before {
  content: "✓";
  display: inline-block;
  margin-right: 8px;
  color: #34d399;
  font-weight: bold;
  font-size: 16px;
  animation: scaleIn 0.3s ease 0.2s backwards;
}

@keyframes scaleIn {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

#scrollTop {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--text);
  font-size: 24px;
  cursor: pointer;
  z-index: 45;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

#scrollTop.visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

#scrollTop:hover {
  background: var(--btn-hover);
  transform: scale(1.1);
}

#scrollTop:active {
  transform: scale(0.95);
}

.img-gallery {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  background: var(--panel);
  backdrop-filter: var(--glass);
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--line);
  z-index: 52;
  max-width: 90vw;
  overflow-x: auto;
  overflow-y: hidden;
}

.img-gallery::-webkit-scrollbar {
  height: 4px;
}

.img-gallery::-webkit-scrollbar-track {
  background: transparent;
}

.img-gallery::-webkit-scrollbar-thumb {
  background: var(--btn-line);
  border-radius: 2px;
}

.img-gallery-thumb {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s ease, transform 0.2s ease;
  object-fit: cover;
  flex-shrink: 0;
}

.img-gallery-thumb:hover {
  transform: scale(1.05);
  border-color: var(--btn-line);
}

.img-gallery-thumb.active {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.3);
}

.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--btn);
  border: 1px solid var(--btn-line);
  border-radius: 12px;
  padding: 4px;
}

.view-toggle button {
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s ease;
}

.view-toggle button.active {
  background: var(--btn-hover);
}

.view-toggle button:hover {
  background: var(--btn-hover);
}

.grid.list-view {
  grid-template-columns: 1fr;
}

.grid.list-view .card {
  flex-direction: row;
  align-items: center;
  min-height: auto;
  padding: 12px 16px;
  gap: 12px;
  position: relative;
  overflow: visible;
}

.grid.list-view .card .name {
  flex: 1;
  margin: 0;
  padding-right: 16px;
  min-width: 0;
}

.grid.list-view .card .actions {
  flex-direction: row;
  margin-top: 0;
  margin-right: 8px;
  gap: 6px;
  order: 2;
  opacity: 0;
  transform: translateX(-10px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.grid.list-view .card:hover .actions {
  opacity: 1;
  transform: translateX(0);
}

.grid.list-view .card .meta {
  margin-bottom: 0;
  gap: 6px;
  order: 3;
  margin-right: 8px;
  flex-shrink: 0;
}

.grid.list-view .card .menu-trigger {
  position: static;
  order: 4;
  margin-left: 0;
  flex-shrink: 0;
}

.grid.list-view .card .menu {
  position: absolute;
  top: auto;
  bottom: 100%;
  right: 10px;
  margin-bottom: 4px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.grid.list-view .card .menu.open {
  display: block;
  animation: slideDown 0.2s ease;
}

.grid.list-view .card .actions .btn-sm {
  width: auto;
  padding: 6px 10px;
  font-size: 12px;
}

.grid.list-view .card::after {
  display: none;
}

.crumbs span {
  position: relative;
}

.crumbs span:not(.ellipsis):hover::after {
  content: attr(data-fullname);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  animation: fadeIn 0.2s ease;
}

#pullRefresh {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  border-radius: 0 0 12px 12px;
  padding: 12px 24px;
  color: var(--text);
  font-size: 14px;
  z-index: 100;
  transition: transform 0.3s ease;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}

#pullRefresh.visible {
  transform: translateX(-50%) translateY(0);
}

#pullRefresh .spinner-small {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--line);
  border-top-color: var(--text);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto;background:var(--bg);color:var(--text);touch-action:manipulation}
header{position:sticky;top:0;z-index:10;backdrop-filter:var(--glass);background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.15));border-bottom:1px solid var(--line)}
.wrap{max-width:1180px;margin:0 auto;padding:12px 16px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.3px}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 220px;
}

input[type=text]{
  flex:1;
  width: 100%;
  min-width:220px;
  padding:10px 36px 10px 12px;
  border-radius:12px;
  background:var(--panel);
  border:1px solid var(--line);
  color:var(--text);
  backdrop-filter:var(--glass)
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--btn-hover);
  border: none;
  color: var(--text);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s ease, background 0.2s ease;
}

.search-clear:hover {
  opacity: 1;
  background: var(--btn-line);
}

.search-clear.visible {
  display: flex;
}

select{padding:8px 10px;border-radius:12px;background:var(--panel);border:1px solid var(--line);color:var(--text);backdrop-filter:var(--glass)}
.btn,.btn-sm{padding:8px 10px;background:var(--btn);border:1px solid var(--btn-line);border-radius:var(--radius);color:var(--text);display:inline-block;text-align:center;text-decoration:none;font-size:13px;line-height:1.3;white-space:nowrap}
.btn:hover,.btn-sm:hover{background:var(--btn-hover)}
button,.btn,.btn-sm,select,.crumbs span,.menu-trigger{cursor:pointer}
.btn[disabled],.btn-sm[disabled]{opacity:.5;pointer-events:none}

.toolbar{gap:10px}
.tools-right{margin-left:auto;gap:8px}

.crumbs{font-size:14px;opacity:.95;margin:8px 0 6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.crumbs span{text-decoration:underline}
.crumbs .ellipsis{opacity:.6;cursor:default;text-decoration:none}

.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.controls .right{margin-left:auto}

.result-count{margin:12px 0 8px;font-size:14px;opacity:.85}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-top:10px;transition:all 0.3s ease}

@media (min-width:480px){ 
  .grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));} 
}
@media (min-width:768px){ 
  .grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));} 
}
@media (min-width:1024px){ 
  .grid{gap:16px} 
}

body.modal-open {
  overflow: hidden !important;
  position: fixed;
  width: 100%;
  height: 100%;
}

#modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.65);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(4px);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

#modal .box {
  width: min(960px, 92vw);
  max-height: 90vh;
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: auto;
}

#modal .content {
  padding: 0;
  overflow: auto;
  position: relative;
  background: var(--bg);
  max-height: calc(90vh - 50px);
}

#modal .content.image {
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  min-height: 60vh;
  position: relative;
  cursor: grab;
}

#modal .content.image.dragging {
  cursor: grabbing;
}

.img-tools {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  background: var(--panel);
  backdrop-filter: var(--glass);
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--line);
  z-index: 51;
  pointer-events: auto;
}

.plyr--fullscreen-active {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 100%;
  z-index: 10000000;
  background: #000;
  border-radius: 0;
  overflow: hidden;
}

.plyr--fullscreen-active .plyr__controls {
  opacity: 1 !important;
  pointer-events: auto !important;
  visibility: visible !important;
}

.plyr--fullscreen-active:hover .plyr__controls {
  opacity: 1 !important;
  transform: translateY(0) !important;
}

.plyr--fullscreen-active .plyr__control {
  opacity: 1 !important;
  pointer-events: auto !important;
}

.plyr {
  --plyr-color-main: #60a5fa;
  --plyr-video-control-color: #fff;
  --plyr-video-control-color-hover: #fff;
  --plyr-video-control-background-hover: rgba(96, 165, 250, 0.9);
  --plyr-audio-control-color: var(--text);
  --plyr-audio-control-color-hover: var(--text);
  border-radius: 12px;
  overflow: hidden;
}

.plyr--video .plyr__control,
.plyr--video .plyr__time {
  color: #fff !important;
}

.plyr--audio .plyr__control,
.plyr--audio .plyr__time {
  color: var(--text) !important;
}

.plyr--audio {
  padding: 32px 16px;
}

.plyr__control--overlaid {
  background: rgba(96, 165, 250, 0.9);
  border-radius: 50%;
}

.plyr__control--overlaid:hover {
  background: rgba(96, 165, 250, 1);
}

.plyr__menu__container {
  background: var(--panel);
  backdrop-filter: var(--glass);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 200px;
}

.plyr__menu__container [role="menu"] {
  background: transparent;
}

.plyr__menu__container [role="menuitemradio"],
.plyr__menu__container [role="menuitem"] {
  color: var(--text) !important;
}

.plyr__menu__container [role="menuitemradio"]:hover,
.plyr__menu__container [role="menuitem"]:hover {
  background: var(--btn-hover);
}

.plyr__menu__container [role="menuitemradio"][aria-checked="true"]::before {
  background: #60a5fa;
}

.plyr__tooltip {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  backdrop-filter: var(--glass);
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.plyr__progress input[type="range"] {
  color: #60a5fa;
}

.plyr--video .plyr__time {
  color: #fff !important;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.plyr--audio .plyr__time {
  color: var(--text) !important;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.plyr--video .plyr__controls {
  background: linear-gradient(180deg, transparent, rgba(0,0,0,0.85));
  padding: 20px;
}

:root[data-theme="light"] .plyr {
  border: 1px solid rgba(0,0,0,0.1);
}

:root[data-theme="light"] .plyr--audio {
  background: var(--panel);
  border: 1px solid var(--line);
}

@media (max-width: 768px) {
  .plyr__control {
    padding: 10px;
  }
  
  .plyr__menu {
    right: 0;
    left: auto;
    transform: translateX(0);
  }
  
  .plyr__tooltip {
    font-size: 11px;
    padding: 6px 10px;
  }
}

.plyr:focus-within .plyr__controls::after,
.plyr:hover .plyr__controls::after {
  opacity: 0.8;
}

@media (max-width: 768px) {
  .plyr__controls::after {
    display: none;
  }
}

.card{
  position:relative;
  display:flex;
  flex-direction:column;
  background:linear-gradient(140deg,rgba(255,255,255,.08),rgba(255,255,255,.02)),var(--panel);
  backdrop-filter:var(--glass);
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:12px;
  transform:translateZ(0);
  transition:transform .15s ease;
  min-height:160px;
  overflow:hidden;
  z-index:0;
}
.card:hover{transform:scale(1.02)}
.card::after{
  content:"";position:absolute;right:-8px;bottom:-8px;width:100px;height:80px;
  opacity:.15;background:currentColor;-webkit-mask:no-repeat center/contain;
  mask:no-repeat center/contain;pointer-events:none;filter:saturate(140%);z-index:-1;
}
.card[data-open]{cursor:pointer}
.card.type-folder{color:var(--folder);border-color:rgba(59,130,246,.25)}
.card.type-file{color:var(--file);border-color:rgba(34,197,94,.25)}
.card.type-video{color:var(--video);border-color:rgba(245,158,11,.25)}
.card.type-audio{color:#a855f7;border-color:rgba(168,85,247,.25)}
.card.type-pdf{color:#ef4444;border-color:rgba(239,68,68,.25)}
.card.type-code{color:#f59e0b;border-color:rgba(245,158,11,.25)}

.card.type-folder::after{-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18"><path d="M2 4h6l2 2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18"><path d="M2 4h6l2 2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>')}
.card.type-file::after{-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>')}
.card.type-video::after{-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 5h13a2 2 0 0 1 2 2v1l4-2v12l-4-2v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 5h13a2 2 0 0 1 2 2v1l4-2v12l-4-2v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>')}
.card.type-audio::after{-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 13c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V5h6v5h-6z"/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 13c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V5h6v5h-6z"/></svg>')}
.card.type-pdf::after,.card.type-code::after{-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>')}

.name{
  font-weight:600;
  margin:6px 0 8px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  color:var(--text);
  padding-right:36px
}

.meta{
  display:flex;
  flex-direction: column;
  gap:4px;
  color:var(--muted);
  font-size:11.5px;
  margin-bottom:8px
}

.meta-row{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  align-items:center;
}

.meta .size{
  font-weight: 600;
  font-size: 13px;
}

.dot::before{content:"\\2022";opacity:.6;margin:0 2px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;background:var(--badge);border:1px solid var(--line);font-size:10.5px;color:var(--text)}
.ext{font-weight:600;letter-spacing:.3px}

.menu-trigger{position:absolute;top:8px;right:8px;background:transparent;border:1px solid var(--btn-line);border-radius:999px;padding:4px 8px;color:var(--text);opacity:.9;z-index:2;font-size:16px}
.menu{position:absolute;top:36px;right:10px;min-width:200px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:6px;display:none;backdrop-filter:var(--glass);z-index:5;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.menu.open{display:block}
.menu .mi{display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;font-size:13px;cursor:pointer}
.menu .mi:hover{background:var(--btn-hover)}

.actions{
  display:flex;
  flex-direction:column;
  gap:6px;
  margin-top:auto
}
.actions .btn-sm{
  display:block;
  width:100%;
  text-align:center;
  font-size: 12px;
  padding: 7px 8px;
}

.pager{display:flex;gap:8px;margin:18px 0}

#modal{position:fixed;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;z-index:50;backdrop-filter:blur(4px)}
#modal .box{width:min(960px,92vw);max-height:90vh;background:var(--panel);backdrop-filter:var(--glass);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
#modal .bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-bottom:1px solid var(--line)}
#modal .bar .title{font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#modal .bar .tools{display:flex;gap:6px}
#modal .content{padding:0;overflow:auto;position:relative;background:var(--bg)}
#modal .content::-webkit-scrollbar{width:8px;height:8px}
#modal .content::-webkit-scrollbar-track{background:var(--panel)}
#modal .content::-webkit-scrollbar-thumb{background:var(--btn-line);border-radius:4px}
#modal .content::-webkit-scrollbar-thumb:hover{background:var(--muted)}
#modal .content.image{display:flex;align-items:center;justify-content:center;background:transparent;min-height:60vh;position:relative;overflow:hidden;cursor:grab}
#modal .content.image.dragging{cursor:grabbing}
#modal .content.image .img-wrapper{position:relative;overflow:hidden;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
#modal .content.image img{max-width:100%;max-height:calc(90vh - 120px);display:block;transition:transform .2s ease;transform-origin:center;user-select:none;pointer-events:none}
.img-tools{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px;background:var(--panel);backdrop-filter:var(--glass);padding:6px;border-radius:12px;border:1px solid var(--line);z-index:51}

#modal .content.pdf{background:#525252;min-height:70vh}
#modal .content.pdf iframe{width:100%;height:calc(90vh - 50px);border:none;display:block}

.textView{position:relative;padding:16px;padding-top:16px}
.textView-tools{
  position:sticky;
  top:12px;
  right:12px;
  display:flex;
  gap:6px;
  z-index:10;
  float:right;
  margin-bottom:-40px;
  background:var(--panel);
  backdrop-filter:var(--glass);
  padding:4px;
  border-radius:12px;
  border:1px solid var(--line);
  box-shadow:0 4px 16px rgba(0,0,0,.25);
}
.textView-tools .btn-sm{
  padding:6px 10px;
  border-radius:8px;
  background:transparent;
  border:1px solid transparent;
  color:var(--text);
  font-size:12px;
}
.textView-tools .btn-sm:hover{
  background:var(--btn-hover);
  border-color:var(--btn-line);
}
.textView pre{
  white-space:pre-wrap;
  word-wrap:break-word;
  font-family:ui-monospace,Menlo,Consolas,monospace;
  font-size:13px;
  line-height:1.6;
  clear:both;
  padding-top:48px;
}
.textView a{color:#60a5fa;text-decoration:underline}
.markdown-preview{padding:16px;line-height:1.6}
.markdown-preview h1,.markdown-preview h2,.markdown-preview h3{margin-top:1.5em;margin-bottom:.5em;font-weight:600}
.markdown-preview h1{font-size:2em;border-bottom:1px solid var(--line);padding-bottom:.3em}
.markdown-preview h2{font-size:1.5em}
.markdown-preview h3{font-size:1.25em}
.markdown-preview code{background:var(--badge);padding:2px 6px;border-radius:4px;font-size:.9em;font-family:ui-monospace,Menlo,Consolas,monospace}
.markdown-preview pre{background:var(--badge);padding:12px;border-radius:8px;overflow-x:auto;border:1px solid var(--line)}
.markdown-preview pre code{background:none;padding:0}
.markdown-preview blockquote{border-left:4px solid var(--line);padding-left:16px;margin:1em 0;opacity:.9;font-style:italic}
.markdown-preview ul,.markdown-preview ol{padding-left:2em}
.markdown-preview a{color:#60a5fa;text-decoration:underline}
.markdown-preview table{border-collapse:collapse;width:100%;margin:1em 0}
.markdown-preview th,.markdown-preview td{border:1px solid var(--line);padding:8px 12px}
.markdown-preview th{background:var(--badge);font-weight:600}

#loading{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:40;backdrop-filter:blur(2px)}
.spinner{width:42px;height:42px;border:4px solid var(--line);border-top-color:var(--text);border-radius:50%;animation:spin .9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

#toasts{position:fixed;top:12px;right:12px;display:flex;flex-direction:column;gap:8px;z-index:60}
.toast{min-width:220px;max-width:320px;background:var(--panel);backdrop-filter:var(--glass);border:1px solid var(--line);border-radius:12px;padding:10px 12px;color:var(--text);box-shadow:0 8px 24px rgba(0,0,0,.35)}
.toast.ok{border-color:rgba(34,197,94,.5)}
.toast.err{border-color:rgba(239,68,68,.5)}
.toast.info{border-color:rgba(59,130,246,.5)}

#zipProgress{position:fixed;bottom:16px;right:16px;min-width:260px;background:var(--panel);backdrop-filter:var(--glass);border:1px solid var(--line);border-radius:12px;padding:12px;display:none;z-index:55;box-shadow:0 8px 24px rgba(0,0,0,.35)}
#zipProgress .bar{height:8px;background:var(--btn-hover);border-radius:999px;overflow:hidden;margin-top:8px}
#zipProgress .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#60a5fa,#34d399);transition:width .2s ease}

.empty{opacity:.85;padding:32px 18px;text-align:center;border:1px dashed var(--line);border-radius:12px;background:var(--panel);backdrop-filter:var(--glass);margin-top:24px}
.empty .icon{font-size:48px;opacity:.4;margin-bottom:12px}
.empty .msg{font-size:15px;font-weight:600;margin-bottom:8px}
.empty .hint{font-size:13px;opacity:.7}

@media (max-width:640px){
  .wrap{padding:10px 14px}
  .search-wrapper{min-width:180px}
  input[type=text]{min-width:180px;padding:8px 32px 8px 10px;font-size:14px}
  select{padding:7px 9px;font-size:13px}
  .toolbar{gap:8px}
  .controls{gap:6px}
  .view-toggle button{padding:5px 10px;font-size:11px}
  .grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:8px}
  .card{min-height:150px;padding:10px}
  .name{margin:4px 0 6px;font-size:14px}
  .meta{gap:3px;font-size:10.5px;margin-bottom:6px}
  .meta .size{font-size:12px}
  .menu{min-width:170px}
  .actions{gap:5px}
  .actions .btn-sm{font-size:11px;padding:6px 7px}
  #modal .box{width:95vw;max-height:95vh}
  .img-tools{bottom:8px;gap:4px;padding:4px}
  .img-tools .btn-sm{padding:6px 8px;font-size:11px}
  #scrollTop{bottom:16px;right:16px;width:40px;height:40px;font-size:20px}
  .grid.list-view .card .name{max-width:none;font-size:13px}
  .grid.list-view .card .actions .btn-sm{font-size:10px;padding:5px 8px}
  .grid.list-view .card .meta{font-size:10px}
}

@media (max-width:400px){
  .wrap{padding:8px 12px}
  .brand{font-size:14px}
  .search-wrapper{min-width:140px}
  input[type=text]{min-width:140px;padding:7px 30px 7px 9px;font-size:13px}
  .grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
  .card{min-height:140px;padding:9px}
}

.audio-modal-wrapper {
  position: relative;
  width: min(600px, 90vw);
  padding: 24px;
}

.audio-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  color: var(--text);
  font-size: 28px;
  line-height  line-height: 1;
  cursor: pointer;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.audio-close-btn:hover {
  background: var(--btn-hover);
  transform: scale(1.1);
}

.audio-close-btn:active {
  transform: scale(0.95);
}

.audio-card {
  background: var(--panel);
  backdrop-filter: var(--glass);
  border: 1px solid var(--line);
  border-radius: 24px;
  padding: 48px 32px 40px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.4);
  position: relative;
}

.audio-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, 
    rgba(96, 165, 250, 0.1) 0%, 
    rgba(52, 211, 153, 0.1) 100%
  );
  border-radius: 24px;
  pointer-events: none;
  z-index: 0;
}

.audio-card > * {
  position: relative;
  z-index: 1;
}

.audio-cover {
  width: 140px;
  height: 140px;
  margin: 0 auto 28px;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 12px 32px rgba(96, 165, 250, 0.4);
}

.audio-cover svg {
  width: 70px;
  height: 70px;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
}

.audio-info {
  text-align: center;
  margin-bottom: 32px;
}

.audio-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 24px;
}

.audio-type {
  font-size: 14px;
  color: var(--muted);
  opacity: 0.8;
  font-weight: 500;
}

.audio-player-wrapper {
  position: relative;
  min-height: 80px;
  padding-bottom: 10px;
}

.audio-player-wrapper .plyr--audio .plyr__controls {
  background: var(--btn);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 10px 18px;
  color: var(--text);
}

.audio-player-wrapper .plyr--audio .plyr__control,
.audio-player-wrapper .plyr--audio .plyr__time {
  color: var(--text) !important;
}

.audio-player-wrapper .plyr--audio .plyr__control:hover {
  background: var(--btn-hover);
}

.audio-player-wrapper .plyr__progress input[type="range"] {
  color: #60a5fa;
}

.audio-player-wrapper .plyr__volume input[type="range"] {
  color: #34d399;
}

.audio-player-wrapper .plyr__menu__container {
  background: var(--panel);
  backdrop-filter: var(--glass);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 8px;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.audio-player-wrapper .plyr__menu__container [role="menu"] {
  background: transparent;
}

.audio-player-wrapper .plyr__menu__container [role="menuitemradio"],
.audio-player-wrapper .plyr__menu__container [role="menuitem"] {
  color: var(--text) !important;
}

.audio-player-wrapper .plyr__menu__container [role="menuitemradio"]:hover,
.audio-player-wrapper .plyr__menu__container [role="menuitem"]:hover {
  background: var(--btn-hover);
}

.audio-player-wrapper .plyr__menu__container [role="menuitemradio"][aria-checked="true"]::before {
  background: #60a5fa;
}

.audio-player-wrapper .plyr__tooltip {
  background: var(--panel);
  backdrop-filter: var(--glass);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

@media (max-width: 640px) {
  .audio-modal-wrapper {
    width: 95vw;
    padding: 16px;
  }
  
  .audio-close-btn {
    width: 36px;
    height: 36px;
    font-size: 24px;
    top: 12px;
    right: 12px;
  }
  
  .audio-card {
    padding: 40px 24px 32px;
    border-radius: 20px;
  }
  
  .audio-cover {
    width: 110px;
    height: 110px;
    margin-bottom: 24px;
    border-radius: 16px;
  }
  
  .audio-cover svg {
    width: 55px;
    height: 55px;
  }
  
  .audio-title {
    font-size: 17px;
    padding: 0 16px;
  }
  
  .audio-type {
    font-size: 13px;
  }
  
  .audio-info {
    margin-bottom: 28px;
  }
  
  .audio-player-wrapper {
    padding-bottom: 50px;
  }
  
  .audio-player-wrapper .plyr--audio .plyr__controls {
    padding: 14px 16px;
  }
}

:root[data-theme="dark"] .audio-card {
  box-shadow: 0 12px 48px rgba(0,0,0,0.6);
}

:root[data-theme="dark"] .audio-player-wrapper .plyr__menu__container {
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}

:root[data-theme="light"] .audio-card {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 12px 48px rgba(0,0,0,0.15);
}

:root[data-theme="light"] .audio-card::before {
  background: linear-gradient(135deg, 
    rgba(96, 165, 250, 0.06) 0%, 
    rgba(52, 211, 153, 0.06) 100%
  );
}

:root[data-theme="light"] .audio-cover {
  box-shadow: 0 12px 32px rgba(96, 165, 250, 0.3);
}

:root[data-theme="light"] .audio-close-btn {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

:root[data-theme="light"] .audio-player-wrapper .plyr__menu__container {
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}

.btn-sm[disabled] {
  opacity: 0.7;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-sm svg {
  vertical-align: middle;
}

</style>
</head>
<body>
<header>
  <div class="wrap row toolbar">
    <div class="brand">Zivalez GDrive</div>

    <div class="search-wrapper">
      <input id="q" type="text" placeholder="Cari nama file/folder… (Enter untuk cari)" aria-label="Search"/>
      <button class="search-clear" id="searchClear" aria-label="Clear search" title="Hapus pencarian">×</button>
    </div>
    
    <select id="scope" title="Ruang lingkup pencarian" aria-label="Search scope">
      <option value="folder">Cari di folder ini</option>
      <option value="all">Cari di seluruh ZDRIVE</option>
    </select>

    <div class="tools-right row">
      <label for="theme">Tema</label>
      <select id="theme" title="Tema" aria-label="Theme">
        <option value="system">System</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </div>
  </div>

  <div class="wrap controls">
    <label>Sort</label>
    <select id="sortField" aria-label="Sort by">
      <option value="name">Nama</option>
      <option value="time">Waktu</option>
      <option value="size">Ukuran</option>
    </select>

    <label>Filter</label>
    <select id="filterType" aria-label="Filter by type">
      <option value="all">All</option>
      <option value="folder">Folder</option>
      <option value="file">File</option>
      <option value="video">Video</option>
      <option value="image">Image</option>
      <option value="audio">Audio</option>
      <option value="pdf">PDF</option>
      <option value="docs">Docs</option>
    </select>

    <div class="view-toggle">
      <button id="viewGrid" class="active" aria-label="Grid view">Grid</button>
      <button id="viewList" aria-label="List view">List</button>
    </div>

    <div class="right">
      <button id="btnBack" class="btn-sm" style="display:none" aria-label="Back">Kembali</button>
    </div>
  </div>

  <div class="wrap">
    <div class="crumbs" id="crumbs" role="navigation" aria-label="Breadcrumb"></div>
  </div>
</header>

<main class="wrap">
  <div id="resultCount" class="result-count" style="display:none"></div>
  <div id="container"></div>
  <div class="pager" id="pager"></div>
</main>

<div id="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
  <div class="box">
    <div class="bar">
      <div id="modalTitle" class="title"></div>
      <div class="tools">
        <button class="btn-sm" id="modalClose" aria-label="Close">Kembali</button>
      </div>
    </div>
    <div class="content" id="modalContent"></div>
  </div>
</div>

<div id="loading" role="status" aria-live="polite" aria-label="Loading">
  <div class="spinner"></div>
</div>
<div id="toasts" aria-live="polite" aria-atomic="true"></div>

<div id="zipProgress" role="status" aria-live="polite">
  <div id="zipTitle" style="font-weight:600">Menyiapkan ZIP…</div>
  <div class="bar"><i id="zipBar"></i></div>
  <div id="zipNote" style="margin-top:6px;font-size:12px;opacity:.9"></div>
</div>

<button id="scrollTop" aria-label="Scroll to top">↑</button>

<div id="pullRefresh">
  <span class="spinner-small"></span>
  <span>Memuat ulang...</span>
</div>

<script>
(function(){
  const root = document.documentElement;
  const sel = document.getElementById("theme");
  const saved = localStorage.getItem("gdindex-theme") || "system";
  if (saved === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", saved);
  sel.value = saved;
  sel.onchange = ()=>{
    const v = sel.value;
    if (v==="system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", v);
    localStorage.setItem("gdindex-theme", v);
  };
})();

const $loading = document.getElementById("loading");
function setLoading(v){ 
  if(v){
    showSkeletonLoader();
  } else {
    hideSkeletonLoader();
  }
}

let skeletonGridTemplate = null;
let skeletonListTemplate = null;

function initSkeletonTemplates() {
  const gridHTML = Array(8).fill(0).map(() => {
    return '<div class="skeleton-card">' +
      '  <div class="skeleton-line title"></div>' +
      '  <div class="skeleton-line meta"></div>' +
      '  <div class="skeleton-line meta" style="width:40%"></div>' +
      '  <div style="flex:1"></div>' +
      '  <div class="skeleton-line btn"></div>' +
      '</div>';
  }).join('');
  
  const listHTML = Array(8).fill(0).map(() => {
    return '<div class="skeleton-card" style="flex-direction:row;align-items:center;min-height:auto;padding:12px 16px;gap:12px">' +
      '  <div class="skeleton-line" style="width:200px;height:16px;margin:0"></div>' +
      '  <div class="skeleton-line" style="width:80px;height:28px;margin:0"></div>' +
      '  <div class="skeleton-line" style="width:150px;height:12px;margin:0;margin-left:auto"></div>' +
      '  <div class="skeleton-line" style="width:24px;height:24px;margin:0;border-radius:50%"></div>' +
      '</div>';
  }).join('');
  
  skeletonGridTemplate = '<div class="grid">' + gridHTML + '</div>';
  skeletonListTemplate = '<div class="grid list-view">' + listHTML + '</div>';
}

function showSkeletonLoader(){
  if(!skeletonGridTemplate) initSkeletonTemplates();
  
  const container = document.getElementById("container");
  const isListView = state.viewMode === "list";
  container.innerHTML = isListView ? skeletonListTemplate : skeletonGridTemplate;
}

function hideSkeletonLoader(){
}

const $toasts = document.getElementById("toasts");
function toastSimple(msg, type="ok"){
  const el = document.createElement("div");
  el.className = "toast " + (type==="ok"?"ok":type==="err"?"err":type==="info"?"info":"");
  el.innerHTML = '<div>'+msg+'</div>';
  $toasts.appendChild(el);
  
  const duration = type==="err" ? 3500 : 1800;
  
  setTimeout(()=>{
    el.classList.add('removing');
    setTimeout(()=>el.remove(), 300);
  }, duration);
}
function toastErr(m){ toastSimple(m,"err"); }
function toastOk(m){ toastSimple(m,"ok"); }
function toastInfo(m){ toastSimple(m,"info"); }

const $zip = document.getElementById("zipProgress");
const $zipBar = document.getElementById("zipBar");
const $zipTitle = document.getElementById("zipTitle");
const $zipNote = document.getElementById("zipNote");
function zipShow(title){ $zipTitle.textContent=title; $zip.style.display="block"; $zipBar.style.width="0%"; $zipNote.textContent=""; }
function zipPct(p){ $zipBar.style.width = Math.max(0,Math.min(100,p)) + "%"; }
function zipHide(){ $zip.style.display="none"; }

const ROOT = "${env.ROOT_FOLDER_ID}";
const state = {
  stack: [{id: ROOT, name: "Root"}],
  items: [],
  pageToken: null,
  q: "",
  mode: "browse",
  scope: "folder",
  searchCursor: null,
  searchItems: [],
  sortField: "name",
  filter: "all",
  viewMode: localStorage.getItem("zdrive-view-mode") || "grid",
};

let currentAudioPlayer = null;
let currentVideoPlayer = null;

let savedScrollPosition = 0;
let scrollbarWidth = 0;

function getScrollbarWidth() {
  if(scrollbarWidth !== 0) return scrollbarWidth;
  
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  document.body.appendChild(outer);
  
  const inner = document.createElement('div');
  outer.appendChild(inner);
  
  scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
  outer.remove();
  
  return scrollbarWidth;
}

function lockBody() {
  savedScrollPosition = window.scrollY || window.pageYOffset;
  
  const sbWidth = getScrollbarWidth();
  
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + savedScrollPosition + 'px';
  document.body.style.width = '100%';
  
  if(sbWidth > 0) {
    document.body.style.paddingRight = sbWidth + 'px';
  }
  
  document.body.classList.add("modal-open");
}

function unlockBody() {
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('top');
  document.body.style.removeProperty('width');
  document.body.style.removeProperty('padding-right');
  document.body.classList.remove("modal-open");
  
  window.scrollTo(0, savedScrollPosition);
}

function fmtSize(s){ if(!s||s==="0") return "-"; let n=+s,u=["B","KB","MB","GB","TB"],i=0; while(n>=1024&&i<u.length-1){n/=1024;i++} return (n<10?n.toFixed(2):n.toFixed(1))+" "+u[i] }
function fmtTime(s){ if(!s) return ""; const d=new Date(s); const now=new Date(); const diff=now-d; if(diff<7*24*60*60*1000) return "Baru diubah"; return d.toLocaleDateString("id-ID",{year:"numeric",month:"short",day:"numeric"}) }
function isFolder(m){ return m==="application/vnd.google-apps.folder" }
function isVideo(m){ return m && m.startsWith("video/") }
function isImage(m){ return m && m.startsWith("image/") }
function isAudio(m){ return m && m.startsWith("audio/") }
function isPDF(m,name){ return m==="application/pdf" || (name||"").toLowerCase().endsWith(".pdf") }
function isMarkdown(name){ return /\\.(md|markdown)$/i.test(name||"") }
function isCode(m,name){ const n=(name||"").toLowerCase(); return /\\.(js|jsx|ts|tsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml|sh|bash|go|rs|php)$/.test(n) }
function isTextLike(m,name){ return (m && m.startsWith("text/")) || /\\.(txt|md|markdown|csv|log)$/i.test(name||"") }
function getExt(name){ const i=name.lastIndexOf("."); return i>-1? name.slice(i+1).toUpperCase(): "" }
function escapeHtml(s){ return (s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function hi(text, q){
  if(!q) return escapeHtml(text);
  const SPECIAL = /[.*+?^{}()|[\]\\$]/g;
  const pattern = (q||"").replace(SPECIAL, "\\$&");
  const regex = new RegExp(pattern,"ig");
  return escapeHtml(text).replace(regex, function(m){ 
    return "<mark style='background:#fbbf24;color:#000;padding:1px 3px;border-radius:3px'>" + escapeHtml(m) + "</mark>"; 
  });
}
function linkify(escaped){
  return escaped.replace(/(https?:\\/\\/\\S+)/ig, (m)=>'<a href="'+m+'" target="_blank" rel="noopener">'+m+'</a>');
}

async function apiList(folderId, pageToken){
  const u = new URL(location.href); u.pathname="/api/list"; u.search="";
  u.searchParams.set("folderId", folderId);
  if(pageToken) u.searchParams.set("pageToken", pageToken);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) {
    const txt = await r.text();
    throw new Error("List gagal ("+r.status+"): "+txt);
  }
  return r.json();
}

async function apiSearch(q, cursor){
  const u = new URL(location.href); u.pathname="/api/search"; u.search="";
  u.searchParams.set("q", q);
  if(cursor) u.searchParams.set("cursor", cursor);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) {
    const txt = await r.text();
    throw new Error("Pencarian gagal ("+r.status+"): "+txt);
  }
  return r.json();
}

async function apiTree(folderId){
  const u = new URL(location.href); u.pathname="/api/tree"; u.search="";
  u.searchParams.set("id", folderId);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) {
    const txt = await r.text();
    throw new Error("Tree gagal ("+r.status+"): "+txt);
  }
  return r.json();
}



function renderPathControls(){
  const crumbs = document.getElementById("crumbs");
  const btnBack = document.getElementById("btnBack");
  
  if(state.stack.length > 1){
    btnBack.style.display = "inline-block";
  } else {
    btnBack.style.display = "none";
  }
  
  let segments = state.stack.slice();
  const MAX_SEGMENTS = 5;
  
  if(segments.length > MAX_SEGMENTS){
    segments = [
      segments[0],
      {id:"...", name:"...", ellipsis:true},
      ...segments.slice(-(MAX_SEGMENTS-2))
    ];
  }
  
  crumbs.innerHTML = segments.map((c,i)=>{
    if(c.ellipsis) return '<span class="ellipsis">…</span>';
    const realIdx = i >= 2 && state.stack.length > MAX_SEGMENTS
      ? state.stack.length - (segments.length - i)
      : i;
    return '<span data-i="'+realIdx+'" data-fullname="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+'</span>';
  }).join(" / ");
  
  crumbs.querySelectorAll("span:not(.ellipsis)").forEach(el=>{
    el.onclick=()=>{
      const idx=+el.dataset.i;
      state.stack=state.stack.slice(0,idx+1);
      if(state.mode==="browse") load(state.stack[idx].id);
      else runSearch();
    };
  });
  
  btnBack.onclick = ()=>{
    if(state.stack.length>1){
      state.stack.pop();
      if(state.mode==="browse") load(state.stack.at(-1).id);
      else runSearch();
    }
  };
}

function applySortFilter(items){
  const f = state.filter;
  let arr = items.filter(it=>{
    if (f==="all") return true;
    if (f==="folder") return isFolder(it.mimeType);
    if (f==="file")   return !isFolder(it.mimeType);
    if (f==="video")  return isVideo(it.mimeType);
    if (f==="image")  return isImage(it.mimeType);
    if (f==="audio")  return isAudio(it.mimeType);
    if (f==="pdf")    return isPDF(it.mimeType, it.name);
    if (f==="docs")   return (!isFolder(it.mimeType) && !isVideo(it.mimeType) && !isImage(it.mimeType) && !isAudio(it.mimeType) && !isPDF(it.mimeType,it.name));
    return true;
  });

  const folders = arr.filter(it=>isFolder(it.mimeType));
  const files   = arr.filter(it=>!isFolder(it.mimeType));
  
  const sf = state.sortField;
  const sorter = (a,b)=>{
    if (sf==="name") return a.name.localeCompare(b.name, undefined, {sensitivity:"base"});
    if (sf==="time") return new Date(a.modifiedTime||0) - new Date(b.modifiedTime||0);
    if (sf==="size") return (+a.size||0) - (+b.size||0);
    return 0;
  };
  
  folders.sort(sorter);
  files.sort(sorter);
  
  return folders.concat(files);
}

function getCardTypeClass(it){
  const m = it.mimeType;
  const n = it.name;
  if(isFolder(m)) return "type-folder";
  if(isVideo(m)) return "type-video";
  if(isAudio(m)) return "type-audio";
  if(isPDF(m,n)) return "type-pdf";
  if(isCode(m,n)) return "type-code";
  return "type-file";
}

function render(){
  const container = document.getElementById("container");
  const resultCount = document.getElementById("resultCount");
  const q = (state.q||"").toLowerCase();
  const source = state.mode==="browse" ? state.items : state.searchItems;
  const base = state.mode==="browse"
    ? source.filter(x=> x.name.toLowerCase().includes(q))
    : source.slice();
  const items = applySortFilter(base);

  if(state.mode==="search" && state.q){
    resultCount.style.display = "block";
    resultCount.textContent = "Ditemukan "+items.length+" hasil untuk '"+state.q+"'";
  } else {
    resultCount.style.display = "none";
  }

  if (!items.length) {
    const msg = state.q ? "Tidak ada hasil ditemukan" : "Folder kosong";
    const hint = state.q ? "Coba kata kunci lain atau ubah filter" : "Belum ada file atau folder di sini";
    container.innerHTML = '<div class="empty"><div class="msg">'+msg+'</div><div class="hint">'+hint+'</div></div>';
    document.getElementById("pager").innerHTML = "";
    return;
  }

  const html = ['<div class="grid'+(state.viewMode==="list"?" list-view":"")+'">'];
  for (const it of items){
    const folder = isFolder(it.mimeType);
    const video = isVideo(it.mimeType);
    const image = isImage(it.mimeType);
    const audio = isAudio(it.mimeType);
    const pdf = isPDF(it.mimeType, it.name);
    const markdown = isMarkdown(it.name);
    const code = isCode(it.mimeType, it.name);
    const texty = isTextLike(it.mimeType, it.name);
    const ext = folder ? "" : getExt(it.name);
    const typeClass = getCardTypeClass(it);
    
    const canPreview = image || texty || pdf || code || markdown;
    const canWatch = video || audio;

    const btnDownload = folder ? '' :
      '<button class="btn-sm" data-download="'+it.id+'" data-dlname="'+encodeURIComponent(it.name)+'">Download</button>';
    
    const btnPreview = !folder && canPreview ?
      '<button class="btn-sm" data-view="'+it.id+'" data-name="'+encodeURIComponent(it.name)+'" data-mime="'+encodeURIComponent(it.mimeType||'')+'">Lihat</button>' : "";
    
    const btnWatch = !folder && canWatch ?
      '<button class="btn-sm" data-watch="'+it.id+'" data-name="'+encodeURIComponent(it.name)+'" data-mime="'+encodeURIComponent(it.mimeType||'')+'">'+
      (audio ? "Putar" : "Tonton")+'</button>' : "";

    const menuItems = folder
      ? '<div class="mi" data-zip="'+it.id+'" data-zipname="'+encodeURIComponent(it.name)+'">Download Folder (ZIP)</div>'
      : '<div class="mi" data-copylink="'+it.id+'" data-linkname="'+encodeURIComponent(it.name)+'">Copy Link Download</div>';

    let metaHTML = '';
    if(folder){
      metaHTML = '<div class="meta">'
        + '<div class="meta-row"><span class="badge">Folder</span></div>'
        + '<div class="meta-row"><span>'+fmtTime(it.modifiedTime)+'</span></div>'
        + '</div>';
    } else {
      metaHTML = '<div class="meta">'
        + '<div class="meta-row"><span class="size">'+fmtSize(it.size)+'</span></div>'
        + '<div class="meta-row">'
        +   '<span class="badge">File</span>'
        +   (ext ? '<span class="ext">'+ext+'</span>' : '')
        +   '<span class="dot"></span><span>'+fmtTime(it.modifiedTime)+'</span>'
        + '</div>'
        + '</div>';
    }

    html.push(
      '<div class="card '+typeClass+'" '+(folder?'data-open="'+it.id+'"':'')+'>'
      +  '<button class="menu-trigger" data-menu="'+it.id+'" aria-label="Menu">⋮</button>'
      +  '<div class="menu" id="menu-'+it.id+'" role="menu">'+ menuItems +'</div>'
      +  '<div class="name" title="'+escapeHtml(it.name)+'">'+hi(it.name, state.q)+'</div>'
      +  metaHTML
      +  '<div class="actions">'
      +      (btnDownload || '')
      +      (btnPreview || '')
      +      (btnWatch || '')
      +  '</div>'
      +'</div>'
    );
  }
  html.push('</div>');
  container.innerHTML = html.join("");

  document.querySelectorAll(".card[data-open]").forEach(el=>{
    el.onclick = (e)=>{
      const t = e.target;
      if (t.closest(".btn-sm") || t.closest(".menu") || t.classList.contains("menu-trigger")) return;
      const id = el.getAttribute("data-open");
      const it = items.find(x=>x.id===id);
      state.stack.push({id: it.id, name: it.name});
      load(id);
    };
  });

  document.querySelectorAll("[data-view]").forEach(el=>{
    el.onclick=(e)=> {
      e.preventDefault();
      e.stopPropagation();
      openPreview(
        el.getAttribute("data-view"),
        decodeURIComponent(el.getAttribute("data-name")),
        decodeURIComponent(el.getAttribute("data-mime"))
      );
    };
  });

  document.querySelectorAll("[data-watch]").forEach(el=>{
    el.onclick=(e)=> {
      e.preventDefault();
      e.stopPropagation();
      openWatch(
        el.getAttribute("data-watch"),
        decodeURIComponent(el.getAttribute("data-name")),
        decodeURIComponent(el.getAttribute("data-mime"))
      );
    };
  });

  document.querySelectorAll("[data-download]").forEach(el=>{
    el.onclick=(e)=> {
      e.preventDefault();
      e.stopPropagation();
      downloadFileHandler(
        el.getAttribute("data-download"),
        decodeURIComponent(el.getAttribute("data-dlname"))
      );
    };
  });

  setupMenus(items);
  imageList = items.filter(it=> isImage(it.mimeType));
}

let menuClickListenerAttached = false;

function setupMenus(items){
  document.querySelectorAll(".menu-trigger").forEach(btn=>{
    btn.onclick = (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-menu");
      const menu = document.getElementById("menu-"+id);
      document.querySelectorAll(".menu.open").forEach(m=>{ if(m!==menu) m.classList.remove("open"); });
      menu.classList.toggle("open");
    };
  });
  
  if(!menuClickListenerAttached) {
    document.addEventListener("click", (e)=> {
      if(!e.target.closest(".menu") && !e.target.closest(".menu-trigger")) {
        document.querySelectorAll(".menu.open").forEach(m=>m.classList.remove("open"));
      }
    });
    menuClickListenerAttached = true;
  }

  document.querySelectorAll(".menu .mi[data-copylink]").forEach(mi=>{
    mi.onclick = async ()=>{
      const id = mi.getAttribute("data-copylink");
      const name = decodeURIComponent(mi.getAttribute("data-linkname")||"File");
      const url = location.origin + "/api/download?id=" + id;
      try {
        await navigator.clipboard.writeText(url);
        toastOk("Link download berhasil disalin");
      } catch {
        toastErr("Gagal menyalin link");
      }
    };
  });

  document.querySelectorAll(".menu .mi[data-zip]").forEach(mi=>{
    mi.onclick = ()=> {
      const id = mi.getAttribute("data-zip");
      const name = decodeURIComponent(mi.getAttribute("data-zipname"));
      downloadFolderZip(id, name);
    };
  });
}

function renderPager(hasMore, onMore){
  const pager = document.getElementById("pager");
  pager.innerHTML = "";
  if (hasMore){
    const b=document.createElement("button");
    b.className="btn-sm";
    b.textContent="Muat lebih banyak";
    b.onclick=onMore;
    pager.appendChild(b);
  }
}

async function load(folderId, pageToken){
  try{
    setLoading(true);
    state.mode = "browse";
    const data = await apiList(folderId, pageToken);
    if(pageToken) state.items = state.items.concat(data.files||[]);
    else state.items = data.files||[];
    state.pageToken = data.nextPageToken || null;
    renderPathControls();
    render();
    renderPager(!!state.pageToken, ()=> load(state.stack.at(-1).id, state.pageToken));
  } catch(e){
    toastErr("Gagal memuat folder: "+(e.message||e));
  } finally {
    setLoading(false);
  }
}

async function runSearch(loadMore=false){
  try{
    setLoading(true);
    state.mode = "search";
    if(!loadMore){ state.searchItems=[]; state.searchCursor=null; }
    const data = await apiSearch(state.q || "", state.searchCursor);
    state.searchItems = state.searchItems.concat(data.files || []);
    state.searchCursor = data.nextCursor || null;
    renderPathControls();
    render();
    renderPager(!!state.searchCursor, ()=> runSearch(true));
  } catch(e){
    toastErr("Gagal mencari: "+(e.message||e));
  } finally {
    setLoading(false);
  }
}

const searchInput = document.getElementById("q");
const searchClear = document.getElementById("searchClear");

function updateSearchClearButton(){
  if(searchInput.value.trim()){
    searchClear.classList.add("visible");
  } else {
    searchClear.classList.remove("visible");
  }
}

searchClear.onclick = ()=>{
  searchInput.value = "";
  state.q = "";
  updateSearchClearButton();
  if(state.mode === "browse"){
    render();
  } else {
    state.mode = "browse";
    load(state.stack.at(-1).id);
  }
  searchInput.focus();
};

let searchDebounceTimer;
searchInput.addEventListener("keydown", (e)=>{
  if(e.key==="Enter"){
    clearTimeout(searchDebounceTimer);
    state.q = e.target.value.trim();
    updateSearchClearButton();
    if((document.getElementById("scope").value||"folder")==="all"){
      if(!state.q){
        toastErr("Masukkan kata kunci untuk mencari di seluruh ZDRIVE.");
        return;
      }
      runSearch(false);
    } else {
      state.mode = "browse";
      render();
    }
  }
});

searchInput.addEventListener("input", (e)=>{
  updateSearchClearButton();
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(()=>{
    state.q = e.target.value;
    if(state.mode==="browse") render();
  }, 300);
});

document.getElementById("scope").onchange = ()=>{
  state.scope = document.getElementById("scope").value;
  if(state.scope==="all"){
    if(state.q){ runSearch(false); }
  } else {
    state.mode="browse";
    render();
    renderPager(!!state.pageToken, ()=> load(state.stack.at(-1).id, state.pageToken));
  }
};

document.getElementById("sortField").onchange = (e)=>{
  state.sortField = e.target.value;
  render();
};

document.getElementById("filterType").onchange = (e)=>{
  state.filter = e.target.value;
  render();
};

const viewGrid = document.getElementById("viewGrid");
const viewList = document.getElementById("viewList");

function setViewMode(mode){
  state.viewMode = mode;
  localStorage.setItem("zdrive-view-mode", mode);
  
  if(mode === "grid"){
    viewGrid.classList.add("active");
    viewList.classList.remove("active");
  } else {
    viewList.classList.add("active");
    viewGrid.classList.remove("active");
  }
  
  render();
}

viewGrid.onclick = ()=> setViewMode("grid");
viewList.onclick = ()=> setViewMode("list");
setViewMode(state.viewMode);

const $modal = document.getElementById("modal");

function ensureModalStructure() {
  const hasBox = $modal.querySelector('.box');
  const hasAudioWrapper = $modal.querySelector('.audio-modal-wrapper');
  
  if(hasAudioWrapper || !hasBox) {
    $modal.innerHTML = 
      '<div class="box">' +
      '  <div class="bar">' +
      '    <div id="modalTitle" class="title"></div>' +
      '    <div class="tools">' +
      '      <button class="btn-sm" id="modalClose" aria-label="Close">Kembali</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="content" id="modalContent"></div>' +
      '</div>';
    
    const closeBtn = document.getElementById("modalClose");
    if(closeBtn) closeBtn.onclick = closeModal;
    
    $modal.onclick = (e)=>{
      if(e.target === $modal){
        closeModal();
      }
    };
  }
}

function closeModal(){
  if(currentAudioPlayer){
    try {
      currentAudioPlayer.stop();
      currentAudioPlayer.destroy();
      currentAudioPlayer = null;
    } catch(e){
      console.log('Error destroying audio player:', e);
    }
  }
  
  if(currentVideoPlayer){
    try {
      currentVideoPlayer.stop();
      currentVideoPlayer.destroy();
      currentVideoPlayer = null;
    } catch(e){
      console.log('Error destroying video player:', e);
    }
  }
  
  const gallery = document.getElementById("imgGallery");
  if(gallery) gallery.remove();
  
  const imgTools = document.getElementById("imgTools");
  if(imgTools) imgTools.remove();
  
  ensureModalStructure();
  
  const modalContent = document.getElementById("modalContent");
  if(modalContent) {
    modalContent.className = "content";
    modalContent.innerHTML = "";
  }
  
  $modal.style.display = "none";
  unlockBody();
}

$modal.onclick = (e)=>{
  if(e.target === $modal){
    closeModal();
  }
};

document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape" && $modal.style.display === "flex"){
    closeModal();
  }
});

async function downloadFileHandler(id, name){
  const downloadBtn = document.querySelector('[data-download="' + id + '"]');
  
  if(!downloadBtn) {
    try{
      const u = new URL(location.href);
      u.pathname="/api/download";
      u.search="";
      u.searchParams.set("id", id);
      const r = await fetch(u);
      if(!r.ok){
        toastErr("Gagal mengunduh file");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastOk("Download selesai");
    } catch(e){
      toastErr("Error saat download: " + (e.message||e));
    }
    return;
  }
  
  const originalHTML = downloadBtn.innerHTML;
  const originalDisabled = downloadBtn.disabled;
  
  try{
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = 
      '<svg style="display:inline-block;width:14px;height:14px;margin-right:4px;animation:spin 0.6s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
      '<circle cx="12" cy="12" r="10" opacity="0.25"/>' +
      '<path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>' +
      '</svg>' +
      'Downloading...';
    
    const u = new URL(location.href);
    u.pathname="/api/download";
    u.search="";
    u.searchParams.set("id", id);
    
    const r = await fetch(u);
    
    if(!r.ok){
      throw new Error("Download failed: " + r.status);
    }
    
    downloadBtn.innerHTML = 
      '<svg style="display:inline-block;width:14px;height:14px;margin-right:4px;animation:spin 0.6s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
      '<circle cx="12" cy="12" r="10" opacity="0.25"/>' +
      '<path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>' +
      '</svg>' +
      'Preparing...';
    
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    downloadBtn.innerHTML = 
      '<svg style="display:inline-block;width:14px;height:14px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
      '<polyline points="20 6 9 17 4 12"/>' +
      '</svg>' +
      'Downloaded!';
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadBtn.innerHTML = originalHTML;
      downloadBtn.disabled = originalDisabled;
    }, 2000);
    
    toastOk("Download selesai: " + name);
    
  } catch(e){
    downloadBtn.innerHTML = 
      '<svg style="display:inline-block;width:14px;height:14px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="15" y1="9" x2="9" y2="15"/>' +
      '<line x1="9" y1="9" x2="15" y2="15"/>' +
      '</svg>' +
      'Failed';
    
    setTimeout(() => {
      downloadBtn.innerHTML = originalHTML;
      downloadBtn.disabled = originalDisabled;
    }, 2000);
    
    toastErr("Error saat download: " + (e.message||e));
  }
}

function createImageGallery(images, currentIndex){
  const oldGallery = document.getElementById("imgGallery");
  if(oldGallery) oldGallery.remove();
  
  if(images.length <= 1) return;
  
  const gallery = document.createElement("div");
  gallery.id = "imgGallery";
  gallery.className = "img-gallery";
  
  images.forEach((img, idx)=>{
    const thumb = document.createElement("img");
    thumb.src = "/api/preview?id=" + img.id;
    thumb.className = "img-gallery-thumb" + (idx === currentIndex ? " active" : "");
    thumb.alt = img.name;
    thumb.onclick = ()=>{
      currentImageIndex = idx;
      openPreview(img.id, img.name, img.mimeType);
    };
    gallery.appendChild(thumb);
  });
  
  document.body.appendChild(gallery);
  
  setTimeout(()=>{
    const activeThumb = gallery.querySelector(".active");
    if(activeThumb){
      activeThumb.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
    }
  }, 100);
}

async function openPreview(id, name, mime){
  try{
    lockBody();
    
    ensureModalStructure();
    
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");
    
    if(!modalTitle || !modalContent) {
      console.error("Modal elements not found after ensuring structure");
      throw new Error("Modal elements not found");
    }
    
    modalTitle.textContent = name;
    modalContent.className = "content";
    
    modalContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px"><div class="spinner"></div></div>';
    $modal.style.display = "flex";
    
    if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      const url = new URL(location.href);
      url.pathname="/api/preview";
      url.search="";
      url.searchParams.set("id", id);
      url.searchParams.set("inline", "true");
      
      modalContent.className = "content pdf";
      modalContent.innerHTML = '<iframe title="'+escapeHtml(name)+'"></iframe>';
      
      const iframe = modalContent.querySelector('iframe');
      
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error('Failed to load PDF');
          return r.blob();
        })
        .then(blob => {
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(pdfBlob);
          iframe.src = blobUrl;
          
          iframe.onload = () => {
            console.log('PDF loaded successfully');
          };
          
          iframe.onerror = (e) => {
            console.error('PDF load error:', e);
            modalTitle.textContent = "Gagal membuka PDF";
            modalContent.innerHTML = '<div style="padding:32px;text-align:center">Error: Gagal memuat PDF. Coba download file ini.</div>';
          };
        })
        .catch(e => {
          modalTitle.textContent = "Gagal membuka PDF";
          modalContent.innerHTML = '<div style="padding:32px;text-align:center">Error: ' + escapeHtml(e.message) + '</div>';
        });
      
      return;
    }
    
    const url = new URL(location.href);
    url.pathname="/api/preview";
    url.search="";
    url.searchParams.set("id", id);
    const resp = await fetch(url);
    
    if(!resp.ok){
      modalTitle.textContent = "Gagal membuka file";
      modalContent.className="content";
      modalContent.innerHTML = '<div style="padding:32px;text-align:center">Error: ' + resp.status + '</div>';
      return;
    }
    
    const ctype = mime || resp.headers.get("content-type") || "";

    if (ctype.startsWith("image/")) {
      const blob = await resp.blob();
      const src = URL.createObjectURL(blob);
      modalContent.className = "content image";
      modalContent.innerHTML = 
        '<div class="img-wrapper">' +
        '  <img id="previewImg" alt="'+escapeHtml(name)+'" draggable="false"/>' +
        '</div>';
      
      const img = modalContent.querySelector("#previewImg");
      img.src = src;
      
      const oldTools = document.getElementById("imgTools");
      if(oldTools) oldTools.remove();
      
      const toolsHTML =
        '<div class="img-tools" id="imgTools">' +
        '  <button class="btn-sm" id="zoomIn" aria-label="Zoom in">Zoom In</button>' +
        '  <button class="btn-sm" id="zoomOut" aria-label="Zoom out">Zoom Out</button>' +
        '  <button class="btn-sm" id="zoomFit" aria-label="Fit to screen">Fit</button>' +
        '  <button class="btn-sm" id="zoom100" aria-label="Actual size">100%</button>' +
        '  <button class="btn-sm" id="imgDownload" aria-label="Download">Download</button>' +
        '</div>';
      
      document.body.insertAdjacentHTML("beforeend", toolsHTML);
      
      let zoomLevel = 1;
      let isDragging = false;
      let startX, startY, translateX = 0, translateY = 0;
      
      const updateTransform = function(){
        img.style.transform = "translate(" + translateX + "px, " + translateY + "px) scale(" + zoomLevel + ")";
      };
      
      document.getElementById("zoomIn").onclick = ()=>{
        zoomLevel = Math.min(zoomLevel + 0.5, 5);
        updateTransform();
      };
      document.getElementById("zoomOut").onclick = ()=>{
        zoomLevel = Math.max(zoomLevel - 0.5, 0.25);
        updateTransform();
      };
      document.getElementById("zoomFit").onclick = ()=>{
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
      };
      document.getElementById("zoom100").onclick = ()=>{
        zoomLevel = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
      };
      document.getElementById("imgDownload").onclick = ()=>{
        downloadFileHandler(id, name);
      };
      
      modalContent.addEventListener("mousedown", (e)=>{
        if(zoomLevel > 1){
          isDragging = true;
          startX = e.clientX - translateX;
          startY = e.clientY - translateY;
          modalContent.classList.add("dragging");
        }
      });
      
      modalContent.addEventListener("mousemove", (e)=>{
        if(isDragging){
          translateX = e.clientX - startX;
          translateY = e.clientY - startY;
          updateTransform();
        }
      });
      
      modalContent.addEventListener("mouseup", ()=>{
        isDragging = false;
        modalContent.classList.remove("dragging");
      });
      
      modalContent.addEventListener("mouseleave", ()=>{
        isDragging = false;
        modalContent.classList.remove("dragging");
      });
      
      let touchStartDist = 0;
      let touchStartZoom = 1;
      
      modalContent.addEventListener("touchstart", (e)=>{
        e.stopPropagation();
        if(e.touches.length === 2){
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          touchStartDist = Math.sqrt(dx*dx + dy*dy);
          touchStartZoom = zoomLevel;
        } else if(e.touches.length === 1 && zoomLevel > 1){
          startX = e.touches[0].clientX - translateX;
          startY = e.touches[0].clientY - translateY;
          isDragging = true;
        }
      }, {passive: false});
      
      modalContent.addEventListener("touchmove", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if(e.touches.length === 2){
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          zoomLevel = Math.max(0.25, Math.min(5, touchStartZoom * (dist / touchStartDist)));
          updateTransform();
        } else if(isDragging && e.touches.length === 1){
          translateX = e.touches[0].clientX - startX;
          translateY = e.touches[0].clientY - startY;
          updateTransform();
        }
      }, {passive: false});
      
      modalContent.addEventListener("touchend", ()=>{
        isDragging = false;
      });
      
      currentImageIndex = imageList.findIndex(it=> it.id === id);
      createImageGallery(imageList, currentImageIndex);
      preloadAdjacentImages();
      
    } else {
      const text = await resp.text();
      const isMarkdown = name.toLowerCase().match(/\.(md|markdown)$/);
      
      if(isMarkdown){
        modalContent.className = "content";
        modalContent.innerHTML =
          '<div class="textView" id="textViewContainer">'
          + '  <div class="textView-tools">'
          + '    <button class="btn-sm" id="btnPreviewMD" aria-label="Toggle preview">Preview</button>'
          + '    <button class="btn-sm" id="btnCopyText" aria-label="Copy text">Copy</button>'
          + '  </div>'
          + '  <div id="textContent"></div>'
          + '</div>';
        
        const textContent = document.getElementById("textContent");
        const escaped = escapeHtml(text);
        const linked = linkify(escaped);
        textContent.innerHTML = '<pre>'+linked+'</pre>';
        
        let showingPreview = false;
        
        document.getElementById("btnPreviewMD").onclick = ()=>{
          showingPreview = !showingPreview;
          if(showingPreview){
            if(window.marked){
              const html = marked.parse(text);
              textContent.innerHTML = '<div class="markdown-preview">'+html+'</div>';
              document.getElementById("btnPreviewMD").textContent = "Raw";
            } else {
              toastErr("Marked.js belum dimuat");
            }
          } else {
            textContent.innerHTML = '<pre>'+linked+'</pre>';
            document.getElementById("btnPreviewMD").textContent = "Preview";
          }
        };
        
        document.getElementById("btnCopyText").onclick = async ()=>{
          try{
            await navigator.clipboard.writeText(text);
            toastOk("Teks berhasil disalin");
          } catch{
            toastErr("Gagal menyalin teks");
          }
        };
        
      } else {
        const escaped = escapeHtml(text);
        const linked = linkify(escaped);
        modalContent.className = "content";
        modalContent.innerHTML =
          '<div class="textView">'
          + '  <div class="textView-tools">'
          + '    <button class="btn-sm" id="btnCopyText" aria-label="Copy text">Copy</button>'
          + '  </div>'
          + '  <pre>'+linked+'</pre>'
          + '</div>';
        
        document.getElementById("btnCopyText").onclick = async ()=>{
          try{
            await navigator.clipboard.writeText(text);
            toastOk("Teks berhasil disalin");
          } catch{
            toastErr("Gagal menyalin teks");
          }
        };
      }
    }

  } catch(e){
    console.error("Preview error:", e);
    toastErr("Preview gagal: "+(e.message||e));
    
    const modalContent = document.getElementById("modalContent");
    if(modalContent) {
      modalContent.innerHTML = '<div style="padding:32px;text-align:center">Error: ' + escapeHtml(e.message || "Unknown error") + '</div>';
    }
  }
}

function openWatch(id, name, mime){
  if(currentAudioPlayer || currentVideoPlayer){
    closeModal();
    setTimeout(() => openWatch(id, name, mime), 100);
    return;
  }
  
  lockBody();
  
  const src = new URL(location.href);
  src.pathname="/api/stream";
  src.search="";
  src.searchParams.set("id", id);
  
  const isAudio = mime && mime.startsWith("audio/");

  if(isAudio){
    $modal.innerHTML = 
      '<div class="audio-modal-wrapper">' +
      '  <button class="audio-close-btn" id="audioCloseBtn" aria-label="Close">×</button>' +
      '  <div class="audio-card">' +
      '    <div class="audio-cover">' +
      '      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
      '        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>' +
      '      </svg>' +
      '    </div>' +
      '    <div class="audio-info">' +
      '      <div class="audio-title" data-fullname="'+escapeHtml(name)+'">'+escapeHtml(name)+'</div>' +
      '      <div class="audio-type">Audio File</div>' +
      '    </div>' +
      '    <div class="audio-player-wrapper">' +
      '      <audio id="audioPlayer" preload="metadata">' +
      '        <source src="'+src.toString()+'" type="'+escapeHtml(mime)+'" />' +
      '      </audio>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    
    $modal.style.display = "flex";
    
    setTimeout(() => {
      const audioCloseBtn = document.getElementById('audioCloseBtn');
      if(audioCloseBtn) {
        audioCloseBtn.onclick = closeModal;
      }
      
      $modal.onclick = (e)=>{
        if(e.target === $modal || e.target.classList.contains('audio-modal-wrapper')){
          closeModal();
        }
      };
    }, 0);
    
  } else {
    ensureModalStructure();
    
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");
    
    if(modalTitle) modalTitle.textContent = name;
    if(modalContent) {
      modalContent.className = "content";
      modalContent.innerHTML = 
        '<div style="background:#000;padding:0">' +
        '  <video id="plyrVideo" class="plyr" playsinline controls data-poster="">' +
        '    <source src="'+src.toString()+'" type="video/mp4" />' +
        '  </video>' +
        '</div>';
    }
    
    $modal.style.display = "flex";
  }  setTimeout(()=>{
    if(window.Plyr){
      if(isAudio){
        try {
          currentAudioPlayer = new Plyr('#audioPlayer', {
            controls: [
              'play',
              'progress',
              'current-time',
              'duration',
              'mute',
              'volume',
              'settings'
            ],
            settings: ['speed', 'loop'],
            speed: {
              selected: 1,
              options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
            },
            keyboard: {
              focused: true,
              global: true
            },
            tooltips: {
              controls: true,
              seek: true
            },
            displayDuration: true,
            invertTime: true,
            toggleInvert: true,
            autoplay: false
          });
          
          currentAudioPlayer.on('ready', ()=> {
            console.log('Plyr audio ready');
            currentAudioPlayer.play().catch(error => {
              console.log('Autoplay was prevented:', error);
            });
          });
          
          currentAudioPlayer.on('error', (e)=>{ 
            console.error('Audio error:', e); 
            toastErr('Gagal memutar audio'); 
          });
          
        } catch(e){
          console.error("Plyr audio init error:", e);
          toastErr("Audio player gagal diinisialisasi");
        }
      } else {
        try {
          currentVideoPlayer = new Plyr("#plyrVideo", {
            controls: [
              'play-large',
              'play',
              'progress',
              'current-time',
              'duration',
              'mute',
              'volume',
              'settings',
              'pip',
              'airplay',
              'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            quality: {
              default: 720,
              options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240]
            },
            speed: {
              selected: 1,
              options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
            },
            ratio: '16:9',
            clickToPlay: true,
            hideControls: true,
            resetOnEnd: false,
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true },
            seekTime: 10,
            volume: 1,
            muted: false,
            invertTime: true,
            toggleInvert: true,
            displayDuration: true,
            storage: { enabled: true, key: 'plyr-zdrive' },
            fullscreen: { enabled: true, fallback: true, iosNative: true, container: null },
            captions: { active: false, language: 'auto', update: false },
            autoplay: false
          });
          
          currentVideoPlayer.on('ready', ()=> console.log('Plyr video ready'));
          currentVideoPlayer.on('enterfullscreen', ()=> document.documentElement.classList.add('plyr-fullscreen-active'));
          currentVideoPlayer.on('exitfullscreen', ()=> document.documentElement.classList.remove('plyr-fullscreen-active'));
          currentVideoPlayer.on('error', (e)=>{ console.error('Plyr error:', e); toastErr('Gagal memutar video'); });
          
        } catch(e){
          console.error("Plyr video init error:", e);
          toastErr("Video player gagal diinisialisasi");
        }
      }
    }
  }, 150);
}

async function downloadFolderZip(folderId, folderName){
  try{
    zipShow("Menyiapkan file ZIP...");
    const tree = await apiTree(folderId);
    const files = tree.files || [];
    const totalBytes = files.reduce((a,f)=>a + (+f.size||0), 0);

    const MAX_FILES = 100, MAX_BYTES = 200*1024*1024;
    if (files.length > MAX_FILES || totalBytes > MAX_BYTES) {
      zipHide();
      toastErr("Folder terlalu besar. Maksimal 100 file atau 200MB.");
      return;
    }

    let doneBytes = 0;
    const entries = {};
    for (let i=0;i<files.length;i++){
      $zipTitle.textContent = "Mengunduh "+(i+1)+" dari "+files.length+" file";
      $zipNote.textContent = files[i].path;
      const u = new URL(location.href);
      u.pathname="/api/download";
      u.search="";
      u.searchParams.set("id", files[i].id);
      const r = await fetch(u);
      if (!r.ok) {
        throw new Error("Gagal mengunduh: "+files[i].name);
      }
      const ab = await r.arrayBuffer();
      entries[files[i].path] = new Uint8Array(ab);
      doneBytes += ab.byteLength;
      zipPct(Math.round((doneBytes/Math.max(totalBytes,1))*100));
    }

    $zipTitle.textContent = "Membuat file ZIP...";
    zipPct(95);
    
    const zipped = fflate.zipSync(entries, { level: 6 });
    const blob = new Blob([zipped], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (folderName || tree.root?.name || "Folder") + ".zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    
    zipPct(100);
    setTimeout(zipHide, 500);
    toastOk("ZIP berhasil diunduh");
  } catch(e){
    zipHide();
    toastErr("Gagal membuat ZIP: " + (e.message || e));
  }
}

const scrollTopBtn = document.getElementById("scrollTop");

window.addEventListener("scroll", ()=>{
  if(window.scrollY > 500){
    scrollTopBtn.classList.add("visible");
  } else {
    scrollTopBtn.classList.remove("visible");
  }
});

scrollTopBtn.onclick = ()=>{
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

let pullStartY = 0;
let isPulling = false;
const pullRefresh = document.getElementById("pullRefresh");
const PULL_THRESHOLD = 80;

document.addEventListener("touchstart", (e)=>{
  if(window.scrollY === 0 && $modal.style.display !== "flex"){
    pullStartY = e.touches[0].clientY;
    isPulling = true;
  }
}, {passive: true});

document.addEventListener("touchmove", (e)=>{
  if(!isPulling) return;
  
  const deltaY = e.touches[0].clientY - pullStartY;
  
  if(deltaY > 10 && window.scrollY === 0){
    if(deltaY > PULL_THRESHOLD){
      e.preventDefault();
      pullRefresh.classList.add("visible");
    } else {
      pullRefresh.classList.remove("visible");
    }
  }
}, {passive: false});

document.addEventListener("touchend", (e)=>{
  if(!isPulling) return;
  
  const deltaY = e.changedTouches[0].clientY - pullStartY;
  
  if(deltaY > PULL_THRESHOLD && window.scrollY === 0){
    if(state.mode === "browse"){
      load(state.stack.at(-1).id);
      toastInfo("Memuat ulang...");
    } else {
      runSearch(false);
      toastInfo("Memuat ulang pencarian...");
    }
    
    setTimeout(()=>{
      pullRefresh.classList.remove("visible");
    }, 1000);
  } else {
    pullRefresh.classList.remove("visible");
  }
  
  isPulling = false;
}, {passive: true});

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", (e)=>{
  touchStartX = e.changedTouches[0].screenX;
}, {passive:true});

document.addEventListener("touchend", (e)=>{
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, {passive:true});

function handleSwipe(){
  const threshold = 100;
  const diff = touchEndX - touchStartX;
  
  if(Math.abs(diff) > threshold && $modal.style.display !== "flex"){
    if(diff > 0 && state.stack.length > 1){
      state.stack.pop();
      if(state.mode==="browse") load(state.stack.at(-1).id);
      else runSearch();
    }
  }
}

document.addEventListener("keydown", (e)=>{
  if(e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  
  if(e.key === "Escape" && $modal.style.display === "flex"){
    closeModal();
  }
  
  if((e.ctrlKey || e.metaKey) && e.key === "f"){
    e.preventDefault();
    document.getElementById("q").focus();
  }
  
  if(e.key === "Backspace" && $modal.style.display !== "flex"){
    if(state.stack.length > 1){
      e.preventDefault();
      state.stack.pop();
      if(state.mode === "browse") load(state.stack.at(-1).id);
      else runSearch();
    }
  }
});

document.addEventListener("contextmenu", (e)=>{
  const card = e.target.closest(".card");
  if(card){
    e.preventDefault();
    const menuBtn = card.querySelector(".menu-trigger");
    if(menuBtn){
      menuBtn.click();
    }
  }
});

document.addEventListener("dblclick", (e)=>{
  const card = e.target.closest(".card[data-open]");
  if(card){
    const id = card.getAttribute("data-open");
    const items = state.mode === "browse" ? state.items : state.searchItems;
    const it = items.find(x=>x.id === id);
    if(it){
      state.stack.push({id: it.id, name: it.name});
      load(id);
    }
  }
});

let currentImageIndex = -1;
let imageList = [];

function preloadAdjacentImages(){
  if(currentImageIndex < 0) return;
  
  if(currentImageIndex < imageList.length - 1){
    const next = imageList[currentImageIndex + 1];
    const img = new Image();
    img.src = "/api/preview?id=" + next.id;
  }
  
  if(currentImageIndex > 0){
    const prev = imageList[currentImageIndex - 1];
    const img = new Image();
    img.src = "/api/preview?id=" + prev.id;
  }
}

document.addEventListener("keydown", (e)=>{
  const modalContent = document.getElementById("modalContent");
  if(modalContent && modalContent.classList.contains("image") && imageList.length > 1){
    if(e.key === "ArrowLeft" && currentImageIndex > 0){
      e.preventDefault();
      const prev = imageList[currentImageIndex - 1];
      currentImageIndex--;
      openPreview(prev.id, prev.name, prev.mimeType);
    } else if(e.key === "ArrowRight" && currentImageIndex < imageList.length - 1){
      e.preventDefault();
      const next = imageList[currentImageIndex + 1];
      currentImageIndex++;
      openPreview(next.id, next.name, next.mimeType);
    }
  }
});

// ✅ Replace the initialization section at the bottom
(function initFromURL(){
  const params = new URLSearchParams(location.search);
  const f = params.get("folder");
  if (f && f !== ROOT && f.length > 0) {
    if(/^[a-zA-Z0-9_-]{20,}$/.test(f)) {
      state.stack = [{id: ROOT, name: "Root"}, {id: f, name: "Folder"}];
    } else {
      console.warn("Invalid folder ID in URL:", f);
    }
  }
  
  const q = params.get("q");
  if (q) {
    state.q = q;
    const searchInput = document.getElementById("q");
    if(searchInput) {
      searchInput.value = q;
      updateSearchClearButton();
    }
  }
})();

// ✅ Initialize modal close handler on page load
(function initModalHandlers(){
  const closeBtn = document.getElementById("modalClose");
  if(closeBtn) {
    closeBtn.onclick = closeModal;
  }
  
  $modal.onclick = (e)=>{
    if(e.target === $modal){
      closeModal();
    }
  };
})();

renderPathControls();
load(state.stack.at(-1).id);

console.log("%cZDRIVE Enhanced", "color:#60a5fa;font-size:18px;font-weight:bold");
console.log("Ngapain bang di console? Cari yang bermanfaat aja ya :)");

<\/script>
</body>
</html>`;
}

/* ============================================================
   ROUTER (Backend)
============================================================ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,OPTIONS",
          "access-control-allow-headers": "Content-Type,Authorization,Range",
        },
      });
    }

    try {
      if (pathname === "/") {
        if (!env.ROOT_FOLDER_ID) {
          return new Response(
            "<h1>Config Error</h1><p>ROOT_FOLDER_ID belum diset sebagai secret worker ini.</p>",
            { headers: { "content-type": "text/html; charset=UTF-8" } }
          );
        }
        return new Response(html(env), {
          headers: { "content-type": "text/html; charset=UTF-8" },
        });
      }

      if (pathname === "/api/list") {
        const folderId = searchParams.get("folderId") || env.ROOT_FOLDER_ID;
        const pageToken = searchParams.get("pageToken");
        const resp = await listFiles(env, folderId, pageToken, ctx);
        return new Response(resp.body, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "cache-control": "public, max-age=60",
            "access-control-allow-origin": "*",
          },
        });
      }

      if (pathname === "/api/download") {
        const id = searchParams.get("id");
        if (!id) return jsonErr(400, "missing id");
        return await downloadFile(env, id);
      }

      if (pathname === "/api/preview") {
        const id = searchParams.get("id");
        if (!id) return jsonErr(400, "missing id");
        return await previewFile(env, id);
      }

      if (pathname === "/api/stream") {
        const id = searchParams.get("id");
        if (!id) return jsonErr(400, "missing id");
        return await streamFile(env, request, id);
      }

      if (pathname === "/api/search") {
        const q = (searchParams.get("q") || "").trim();
        const cursor = searchParams.get("cursor");
        return await deepSearch(env, q, cursor);
      }

      if (pathname === "/api/tree") {
        const id = searchParams.get("id");
        if (!id) return jsonErr(400, "missing id");
        const ok = await isDescendantOfRoot(env, id);
        if (!ok) return jsonErr(403, "forbidden");
        const data = await treeFiles(env, id);
        return jsonOk(data);
      }

      if (pathname === "/api/diag") {
        try {
          const t = await getAccessToken(env);
          const r = await fetch(
            `${DRIVE}/files/${env.ROOT_FOLDER_ID}?fields=id&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${t}` } }
          );
          return jsonOk({
            hasClientId: !!env.GOOGLE_CLIENT_ID,
            hasClientSecret: !!env.GOOGLE_CLIENT_SECRET,
            hasRefresh: !!env.GOOGLE_REFRESH_TOKEN,
            hasRoot: !!env.ROOT_FOLDER_ID,
            tokenOk: !!t,
            rootHeadOk: r.ok,
            rootStatus: r.status,
          });
        } catch (e) {
          return jsonErr(500, e.message || "diag fail");
        }
      }

      return new Response("Not Found", {
        status: 404,
        headers: { "access-control-allow-origin": "*" },
      });
    } catch (e) {
      return jsonErr(500, e.message || "Internal error");
    }
  },
};