-- Tasks 테이블 향상 마이그레이션
-- 마감 시스템 및 우편실 연동을 위한 필수 컬럼 추가

DO $$
BEGIN
  -- member_id: customers 테이블을 참조하는 회원 ID (customer_id와 동일한 역할, 호환성 유지)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN member_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    -- 기존 customer_id 데이터를 member_id로 복사
    UPDATE tasks SET member_id = customer_id WHERE customer_id IS NOT NULL;
  END IF;

  -- ticket_no: 티켓 고유 번호 (자동 생성)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ticket_no'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ticket_no VARCHAR(50);
  END IF;

  -- ai_summary: AI가 생성한 티켓 요약 (GPT-4o-mini)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_summary TEXT;
  END IF;

  -- total_amount: 티켓의 총 금액 (모든 task_items의 amount 합계)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE tasks ADD COLUMN total_amount INTEGER DEFAULT 0;
  END IF;

  -- letter_id: 원본 편지 이미지 참조 (우편실 연동)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'letter_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN letter_id UUID REFERENCES letters(id) ON DELETE SET NULL;
  END IF;

  -- assignee_id: 담당 직원 ID (기존 assigned_to와 동일, 별칭)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assignee_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;
    -- 기존 assigned_to 데이터를 assignee_id로 복사
    UPDATE tasks SET assignee_id = assigned_to WHERE assigned_to IS NOT NULL;
  END IF;

  -- processed_at: 업무 처리 완료 시각
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
  END IF;

END $$;

-- 티켓 번호 자동 생성 함수
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

-- 티켓 생성 시 자동으로 ticket_no 생성 트리거
CREATE OR REPLACE FUNCTION auto_generate_ticket_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_no IS NULL THEN
    NEW.ticket_no := generate_ticket_no();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 존재하면 삭제 후 재생성)
DROP TRIGGER IF EXISTS trigger_auto_generate_ticket_no ON tasks;
CREATE TRIGGER trigger_auto_generate_ticket_no
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_ticket_no();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_member_id ON tasks(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_ticket_no ON tasks(ticket_no) WHERE ticket_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_letter_id ON tasks(letter_id) WHERE letter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_processed_at ON tasks(processed_at) WHERE processed_at IS NOT NULL;

-- 기존 티켓에 ticket_no 부여 (없는 경우)
UPDATE tasks
SET ticket_no = generate_ticket_no()
WHERE ticket_no IS NULL;
