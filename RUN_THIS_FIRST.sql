-- =====================================================
-- 먼저 실행: 필수 마이그레이션
-- =====================================================
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1. is_approved 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT true;
  END IF;
END $$;

-- 2. last_login 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 3. username 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ADD COLUMN username VARCHAR(255);
  END IF;
END $$;

-- 4. 모든 사용자에게 username 설정 (이메일 앞부분 사용)
UPDATE users 
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL OR username = '';

-- 5. 모든 사용자 승인
UPDATE users SET is_approved = true WHERE is_approved = false OR is_approved IS NULL;

-- 6. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- 7. 결과 확인
SELECT 
  id,
  username,
  email,
  role,
  is_approved,
  last_login,
  created_at
FROM users
ORDER BY created_at DESC;

-- =====================================================
-- 완료! 이제 username이 설정되었습니다
-- =====================================================
