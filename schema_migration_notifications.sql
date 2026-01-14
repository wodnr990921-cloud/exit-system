-- Customer Notifications System Migration
-- 고객 알림 메시지 저장 및 티켓 답변 취합 시스템

-- customer_notifications 테이블 생성 (일일 알림 메시지 저장)
CREATE TABLE IF NOT EXISTS customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'charge', 'deposit', 'transfer', 'win', 'transfer_sent', 'transfer_received'
  message TEXT NOT NULL,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  related_point_id UUID REFERENCES points(id) ON DELETE SET NULL,
  related_task_item_id UUID REFERENCES task_items(id) ON DELETE SET NULL,
  sent BOOLEAN DEFAULT FALSE, -- 티켓 답변에 포함되었는지 여부
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id ON customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_sent ON customer_notifications(sent);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_type ON customer_notifications(notification_type);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_customer_notifications_updated_at ON customer_notifications;
CREATE TRIGGER update_customer_notifications_updated_at
  BEFORE UPDATE ON customer_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- customers 테이블에 depositor_name이 없을 수 있으므로 확인 (이미 있을 수도 있음)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'depositor_name'
  ) THEN
    ALTER TABLE customers ADD COLUMN depositor_name VARCHAR(255);
  END IF;
END $$;
