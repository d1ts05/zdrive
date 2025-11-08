// ============================================================
// ZDRIVE - Frontend JavaScript Part 4 (Enhancements)
// ============================================================

export function generateJavaScriptEnhancements() {
  return `
// ============================================================
// ENHANCEMENT 4.4: Scroll to Top Button
// ============================================================
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

// ============================================================
// ENHANCEMENT 4.3: Pull to Refresh (Mobile)
// ============================================================
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
      pullRefresh.classList.add("visible");
    } else {
      pullRefresh.classList.remove("visible");
    }
  }
}, {passive: true});

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

// ============================================================
// Mobile Swipe Navigation (Back gesture)
// ============================================================
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

// ============================================================
// Keyboard Shortcuts
// ============================================================
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

// Context menu enhancement
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

// Double click to open
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

// ============================================================
// Initialize from URL
// ============================================================
(function initFromURL(){
  const params = new URLSearchParams(location.search);
  const f = params.get("folder");
  if (f && f !== ROOT) state.stack = [{id: ROOT, name: "Root"}, {id: f, name: "Folder"}];
  const q = params.get("q");
  if (q) {
    state.q = q;
    document.getElementById("q").value = q;
  }
})();

// ============================================================
// Start Application
// ============================================================
renderPathControls();
load(state.stack.at(-1).id);

// Console welcome message
console.log("%cZDRIVE v2.2 ENHANCED", "color:#60a5fa;font-size:18px;font-weight:bold");
console.log("%c✨ New Features:", "color:#34d399;font-weight:bold;font-size:14px");
console.log("  • Skeleton Loading");
console.log("  • Smooth Page Transitions");
console.log("  • Image Gallery Thumbnails");
console.log("  • View Mode Toggle (Grid/List)");
console.log("  • Debounced Search (300ms)");
console.log("  • Enhanced Toast Animations");
console.log("  • Scroll to Top Button");
console.log("  • Pull to Refresh (Mobile)");
console.log("  • Breadcrumb Tooltips");
console.log("%cKeyboard Shortcuts:", "color:#fbbf24;font-weight:bold;font-size:13px");
console.log("  Ctrl+F     : Focus search");
console.log("  Backspace  : Go back");
console.log("  ESC        : Close modal");
console.log("  ← →        : Navigate images");
`;
}