// ============================================================
// ZDRIVE - HTML Template Generator
// ============================================================

import { CSS } from './css.js';
import { generateJavaScript } from './javascript.js';
import { generateJavaScriptRender } from './javascript-render.js';
import { generateJavaScriptModal } from './javascript-modal.js';
import { generateJavaScriptEnhancements } from './javascript-enhancements.js';

/**
 * Generate complete HTML page
 * @param {object} env - Environment variables
 * @returns {string} Complete HTML
 */
export function generateHTML(env) {
  const rootFolderId = env.ROOT_FOLDER_ID;
  
  // Generate all JavaScript parts
  const jsCore = generateJavaScript(rootFolderId);
  const jsRender = generateJavaScriptRender();
  const jsModal = generateJavaScriptModal();
  const jsEnhancements = generateJavaScriptEnhancements();
  
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"/>
<title>Zivalez GDrive</title>

<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2360a5fa'/%3E%3Cstop offset='100%25' style='stop-color:%2334d399'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E">

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css">
<script defer src="https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.polyfilled.min.js"><\/script>
<script defer src="https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.min.js"><\/script>
<script defer src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>

${CSS}
</head>
<body>
<header>
  <div class="wrap row toolbar">
    <div class="brand">Zivalez GDrive</div>

    <input id="q" type="text" placeholder="Cari nama file/folder… (Enter untuk cari)" aria-label="Search"/>
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
${jsCore}
${jsRender}
${jsModal}
${jsEnhancements}
<\/script>
</body>
</html>`;
}