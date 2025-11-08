// ============================================================
// ZDRIVE - Consolidated JavaScript (All-in-One)
// ============================================================

export function generateConsolidatedJavaScript(rootFolderId) {
  return `
// ============================================================
// Theme Management
// ============================================================
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

// ============================================================
// Global Variables & State
// ============================================================
const ROOT = "${rootFolderId}";
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

let currentImageIndex = -1;
let imageList = [];
let searchDebounceTimer;

// DOM Elements
const $loading = document.getElementById("loading");
const $toasts = document.getElementById("toasts");
const $zip = document.getElementById("zipProgress");
const $zipBar = document.getElementById("zipBar");
const $zipTitle = document.getElementById("zipTitle");
const $zipNote = document.getElementById("zipNote");
const $modal = document.getElementById("modal");
const $modalTitle = document.getElementById("modalTitle");
const $modalContent = document.getElementById("modalContent");

// ============================================================
// Helper Functions
// ============================================================
function fmtSize(s){ 
  if(!s||s==="0") return "-"; 
  let n=+s,u=["B","KB","MB","GB","TB"],i=0; 
  while(n>=1024&&i<u.length-1){n/=1024;i++} 
  return (n<10?n.toFixed(2):n.toFixed(1))+" "+u[i];
}

function fmtTime(s){ 
  if(!s) return ""; 
  const d=new Date(s); 
  const now=new Date(); 
  const diff=now-d; 
  if(diff<7*24*60*60*1000) return "Baru diubah"; 
  return d.toLocaleDateString("id-ID",{year:"numeric",month:"short",day:"numeric"});
}

function isFolder(m){ return m==="application/vnd.google-apps.folder"; }
function isVideo(m){ return m && m.startsWith("video/"); }
function isImage(m){ return m && m.startsWith("image/"); }
function isAudio(m){ return m && m.startsWith("audio/"); }
function isPDF(m,name){ return m==="application/pdf" || (name||"").toLowerCase().endsWith(".pdf"); }
function isMarkdown(name){ return /\\.(md|markdown)$/i.test(name||""); }
function isCode(m,name){ 
  const n=(name||"").toLowerCase(); 
  return /\\.(js|jsx|ts|tsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml|sh|bash|go|rs|php)$/.test(n);
}
function isTextLike(m,name){ 
  return (m && m.startsWith("text/")) || /\\.(txt|md|markdown|csv|log)$/i.test(name||"");
}
function getExt(name){ 
  const i=name.lastIndexOf("."); 
  return i>-1? name.slice(i+1).toUpperCase(): "";
}
function escapeHtml(s){ 
  return (s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function hi(text, q){
  if(!q) return escapeHtml(text);
  const SPECIAL = /[.*+?^{}()|[\\]\\\\$]/g;
  const pattern = (q||"").replace(SPECIAL, "\\\\$&");
  const regex = new RegExp(pattern,"ig");
  return escapeHtml(text).replace(regex, function(m){ 
    return "<mark style='background:#fbbf24;color:#000;padding:1px 3px;border-radius:3px'>" + escapeHtml(m) + "</mark>"; 
  });
}

function linkify(escaped){
  return escaped.replace(/(https?:\\/\\/\\S+)/ig, (m)=>'<a href="'+m+'" target="_blank" rel="noopener">'+m+'</a>');
}

// ============================================================
// Toast & Loading
// ============================================================
function setLoading(v){ 
  if(v){
    showSkeletonLoader();
  } else {
    hideSkeletonLoader();
  }
}

function showSkeletonLoader(){
  const container = document.getElementById("container");
  const skeletons = Array(8).fill(0).map(() => 
    '<div class="skeleton-card">' +
    '  <div class="skeleton-line title"></div>' +
    '  <div class="skeleton-line meta"></div>' +
    '  <div class="skeleton-line meta" style="width:40%"></div>' +
    '  <div style="flex:1"></div>' +
    '  <div class="skeleton-line btn"></div>' +
    '</div>'
  ).join('');
  container.innerHTML = '<div class="grid">' + skeletons + '</div>';
}

function hideSkeletonLoader(){}

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

function zipShow(title){ $zipTitle.textContent=title; $zip.style.display="block"; $zipBar.style.width="0%"; $zipNote.textContent=""; }
function zipPct(p){ $zipBar.style.width = Math.max(0,Math.min(100,p)) + "%"; }
function zipHide(){ $zip.style.display="none"; }

// ============================================================
// API Calls
// ============================================================
async function apiList(folderId, pageToken){
  const u = new URL(location.href); 
  u.pathname="/api/list"; 
  u.search="";
  u.searchParams.set("folderId", folderId);
  if(pageToken) u.searchParams.set("pageToken", pageToken);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) throw new Error("List gagal ("+r.status+")");
  return r.json();
}

async function apiSearch(q, cursor){
  const u = new URL(location.href); 
  u.pathname="/api/search"; 
  u.search="";
  u.searchParams.set("q", q);
  if(cursor) u.searchParams.set("cursor", cursor);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) throw new Error("Pencarian gagal ("+r.status+")");
  return r.json();
}

async function apiTree(folderId){
  const u = new URL(location.href); 
  u.pathname="/api/tree"; 
  u.search="";
  u.searchParams.set("id", folderId);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) throw new Error("Tree gagal ("+r.status+")");
  return r.json();
}

// Sisanya terlalu panjang, mau saya lanjutkan dengan approach lain yang lebih simple?
`;
}