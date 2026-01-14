-- =====================================================
-- 사용자 아이디(username) 확인
-- =====================================================
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1. 모든 사용자 아이디 확인
SELECT 
  id,
  username,
  email,
  role,
  is_approved,
  created_at
FROM users
ORDER BY created_at DESC;

-- 2. username이 NULL인 사용자 확인
SELECT 
  id,
  email,
  username,
  role
FROM users
WHERE username IS NULL OR username = '';

-- 3. 특정 이메일로 username 찾기
-- 본인 이메일로 변경하세요!
SELECT 
  id,
  username,
  email,
  role,
  is_approved
FROM users
WHERE email LIKE '%wodnr%' OR email LIKE '%gmail%';

-- 4. username 설정 (필요시)
-- 본인 이메일과 원하는 username으로 변경하세요!
-- UPDATE users 
-- SET username = 'wodnr990921' 
-- WHERE email = '본인이메일@gmail.com';

-- 5. 확인
-- SELECT username, email FROM users WHERE email = '본인이메일@gmail.com';
