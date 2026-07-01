// ============================================================
// config.js — 환경 설정 (Supabase 프로젝트 정보만 바꾸면 됩니다)
// Supabase 대시보드 → Project Settings → API 에서 복사
// anon key는 공개되어도 되는 키입니다(RLS로 보호). service_role 키는 절대 넣지 마세요.
// ============================================================
export const SUPABASE_URL = "https://rahkzsmbkuuqamziionk.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_0KLrEESPFQetXXRDXAEgFg__Zs5YmmS";

// Storage 버킷 이름 (setup.sql에서 동일하게 생성)
export const BUCKET = "dtms";

// 게스트(비로그인) 모드 허용 여부 — true면 로그인 없이 로컬 저장만 사용
export const ALLOW_GUEST = true;
