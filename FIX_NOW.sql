-- =====================================================
-- 즉시 실행: username 설정
-- =====================================================
-- Supabase SQL Editor에서 이것만 실행하세요!
-- =====================================================

-- 1. 모든 사용자에게 자동으로 username 설정
UPDATE users 
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL OR username = '';

-- 2. 결과 확인
SELECT 
  username,
  email,
  role,
  is_approved
FROM users
ORDER BY created_at DESC;

-- 3. 승인 처리도 함께
UPDATE users SET is_approved = true WHERE is_approved = false;

-- =====================================================
-- 완료! 이제 위 결과에서 본인 username을 확인하세요
-- 그 username으로 로그인하세요!
-- =====================================================
