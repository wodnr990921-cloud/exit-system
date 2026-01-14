-- Logistics System Migration
-- 물류 시스템을 위한 스키마 변경

-- senders 테이블에 일일 사용 횟수 추적 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'daily_usage_count'
  ) THEN
    ALTER TABLE senders ADD COLUMN daily_usage_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'senders' AND column_name = 'last_reset_date'
  ) THEN
    ALTER TABLE senders ADD COLUMN last_reset_date DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- task_items의 status에 'shipped' 상태 지원 (이미 있을 수도 있음)
-- 'shipped' 상태는 이미 VARCHAR(50)이므로 추가 컬럼 불필요
-- 다만, CHECK 제약조건이 있다면 수정 필요

-- 발송 기록을 위한 shipment_logs 테이블 생성 (선택사항 - 향후 확장용)
CREATE TABLE IF NOT EXISTS shipment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_item_id UUID NOT NULL REFERENCES task_items(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
  shipped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tracking_number VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_logs_task_item_id ON shipment_logs(task_item_id);
CREATE INDEX IF NOT EXISTS idx_shipment_logs_sender_id ON shipment_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_shipment_logs_shipped_at ON shipment_logs(shipped_at DESC);

-- 일일 사용 횟수 자동 리셋 함수 (선택사항)
CREATE OR REPLACE FUNCTION reset_daily_sender_usage()
RETURNS void AS $$
BEGIN
  UPDATE senders
  SET daily_usage_count = 0,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
