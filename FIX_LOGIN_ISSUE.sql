-- =====================================================
-- 임시 비밀번호 로그인 문제 해결
-- =====================================================
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1단계: 사용자 상태 확인
SELECT 
  username,
  email,
  is_approved,
  is_temp_password,
  temp_password IS NOT NULL as has_temp_password,
  temp_password_expires_at,
  CASE 
    WHEN temp_password_expires_at > NOW() THEN '유효함 ✓'
    WHEN temp_password_expires_at IS NULL THEN '없음'
    ELSE '만료됨 ✗'
  END as status
FROM users 
WHERE username = 'wodnr990921';  -- 본인 username으로 변경

-- 2단계: 승인 상태 확인 및 수정
-- 만약 is_approved가 false라면 실행:
UPDATE users 
SET is_approved = true 
WHERE username = 'wodnr990921' AND is_approved = false;

-- 3단계: 임시 비밀번호 초기화 (문제 해결용)
-- 임시 비밀번호가 제대로 작동하지 않으면 초기화:
UPDATE users 
SET 
  is_temp_password = false,
  temp_password = NULL,
  temp_password_expires_at = NULL
WHERE username = 'wodnr990921';

-- 4단계: Supabase Auth 사용자 확인
SELECT 
  id,
  email,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = (SELECT email FROM users WHERE username = 'wodnr990921');

-- 5단계: RLS 정책 확인 (문제가 계속되면)
-- RLS를 임시로 비활성화 (개발 환경만!)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 완료 후 다시 확인
-- =====================================================
SELECT 
  username,
  email,
  is_approved,
  is_temp_password
FROM users 
WHERE username = 'wodnr990921';
