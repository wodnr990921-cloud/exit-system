-- =====================================================
-- PASSWORD RESET & TEMPORARY PASSWORD SYSTEM
-- =====================================================
-- 비밀번호 재설정 및 임시 비밀번호 시스템
-- =====================================================

-- users 테이블에 임시 비밀번호 관련 컬럼 추가
DO $$
BEGIN
  -- temp_password 컬럼 추가 (임시 비밀번호)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'temp_password'
  ) THEN
    ALTER TABLE users ADD COLUMN temp_password VARCHAR(255);
  END IF;

  -- temp_password_expires_at 컬럼 추가 (임시 비밀번호 만료 시간)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'temp_password_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN temp_password_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- is_temp_password 컬럼 추가 (임시 비밀번호 사용 여부)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_temp_password'
  ) THEN
    ALTER TABLE users ADD COLUMN is_temp_password BOOLEAN DEFAULT false;
  END IF;

  -- password_reset_token 컬럼 추가 (비밀번호 재설정 토큰)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_reset_token'
  ) THEN
    ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255);
  END IF;

  -- password_reset_expires_at 컬럼 추가 (재설정 토큰 만료 시간)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password_reset_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_temp_password ON users(temp_password);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_is_temp_password ON users(is_temp_password);

-- 코멘트 추가
COMMENT ON COLUMN users.temp_password IS '임시 비밀번호 (해시값)';
COMMENT ON COLUMN users.temp_password_expires_at IS '임시 비밀번호 만료 시간 (24시간)';
COMMENT ON COLUMN users.is_temp_password IS '현재 임시 비밀번호 사용 중 여부';
COMMENT ON COLUMN users.password_reset_token IS '비밀번호 재설정 토큰';
COMMENT ON COLUMN users.password_reset_expires_at IS '재설정 토큰 만료 시간';
