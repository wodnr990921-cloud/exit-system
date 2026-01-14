-- =====================================================
-- USER AUTHENTICATION & AUTHORIZATION SYSTEM UPDATE
-- =====================================================
-- 사용자 인증 및 권한 시스템 업데이트
-- is_approved, last_login 컬럼 추가
-- =====================================================

-- users 테이블에 is_approved 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_approved'
  ) THEN
    ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT false;

    -- 기존 사용자는 모두 승인 처리
    UPDATE users SET is_approved = true WHERE is_approved IS NULL;

    -- admin, ceo 역할은 자동 승인
    UPDATE users SET is_approved = true WHERE role IN ('admin', 'ceo');
  END IF;
END $$;

-- users 테이블에 last_login 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 코멘트 추가
COMMENT ON COLUMN users.is_approved IS '계정 승인 여부 - 로그인을 허용할지 결정';
COMMENT ON COLUMN users.last_login IS '마지막 로그인 시간';

-- audit_logs 테이블 구조 확인 및 수정
-- table_name, record_id 컬럼이 있는지 확인하고 없으면 추가
DO $$
BEGIN
  -- table_name 컬럼 확인 (entity_type에서 변경될 수 있음)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'table_name'
  ) THEN
    -- entity_type 컬럼이 있다면 이름 변경, 없으면 추가
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'audit_logs' AND column_name = 'entity_type'
    ) THEN
      ALTER TABLE audit_logs RENAME COLUMN entity_type TO table_name;
    ELSE
      ALTER TABLE audit_logs ADD COLUMN table_name VARCHAR(100);
    END IF;
  END IF;

  -- record_id 컬럼 확인
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'record_id'
  ) THEN
    -- entity_id 컬럼이 있다면 이름 변경, 없으면 추가
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'audit_logs' AND column_name = 'entity_id'
    ) THEN
      ALTER TABLE audit_logs RENAME COLUMN entity_id TO record_id;
    ELSE
      ALTER TABLE audit_logs ADD COLUMN record_id UUID;
    END IF;
  END IF;

  -- changes 컬럼 확인 (old_values, new_values를 통합)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'changes'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN changes JSONB;

    -- 기존 데이터 마이그레이션
    UPDATE audit_logs
    SET changes = jsonb_build_object(
      'old_values', COALESCE(old_values, '{}'::jsonb),
      'new_values', COALESCE(new_values, '{}'::jsonb)
    )
    WHERE changes IS NULL;
  END IF;
END $$;

-- audit_logs 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);

COMMENT ON COLUMN users.is_approved IS 'Account approval status - determines if user can login';
COMMENT ON COLUMN users.last_login IS 'Last login timestamp';

-- RLS 정책 업데이트 (is_approved 체크 추가)
-- users 테이블에 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 정보를 볼 수 있음
DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

-- 관리자는 모든 사용자 정보를 볼 수 있음
DROP POLICY IF EXISTS users_select_admin ON users;
CREATE POLICY users_select_admin ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'ceo', 'operator')
    )
  );

-- 관리자는 사용자 정보를 수정할 수 있음
DROP POLICY IF EXISTS users_update_admin ON users;
CREATE POLICY users_update_admin ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'ceo', 'operator')
    )
  );

-- 사용자는 자신의 last_login을 업데이트할 수 있음
DROP POLICY IF EXISTS users_update_last_login ON users;
CREATE POLICY users_update_last_login ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
