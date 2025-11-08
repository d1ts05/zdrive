// ============================================================
// ZDRIVE - Frontend JavaScript Part 3 (Modal & Preview)
// ============================================================

export function generateJavaScriptModal() {
  return `
// ============================================================
// Modal Management
// ============================================================
const $modal = document.getElementById("modal");
const $modalTitle = document.getElementById("modalTitle");
const $modalContent = document.getElementById("modalContent");

function closeModal(){
  $modal.style.display = "none";
  $modalContent.className = "content";
  $modalContent.innerHTML = "";
  
  // ENHANCEMENT 2.2: Remove gallery if exists
  const gallery = document.getElementById("imgGallery");
  if(gallery) gallery.remove();
  
  const imgTools = document.getElementById("imgTools");
  if(imgTools) imgTools.remove();
  
  document.body.classList.remove("modal-open");
}

document.getElementById("modalClose").onclick = closeModal;

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

// ============================================================
// ENHANCEMENT 2.2: Image Gallery Thumbnails
// ============================================================
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

// ============================================================
// Preview Handler
// ============================================================
async function openPreview(id, name, mime){
  try{
    setLoading(true);
    document.body.classList.add("modal-open");
    $modalTitle.textContent = name;
    
    // PDF Preview
    if (mime === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      const url = new URL(location.href);
      url.pathname="/api/preview";
      url.search="";
      url.searchParams.set("id", id);
      url.searchParams.set("inline", "true");
      
      $modalContent.className = "content pdf";
      $modalContent.innerHTML = '<iframe title="'+escapeHtml(name)+'"></iframe>';
      
      const iframe = $modalContent.querySelector('iframe');
      
      fetch(url)
        .then(r => {
          if (!r.ok) throw new Error('Failed to load PDF');
          return r.blob();
        })
        .then(blob => {
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(pdfBlob);
          iframe.src = blobUrl;
          iframe.onload = () => setLoading(false);
          $modal.addEventListener('hidden', () => {
            URL.revokeObjectURL(blobUrl);
          }, { once: true });
        })
        .catch(e => {
          $modalTitle.textContent = "Gagal membuka PDF";
          $modalContent.textContent = "Error: " + e.message;
          setLoading(false);
        });
      
      $modal.style.display="flex";
      return;
    }
    
    const url = new URL(location.href);
    url.pathname="/api/preview";
    url.search="";
    url.searchParams.set("id", id);
    const resp = await fetch(url);
    
    if(!resp.ok){
      $modalTitle.textContent = "Gagal membuka file";
      $modalContent.className="content";
      $modalContent.textContent = "Error: " + resp.status + " - " + await resp.text();
      $modal.style.display="flex";
      return;
    }
    
    const ctype = mime || resp.headers.get("content-type") || "";

    // Image Preview with Zoom & Pan
    if (ctype.startsWith("image/")) {
      const blob = await resp.blob();
      const src = URL.createObjectURL(blob);
      $modalContent.className = "content image";
      $modalContent.innerHTML = 
        '<div class="img-wrapper">' +
        '  <img id="previewImg" alt="'+escapeHtml(name)+'" draggable="false"/>' +
        '</div>';
      
      const img = $modalContent.querySelector("#previewImg");
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
      
      // Wheel zoom
      $modalContent.addEventListener("wheel", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomLevel = Math.max(0.25, Math.min(5, zoomLevel + delta));
        updateTransform();
      }, {passive: false});
      
      // Mouse drag
      $modalContent.addEventListener("mousedown", (e)=>{
        if(zoomLevel > 1){
          isDragging = true;
          startX = e.clientX - translateX;
          startY = e.clientY - translateY;
          $modalContent.classList.add("dragging");
        }
      });
      
      $modalContent.addEventListener("mousemove", (e)=>{
        if(isDragging){
          translateX = e.clientX - startX;
          translateY = e.clientY - startY;
          updateTransform();
        }
      });
      
      $modalContent.addEventListener("mouseup", ()=>{
        isDragging = false;
        $modalContent.classList.remove("dragging");
      });
      
      $modalContent.addEventListener("mouseleave", ()=>{
        isDragging = false;
        $modalContent.classList.remove("dragging");
      });
      
      // Touch pinch & drag
      let touchStartDist = 0;
      let touchStartZoom = 1;
      
      $modalContent.addEventListener("touchstart", (e)=>{
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
      
      $modalContent.addEventListener("touchmove", (e)=>{
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
      
      $modalContent.addEventListener("touchend", ()=>{
        isDragging = false;
      });
      
      // ENHANCEMENT 2.2: Create gallery
      currentImageIndex = imageList.findIndex(it=> it.id === id);
      createImageGallery(imageList, currentImageIndex);
      preloadAdjacentImages();
      
    } else {
      // Text/Code/Markdown Preview
      const text = await resp.text();
      const isMarkdown = name.toLowerCase().match(/\\.(md|markdown)$/);
      
      if(isMarkdown){
        $modalContent.className = "content";
        $modalContent.innerHTML =
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
        $modalContent.className = "content";
        $modalContent.innerHTML =
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

    $modal.style.display="flex";
  } catch(e){
    toastErr("Preview gagal: "+(e.message||e));
  } finally {
    setLoading(false);
  }
}

// ============================================================
// Video/Audio Player
// ============================================================
function openWatch(id, name, mime){
  $modalTitle.textContent = name;
  const src = new URL(location.href);
  src.pathname="/api/stream";
  src.search="";
  src.searchParams.set("id", id);

  const scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = "-" + scrollY + "px";
  document.body.style.width = "100%";
  document.body.classList.add("modal-open");
  
  const isAudio = mime && mime.startsWith("audio/");

  $modalContent.className = "content";
  
  if(isAudio){
    $modalContent.innerHTML =
      '<div style="background:var(--panel);padding:32px;display:flex;align-items:center;justify-content:center;min-height:300px">' +
      '  <audio id="audioPlayer" controls style="width:100%;max-width:600px">' +
      '    <source src="'+src.toString()+'" type="'+escapeHtml(mime)+'" />' +
      '  </audio>' +
      '</div>';
  } else {
    $modalContent.innerHTML =
      '<div style="background:#000;padding:0">' +
      '  <video id="plyrVideo" class="plyr" playsinline controls data-poster="">' +
      '    <source src="'+src.toString()+'" type="video/mp4" />' +
      '  </video>' +
      '</div>';
  }
  
  $modal.style.display = "flex";

  if(isAudio){
    setTimeout(initAudioPlayer, 100);
  }
  
  if (!isAudio && window.Plyr) {
    try {
      const player = new Plyr("#plyrVideo", {
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
        captions: { active: false, language: 'auto', update: false }
      });
      
      player.on('ready', ()=>{ console.log('Plyr ready'); });
      player.on('enterfullscreen', ()=>{ document.documentElement.classList.add('plyr-fullscreen-active'); });
      player.on('exitfullscreen', ()=>{ document.documentElement.classList.remove('plyr-fullscreen-active'); });
      player.on('error', (e)=>{ console.error('Plyr error:', e); toastErr('Gagal memutar video'); });
      
    } catch(e){
      console.error("Plyr init error:", e);
      toastErr("Video player gagal diinisialisasi");
    }
  }
}

function initAudioPlayer(){
  const audioEl = document.getElementById("audioPlayer");
  if(audioEl && window.Plyr){
    try {
      new Plyr(audioEl, {
        controls: ['play','progress','current-time','duration','mute','volume','settings'],
        settings: ['speed', 'loop'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true }
      });
    } catch(e){
      console.error("Audio Plyr error:", e);
    }
  }
}

// Image navigation
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
  if($modalContent.classList.contains("image") && imageList.length > 1){
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
`;
}