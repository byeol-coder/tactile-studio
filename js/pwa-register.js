// ============================================================
// pwa-register.js — 서비스 워커 등록 + "앱 설치" 버튼 처리
// index.html 맨 아래에서 <script type="module" src="pwa-register.js"></script>
// ============================================================

// 1) 서비스 워커 등록 (HTTPS 또는 localhost 에서만 동작)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) =>
      console.warn("SW 등록 실패:", err)
    );
  });
}

// 2) 설치 프롬프트 — 원하는 버튼에 연결
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // 예: id="install-btn" 버튼이 있으면 노출
  const btn = document.getElementById("install-btn");
  if (btn) btn.hidden = false;
});

// 설치 버튼 클릭 핸들러 (버튼이 있을 때만)
document.addEventListener("click", async (e) => {
  if (e.target?.id !== "install-btn") return;
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  e.target.hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  const btn = document.getElementById("install-btn");
  if (btn) btn.hidden = true;
});
