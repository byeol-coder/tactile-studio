// ============================================================
// auth.js — 로그인/로그아웃 (무료: 이메일 매직링크 + Google OAuth)
// ============================================================
import { supabase } from "./supabaseClient.js";

// 현재 로그인 사용자 (없으면 null)
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// 이메일 매직링크 로그인 (비밀번호 불필요, 메일의 링크 클릭)
export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) throw error;
  return true; // "메일을 확인하세요" 안내 표시
}

// Google 계정 로그인 (Supabase 대시보드에서 Google provider 활성화 필요)
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// 로그인 상태 변화 구독 (헤더 UI 갱신 등에 사용)
//   onAuthChange(user => { ...버튼/이름 갱신... })
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
