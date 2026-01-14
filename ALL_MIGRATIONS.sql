-- ============================================
-- 전체 마이그레이션 스크립트 (통합 버전)
-- 실행 순서: 이 파일 전체를 Supabase SQL Editor에 복사 후 실행
-- ============================================

-- ============================================
-- STEP 1: Task Items 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL, 
  amount INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_task_items_task_id ON task_items(task_id);
CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_task_items_category ON task_items(category);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_task_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_task_items_updated_at ON task_items;
CREATE TRIGGER update_task_items_updated_at
  BEFORE UPDATE ON task_items
  FOR EACH ROW
  EXECUTE FUNCTION update_task_items_updated_at();

-- ============================================
-- STEP 2: Closing 시스템 컬럼 추가
-- ============================================

-- tasks 테이블에 마감 관련 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'reply_content'
  ) THEN
    ALTER TABLE tasks ADD COLUMN reply_content TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN closed_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- task_items 테이블에 발주 관련 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_items' AND column_name = 'procurement_status'
  ) THEN
    ALTER TABLE task_items ADD COLUMN procurement_status VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_items' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE task_items ADD COLUMN sender_name VARCHAR(255);
  END IF;
END $$;

-- games 테이블에 is_verified 컬럼 추가 (games 테이블이 존재하는 경우에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'games'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'games' AND column_name = 'is_verified'
    ) THEN
      ALTER TABLE games ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
    END IF;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_closed_at ON tasks(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_closed_by ON tasks(closed_by) WHERE closed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_items_procurement_status ON task_items(procurement_status) WHERE procurement_status IS NOT NULL;

-- games 테이블 인덱스 (games 테이블이 존재하는 경우에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'games'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_games_is_verified ON games(is_verified) WHERE is_verified = TRUE;
  END IF;
END $$;

-- ============================================
-- STEP 3: Tasks 테이블 향상 (티켓 번호 자동 생성 포함)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN member_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    -- 기존 customer_id 데이터를 member_id로 복사
    UPDATE tasks SET member_id = customer_id WHERE customer_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ticket_no'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ticket_no VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_summary TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE tasks ADD COLUMN total_amount INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'letter_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN letter_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assignee_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
    -- 기존 assigned_to 데이터를 assignee_id로 복사
    UPDATE tasks SET assignee_id = assigned_to WHERE assigned_to IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- letters 테이블이 존재하는 경우 letter_id에 외래 키 추가
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'letters'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'tasks_letter_id_fkey'
    ) THEN
      ALTER TABLE tasks ADD CONSTRAINT tasks_letter_id_fkey
        FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================
-- 티켓 번호 자동 생성 함수
-- ============================================

CREATE OR REPLACE FUNCTION generate_ticket_no()
RETURNS TEXT AS $$
DECLARE
  today TEXT;
  seq_num INTEGER;
  ticket_no TEXT;
BEGIN
  -- 오늘 날짜 형식: YYMMDD
  today := TO_CHAR(NOW(), 'YYMMDD');

  -- 오늘 날짜로 시작하는 티켓 중 가장 큰 번호 찾기
  SELECT COALESCE(MAX(
    CASE
      WHEN ticket_no ~ ('^' || today || '-[0-9]+$')
      THEN CAST(SUBSTRING(ticket_no FROM '[0-9]+$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM tasks
  WHERE ticket_no LIKE (today || '-%');

  -- 티켓 번호 생성: YYMMDD-NNNN (예: 260114-0001)
  ticket_no := today || '-' || LPAD(seq_num::TEXT, 4, '0');

  RETURN ticket_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 티켓 생성 시 자동으로 ticket_no 생성 트리거
-- ============================================

CREATE OR REPLACE FUNCTION auto_generate_ticket_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_no IS NULL THEN
    NEW.ticket_no := generate_ticket_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_ticket_no ON tasks;
CREATE TRIGGER trigger_auto_generate_ticket_no
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_ticket_no();

-- ============================================
-- 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tasks_member_id ON tasks(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_ticket_no ON tasks(ticket_no) WHERE ticket_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_letter_id ON tasks(letter_id) WHERE letter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_processed_at ON tasks(processed_at) WHERE processed_at IS NOT NULL;

-- ============================================
-- 기존 티켓에 ticket_no 부여
-- ============================================

UPDATE tasks
SET ticket_no = generate_ticket_no()
WHERE ticket_no IS NULL;

-- ============================================
-- 마이그레이션 완료!
-- ============================================

-- 검증 쿼리 (아래 쿼리를 실행하여 확인)
/*
-- 1. tasks 테이블 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY column_name;

-- 2. task_items 테이블 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'task_items'
ORDER BY column_name;

-- 3. 티켓 번호 생성 함수 테스트
SELECT generate_ticket_no();

-- 4. 기존 티켓에 ticket_no가 부여되었는지 확인
SELECT id, ticket_no, created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 10;
*/

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