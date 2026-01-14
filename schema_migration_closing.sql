-- Daily Closing System Migration
-- 일일 마감 시스템을 위한 스키마 변경

-- tasks 테이블에 마감 관련 컬럼 추가
DO $$ 
BEGIN
  -- reply_content: AI가 생성한 답장 본문 저장 컬럼
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'reply_content'
  ) THEN
    ALTER TABLE tasks ADD COLUMN reply_content TEXT;
  END IF;

  -- closed_at: 마감 일시
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- closed_by: 마감 승인자 ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE tasks ADD COLUMN closed_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- task_items 테이블에 발주 관련 컬럼 추가 (project_spec 요구사항)
DO $$ 
BEGIN
  -- procurement_status: 발주 상태 (구매요청, 구매완료, 도착, 사전등록, 배송대기)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'procurement_status'
  ) THEN
    ALTER TABLE task_items ADD COLUMN procurement_status VARCHAR(50);
  END IF;

  -- sender_name: 발송인 이름 (사전등록 시 지정)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE task_items ADD COLUMN sender_name VARCHAR(255);
  END IF;
END $$;

-- games 테이블에 is_verified 컬럼 추가 (project_spec 요구사항)
DO $$ 
BEGIN
  -- is_verified: 경기 결과 확인 여부 (오퍼레이터 승인)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE games ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;

  -- result_score 컬럼은 이미 result 컬럼이 있으므로 별도 추가 불필요
  -- 필요시 result 컬럼을 result_score로 rename할 수 있으나, 기존 코드와의 호환성을 위해 유지
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_closed_at ON tasks(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_closed_by ON tasks(closed_by) WHERE closed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_items_procurement_status ON task_items(procurement_status) WHERE procurement_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_is_verified ON games(is_verified) WHERE is_verified = TRUE;