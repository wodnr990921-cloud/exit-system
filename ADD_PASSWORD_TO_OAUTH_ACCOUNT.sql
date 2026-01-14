-- =====================================================
-- OAuth(구글) 계정에 비밀번호 추가하기
-- =====================================================
-- Supabase SQL Editor에서는 직접 비밀번호를 설정할 수 없습니다.
-- Supabase Dashboard를 사용해야 합니다.
-- =====================================================

-- 1단계: 본인 계정 확인
SELECT 
  id,
  username,
  email,
  role,
  is_approved
FROM users 
WHERE username = 'wodnr990921';  -- 본인 username

-- 2단계: Supabase Auth 사용자 확인
SELECT 
  id,
  email,
  aud,
  -- provider를 확인 (google이면 OAuth 계정)
  raw_app_meta_data,
  raw_user_meta_data
FROM auth.users
WHERE email = (SELECT email FROM users WHERE username = 'wodnr990921');

-- =====================================================
-- Dashboard에서 비밀번호 설정
-- =====================================================
-- 1. https://supabase.com 접속
-- 2. Authentication > Users
-- 3. 본인 이메일 찾기
-- 4. ... > Reset Password
-- 5. 새 비밀번호 입력 (예: mypassword123)
-- 6. Update user
-- 
-- 이제 구글 로그인 + username/password 로그인 둘 다 가능!
-- =====================================================

-- 3단계: is_approved 확인 및 설정
UPDATE users 
SET is_approved = true 
WHERE username = 'wodnr990921';
