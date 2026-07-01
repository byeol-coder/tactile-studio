// ============================================================
// storage.js — DTMS 파일 클라우드 저장/불러오기 (Supabase Storage)
// 파일 경로 규칙: `${userId}/${파일명}.dtms`  → RLS로 본인 것만 접근
// 게스트(비로그인)면 자동으로 localStorage 폴백을 사용합니다.
// ============================================================
import { supabase } from "./supabaseClient.js";
import { BUCKET } from "./config.js";
import { getUser } from "./auth.js";

const LS_PREFIX = "dtms:"; // 게스트 로컬 저장 접두사

// --- 저장: name(확장자 제외), data(string 또는 Blob/ArrayBuffer) ---
export async function saveDtms(name, data) {
  const user = await getUser();
  const filename = name.endsWith(".dtms") ? name : `${name}.dtms`;

  if (!user) { // 게스트 → 로컬
    const text = data instanceof Blob ? await data.text() : String(data);
    localStorage.setItem(LS_PREFIX + filename, text);
    return { path: filename, local: true };
  }

  const path = `${user.id}/${filename}`;
  const blob = data instanceof Blob ? data : new Blob([data], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: "application/json" });
  if (error) throw error;
  return { path, local: false };
}

// --- 목록 ---
export async function listDtms() {
  const user = await getUser();
  if (!user) {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .map((k) => ({ name: k.slice(LS_PREFIX.length), path: k.slice(LS_PREFIX.length), local: true }));
  }
  const { data, error } = await supabase.storage.from(BUCKET).list(user.id, {
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw error;
  return (data || []).map((f) => ({ name: f.name, path: `${user.id}/${f.name}`, local: false }));
}

// --- 불러오기: 저장된 텍스트(DTMS 내용) 반환 ---
export async function loadDtms(path) {
  const user = await getUser();
  if (!user) { // 게스트 → 로컬에서 읽기
    const text = localStorage.getItem(LS_PREFIX + path);
    if (text != null) return text;
    throw new Error("파일을 찾을 수 없어요");
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return await data.text();
}

// --- 삭제 ---
export async function deleteDtms(path) {
  const user = await getUser();
  if (!user) { localStorage.removeItem(LS_PREFIX + path); return; }
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
