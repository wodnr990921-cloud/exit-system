-- 임시 비밀번호 발급 상태 확인
-- Supabase SQL Editor에서 실행하세요

-- 1. 사용자 정보 확인
SELECT 
  id,
  username,
  email,
  is_temp_password,
  temp_password IS NOT NULL as has_temp_password,
  temp_password_expires_at,
  CASE 
    WHEN temp_password_expires_at > NOW() THEN '유효함 ✓'
    WHEN temp_password_expires_at IS NULL THEN '임시 비밀번호 없음'
    ELSE '만료됨 ✗'
  END as password_status,
  is_approved,
  last_login
FROM users 
WHERE username = 'wodnr990921';  -- 본인 username으로 변경

-- 2. Supabase Auth 사용자 확인
SELECT 
  id,
  email,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_sent_at
FROM auth.users
WHERE email = (SELECT email FROM users WHERE username = 'wodnr990921');

-- 3. 만약 is_approved가 false라면 승인 처리
-- UPDATE users SET is_approved = true WHERE username = 'wodnr990921';
