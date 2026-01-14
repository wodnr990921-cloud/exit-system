-- Finance System Migration
-- points 테이블에 task_item_id 컬럼 추가 (부분 환불 및 상세 로그 연결용)

-- points 테이블에 task_item_id 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'points' AND column_name = 'task_item_id'
  ) THEN
    ALTER TABLE points ADD COLUMN task_item_id UUID REFERENCES task_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_points_task_item_id ON points(task_item_id);
CREATE INDEX IF NOT EXISTS idx_points_type_category ON points(type, category);
-- 참고: 일별 조회는 기존 idx_points_created_at 인덱스로 충분히 처리 가능하므로 별도 인덱스 제거
-- (date 캐스팅 인덱스는 IMMUTABLE 문제로 생성 불가)
