// ============================================================
// cloud-integration.js
// app.js를 수정하지 않고 기존 UI(저장/DTMS 내보내기/.dtms 열기 파일입력)에
// Supabase 로그인·클라우드 저장/열기를 연결합니다.
//
// 동작 요약
//  - 헤더에 [로그인] [☁ 클라우드] [설치] 버튼을 동적으로 추가
//  - DTMS 다운로드(<a download="*.dtms">)를 가로채 로그인 상태면 클라우드에도 업로드
//  - 클라우드 파일 선택 시 기존 #tactileFileInput 에 주입 → app.js의 열기 로직 재사용
// ============================================================
import { getUser, signInWithEmail, signInWithGoogle, signOut, onAuthChange } from "./auth.js";
import { saveDtms, listDtms, loadDtms } from "./storage.js";

// ---- 공통: 토스트(앱의 #toast 재사용, 없으면 alert) ----
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) { console.log(msg); return; }
  t.textContent = msg;
  t.classList.add("show", "ok");
  setTimeout(() => t.classList.remove("show", "ok"), 1900);
}

// ---- 헤더에 버튼 주입 ----
function injectUI() {
  const right = document.querySelector(".hd-right");
  if (!right) return null;
  const saveBtn = right.querySelector("#saveBtn");

  const cloudBtn = document.createElement("button");
  cloudBtn.className = "hd-btn ghost";
  cloudBtn.id = "cloudOpenBtn";
  cloudBtn.title = "클라우드에서 열기";
  cloudBtn.innerHTML = "<span>☁ 클라우드</span>";

  const authBtn = document.createElement("button");
  authBtn.className = "hd-btn ghost";
  authBtn.id = "authBtn";
  authBtn.textContent = "로그인";

  const installBtn = document.createElement("button");
  installBtn.className = "hd-btn ghost";
  installBtn.id = "install-btn"; // pwa-register.js가 제어
  installBtn.hidden = true;
  installBtn.textContent = "설치";

  right.insertBefore(cloudBtn, saveBtn);
  right.insertBefore(authBtn, saveBtn);
  right.insertBefore(installBtn, saveBtn);
  return { cloudBtn, authBtn };
}

// ---- 로그인/로그아웃 ----
async function handleAuth() {
  const user = await getUser();
  if (user) {
    if (confirm(`${user.email}\n로그아웃할까요?`)) { await signOut(); toast("로그아웃됐어요"); }
    return;
  }
  const useGoogle = confirm("Google 계정으로 로그인할까요?\n(취소 = 이메일 매직링크)");
  try {
    if (useGoogle) {
      await signInWithGoogle(); // 페이지 리다이렉트
    } else {
      const email = prompt("로그인할 이메일을 입력하세요");
      if (email) { await signInWithEmail(email.trim()); toast("메일의 로그인 링크를 확인하세요 ✉"); }
    }
  } catch (e) { toast("로그인 오류: " + (e.message || e)); }
}

// ---- 클라우드 파일 선택 모달 ----
function pickFile(files) {
  return new Promise((resolve) => {
    const bg = document.createElement("div");
    bg.className = "modal-bg"; bg.style.display = "flex";
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = "<h2>클라우드에서 열기</h2>";
    if (!files.length) m.innerHTML += "<p>저장된 파일이 없어요.</p>";
    const wrap = document.createElement("div");
    wrap.className = "modal-btns";
    files.forEach((f) => {
      const b = document.createElement("button");
      b.textContent = f.name + (f.local ? "  (로컬)" : "");
      b.onclick = () => { bg.remove(); resolve(f); };
      wrap.appendChild(b);
    });
    const cancel = document.createElement("button");
    cancel.textContent = "취소";
    cancel.onclick = () => { bg.remove(); resolve(null); };
    wrap.appendChild(cancel);
    m.appendChild(wrap); bg.appendChild(m); document.body.appendChild(bg);
    bg.addEventListener("click", (e) => { if (e.target === bg) { bg.remove(); resolve(null); } });
  });
}

// ---- 불러온 DTMS 텍스트를 기존 파일입력으로 주입 → app.js가 처리 ----
function loadIntoApp(text, name) {
  const input = document.getElementById("tactileFileInput");
  if (!input) { toast("불러오기 입력을 찾을 수 없어요"); return; }
  const file = new File([text], name, { type: "application/json" });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  toast("클라우드 파일을 불러왔어요");
}

// ---- 저장 가로채기 ----
// app.js의 저장 버튼들은 export.js의 exportDtms()를 호출해 Blob을 만들어 내려받습니다.
// 다운로드 방식(.click() / dispatchEvent)과 무관하도록, Blob이 생성되는 순간을
// URL.createObjectURL 단계에서 가로채 클라우드에 업로드합니다.
const SAVE_IDS = new Set(["saveBtn", "dtmsBtn", "miniDtmsBtn", "guardSave"]);

const _createObjURL = URL.createObjectURL.bind(URL);
let _blobResolver = null;
URL.createObjectURL = function (obj) {
  if (_blobResolver && obj instanceof Blob) { const r = _blobResolver; _blobResolver = null; r(obj); }
  return _createObjURL(obj);
};
// 다음에 생성되는 Blob 하나를 받아오는 Promise (timeout 내)
function nextBlob(timeout = 1500) {
  return new Promise((res) => {
    _blobResolver = res;
    setTimeout(() => { if (_blobResolver) { _blobResolver = null; res(null); } }, timeout);
  });
}

// 캡처 단계에서 저장 버튼 클릭을 먼저 감지 → exportDtms 실행 전에 Blob 캡처를 무장
document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest("button,[role=button]");
  if (!btn || !SAVE_IDS.has(btn.id)) return;
  const blobP = nextBlob();      // ← 동기적으로 무장 (await 전에)
  consumeSaveBlob(blobP);
}, true);

async function consumeSaveBlob(blobP) {
  const blob = await blobP;
  if (!blob) return;
  const user = await getUser();
  if (!user) return; // 게스트는 로컬 다운로드만 (storage.js가 로컬 폴백)
  try {
    const text = await blob.text();
    const name = (document.getElementById("fname")?.value || "무제").trim();
    await saveDtms(name, text);
    toast("클라우드에도 저장됐어요 ☁");
  } catch (e) { console.warn("클라우드 저장 실패:", e); }
}

// ---- 초기화 ----
window.addEventListener("DOMContentLoaded", async () => {
  const ui = injectUI();
  if (!ui) return;

  ui.authBtn.addEventListener("click", handleAuth);
  ui.cloudBtn.addEventListener("click", async () => {
    let files = [];
    try { files = await listDtms(); } catch (e) { toast("목록 조회 오류"); }
    const f = await pickFile(files);
    if (!f) return;
    try { loadIntoApp(await loadDtms(f.path), f.name); }
    catch (e) { toast("불러오기 오류: " + (e.message || e)); }
  });

  const setLabel = (u) => { ui.authBtn.textContent = u ? u.email.split("@")[0] : "로그인"; };
  onAuthChange(setLabel);
  setLabel(await getUser());
});
