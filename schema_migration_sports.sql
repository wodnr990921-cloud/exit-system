-- Sports Betting System Migration
-- task_items 테이블에 details 컬럼 추가 (게임 정보 저장용 JSON)

-- task_items에 details JSON 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_items' AND column_name = 'details'
  ) THEN
    ALTER TABLE task_items ADD COLUMN details JSONB;
  END IF;
END $$;

-- task_items status에 'won', 'lost' 상태 추가를 위한 주석
-- (기존 status는 VARCHAR(50)이므로 별도 마이그레이션 불필요)

-- 인덱스 생성 (경기별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_task_items_category_status ON task_items(category, status) WHERE category = 'game';
CREATE INDEX IF NOT EXISTS idx_task_items_description ON task_items(description) WHERE category = 'game';
