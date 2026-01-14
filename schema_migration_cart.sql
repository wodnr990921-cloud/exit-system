-- Multi-Item Shopping Cart System Migration
-- 1티켓 다중아이템 구조로 변경

-- tasks 테이블 구조 변경
DO $$ 
BEGIN
  -- ticket_no 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'ticket_no'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ticket_no VARCHAR(50);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_ticket_no ON tasks(ticket_no);
  END IF;

  -- customer_id를 member_id로 변경 (또는 별도 컬럼 추가)
  -- 기존 customer_id는 유지하고 member_id도 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'member_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN member_id UUID REFERENCES customers(id) ON DELETE SET NULL;
  END IF;

  -- total_amount 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE tasks ADD COLUMN total_amount INTEGER DEFAULT 0;
  END IF;

  -- ai_summary 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE tasks ADD COLUMN ai_summary TEXT;
  END IF;
END $$;

-- task_items 테이블 생성
CREATE TABLE IF NOT EXISTS task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'book', 'game', 'goods', 'inquiry', 'complaint', 'other', 'complex'
  description TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
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

-- 기존 데이터 마이그레이션 (선택사항)
-- 기존 tasks 데이터를 task_items로 변환하는 로직
DO $$
DECLARE
  task_record RECORD;
  item_category VARCHAR(50);
BEGIN
  -- 기존 tasks의 work_type을 category로 변환하여 task_items 생성
  FOR task_record IN SELECT * FROM tasks WHERE id NOT IN (SELECT DISTINCT task_id FROM task_items WHERE task_id IS NOT NULL)
  LOOP
    -- work_type을 category로 매핑
    CASE task_record.work_type
      WHEN '도서구매' THEN item_category := 'book';
      WHEN '배팅' THEN item_category := 'game';
      WHEN '영치금' THEN item_category := 'goods';
      WHEN '서신' THEN item_category := 'inquiry';
      ELSE item_category := 'other';
    END CASE;

    -- task_items 생성
    INSERT INTO task_items (task_id, category, description, amount, status)
    VALUES (
      task_record.id,
      item_category,
      COALESCE(task_record.description, task_record.title, ''),
      COALESCE(task_record.amount, 0),
      task_record.status
    );

    -- tasks의 total_amount 업데이트
    UPDATE tasks 
    SET total_amount = COALESCE(task_record.amount, 0),
        member_id = task_record.customer_id,
        ticket_no = 'T' || TO_CHAR(task_record.created_at, 'YYYYMMDD') || '-' || SUBSTRING(task_record.id::text, 1, 8)
    WHERE id = task_record.id;
  END LOOP;
END $$;
