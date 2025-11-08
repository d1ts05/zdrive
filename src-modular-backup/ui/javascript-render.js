// ============================================================
// ZDRIVE - Frontend JavaScript Part 2 (Render & Events)
// ============================================================

export function generateJavaScriptRender() {
  return `
// ============================================================
// Render Functions
// ============================================================
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

    html.push(
      '<div class="card '+typeClass+'" '+(folder?'data-open="'+it.id+'"':'')+'>'
      +  '<button class="menu-trigger" data-menu="'+it.id+'" aria-label="Menu">⋮</button>'
      +  '<div class="menu" id="menu-'+it.id+'" role="menu">'+ menuItems +'</div>'
      +  '<div class="name" title="'+escapeHtml(it.name)+'">'+hi(it.name, state.q)+'</div>'
      +  '<div class="meta">'
      +    (folder ? '<span class="badge">Folder</span>' : '<span class="badge">File</span>')
      +    (!folder && ext ? '<span class="ext">'+ext+'</span>' : '')
      +    (!folder ? '<span class="dot"></span><span>'+fmtSize(it.size)+'</span>' : '')
      +    '<span class="dot"></span><span>'+fmtTime(it.modifiedTime)+'</span>'
      +  '</div>'
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

  // Event Handlers
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
    el.onclick=()=> openPreview(
      el.getAttribute("data-view"),
      decodeURIComponent(el.getAttribute("data-name")),
      decodeURIComponent(el.getAttribute("data-mime"))
    );
  });
  
  document.querySelectorAll("[data-watch]").forEach(el=>{
    el.onclick=()=> openWatch(
      el.getAttribute("data-watch"),
      decodeURIComponent(el.getAttribute("data-name")),
      decodeURIComponent(el.getAttribute("data-mime"))
    );
  });
  
  document.querySelectorAll("[data-download]").forEach(el=>{
    el.onclick=()=> downloadFileHandler(
      el.getAttribute("data-download"),
      decodeURIComponent(el.getAttribute("data-dlname"))
    );
  });

  setupMenus(items);
  imageList = items.filter(it=> isImage(it.mimeType));
}

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
  
  document.addEventListener("click", ()=> {
    document.querySelectorAll(".menu.open").forEach(m=>m.classList.remove("open"));
  });

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

// ============================================================
// Load & Search
// ============================================================
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

// ============================================================
// ENHANCEMENT 3.3: Debounced Search Input
// ============================================================
let searchDebounceTimer;
document.getElementById("q").addEventListener("keydown", (e)=>{
  if(e.key==="Enter"){
    clearTimeout(searchDebounceTimer);
    state.q = e.target.value.trim();
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

document.getElementById("q").addEventListener("input", (e)=>{
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

// ============================================================
// ENHANCEMENT 2.4: View Mode Toggle
// ============================================================
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

// ============================================================
// Download Handler
// ============================================================
async function downloadFileHandler(id, name){
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
}

// ============================================================
// ZIP Download
// ============================================================
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
`;
}