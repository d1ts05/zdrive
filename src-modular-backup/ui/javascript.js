// ============================================================
// ZDRIVE - Frontend JavaScript (Enhanced v2.2)
// ============================================================

export function generateJavaScript(rootFolderId) {
  return `<script>
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
// ENHANCEMENT 1.2: Skeleton Loading
// ============================================================
const $loading = document.getElementById("loading");
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

function hideSkeletonLoader(){
  // Loading will be hidden when render() is called
}

// ============================================================
// ENHANCEMENT 4.1: Enhanced Toast with Animations
// ============================================================
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

// ZIP Progress
const $zip = document.getElementById("zipProgress");
const $zipBar = document.getElementById("zipBar");
const $zipTitle = document.getElementById("zipTitle");
const $zipNote = document.getElementById("zipNote");
function zipShow(title){ $zipTitle.textContent=title; $zip.style.display="block"; $zipBar.style.width="0%"; $zipNote.textContent=""; }
function zipPct(p){ $zipBar.style.width = Math.max(0,Math.min(100,p)) + "%"; }
function zipHide(){ $zip.style.display="none"; }

// ============================================================
// State Management
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
// API Calls
// ============================================================
async function apiList(folderId, pageToken){
  const u = new URL(location.href); 
  u.pathname="/api/list"; 
  u.search="";
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
  const u = new URL(location.href); 
  u.pathname="/api/search"; 
  u.search="";
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
  const u = new URL(location.href); 
  u.pathname="/api/tree"; 
  u.search="";
  u.searchParams.set("id", folderId);
  const r = await fetch(u, {headers:{accept:"application/json"}});
  if(!r.ok) {
    const txt = await r.text();
    throw new Error("Tree gagal ("+r.status+"): "+txt);
  }
  return r.json();
}

// ============================================================
// ENHANCEMENT 1.3: Breadcrumb with Tooltip
// ============================================================
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

// ============================================================
// Sort & Filter
// ============================================================
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

// Lanjut ke Part 2...
<\/script>`;
}