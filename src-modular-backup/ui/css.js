// ============================================================
// ZDRIVE - CSS Styles (Enhanced v2.2)
// ============================================================

export const CSS = `<style>
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

/* ============================================================
   ENHANCEMENT 1.1: Smooth Page Transitions
============================================================ */
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

/* ============================================================
   ENHANCEMENT 1.2: Skeleton Loading
============================================================ */
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

/* ============================================================
   ENHANCEMENT 1.4: Card Quick Actions (Hidden on Default)
============================================================ */
.card .actions {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.card:hover .actions {
  opacity: 1;
  transform: translateY(0);
}

/* Always show on touch devices */
@media (hover: none) {
  .card .actions {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================================
   ENHANCEMENT 4.1: Enhanced Toast Animations
============================================================ */
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

/* ============================================================
   ENHANCEMENT 4.4: Scroll to Top Button
============================================================ */
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

/* ============================================================
   ENHANCEMENT 2.2: Image Gallery Thumbnails
============================================================ */
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

/* ============================================================
   ENHANCEMENT 2.4: View Mode Toggle (List/Grid)
============================================================ */
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
}

.grid.list-view .card .name {
  flex: 1;
  margin: 0;
  padding-right: 12px;
}

.grid.list-view .card .meta {
  margin-bottom: 0;
  gap: 8px;
}

.grid.list-view .card .actions {
  flex-direction: row;
  margin-top: 0;
  margin-left: auto;
  gap: 6px;
}

.grid.list-view .card .actions .btn-sm {
  width: auto;
}

.grid.list-view .card::after {
  display: none;
}

/* ============================================================
   ENHANCEMENT 1.3: Breadcrumb Hover Tooltip
============================================================ */
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

/* ============================================================
   ENHANCEMENT 4.3: Pull to Refresh Indicator
============================================================ */
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

/* ============================================================
   BASE STYLES
============================================================ */
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto;background:var(--bg);color:var(--text);touch-action:manipulation}
header{position:sticky;top:0;z-index:10;backdrop-filter:var(--glass);background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.15));border-bottom:1px solid var(--line)}
.wrap{max-width:1180px;margin:0 auto;padding:12px 16px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.3px}
input[type=text]{flex:1;min-width:220px;padding:10px 12px;border-radius:12px;background:var(--panel);border:1px solid var(--line);color:var(--text);backdrop-filter:var(--glass)}
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
@media (min-width:480px){ .grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));} }
@media (min-width:1024px){ .grid{gap:16px} }

body.modal-open {
  overflow: hidden;
}

body.modal-open,
body.modal-open #modal {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
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
  overscroll-behavior: contain;
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

/* Plyr Video Player Styles */
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
  padding: 12px 16px;
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

.card{
  position:relative;display:flex;flex-direction:column;
  background:linear-gradient(140deg,rgba(255,255,255,.08),rgba(255,255,255,.02)),var(--panel);
  backdrop-filter:var(--glass);border:1px solid var(--line);border-radius:var(--radius);
  padding:12px;transform:translateZ(0);transition:transform .15s ease;
  min-height:160px;overflow:hidden;z-index:0;
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

.name{font-weight:600;margin:6px 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);padding-right:36px}
.meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;color:var(--muted);font-size:11.5px;margin-bottom:8px}
.dot::before{content:"\\2022";opacity:.6;margin:0 2px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;background:var(--badge);border:1px solid var(--line);font-size:10.5px;color:var(--text)}
.ext{font-weight:600;letter-spacing:.3px}

.menu-trigger{position:absolute;top:8px;right:8px;background:transparent;border:1px solid var(--btn-line);border-radius:999px;padding:4px 8px;color:var(--text);opacity:.9;z-index:2;font-size:16px}
.menu{position:absolute;top:36px;right:10px;min-width:200px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:6px;display:none;backdrop-filter:var(--glass);z-index:5;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.menu.open{display:block}
.menu .mi{display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;font-size:13px}
.menu .mi:hover{background:var(--btn-hover)}

.actions{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.actions .btn-sm{display:block;width:100%;text-align:center}

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
#modal .content.pdf iframe{width:100%;height:calc(90vh - 50px);border:none}

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

@media (max-width:768px) {
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
  
  .plyr__controls::after {
    display: none;
  }
}

@media (max-width:520px){
  .wrap{padding:8px 12px}
  input[type=text]{min-width:140px;padding:8px 10px}
  select{padding:7px 9px}
  .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:8px}
  .card{min-height:150px;padding:10px}
  .name{margin:4px 0 6px}
  .meta{gap:4px;font-size:10.5px;margin-bottom:6px}
  .menu{min-width:170px}
  .actions{gap:5px}
  #modal .box{width:95vw;max-height:95vh}
  .img-tools{bottom:8px;gap:4px;padding:4px}
  .img-tools .btn-sm{padding:6px 8px;font-size:11px}
  #scrollTop{bottom:16px;right:16px;width:40px;height:40px;font-size:20px}
}
</style>`;