// ============================================================
// supabaseClient.js — Supabase 클라이언트 단일 인스턴스
// 빌드 도구 없이 CDN(ESM)에서 바로 import 합니다.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // 새로고침해도 로그인 유지
    autoRefreshToken: true,    // 토큰 자동 갱신
    detectSessionInUrl: true,  // 매직링크/OAuth 콜백 처리
  },
});
