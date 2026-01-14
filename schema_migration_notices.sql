-- Notices (공지사항) 테이블 및 Customers 테이블 사서함주소 컬럼 추가
-- 티켓 답변에 포함될 공지사항 관리

-- customers 테이블에 사서함주소 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'mailbox_address'
  ) THEN
    ALTER TABLE customers ADD COLUMN mailbox_address TEXT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE, -- 활성화 여부
  display_order INTEGER DEFAULT 0, -- 표시 순서
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notices_is_active ON notices(is_active);
CREATE INDEX IF NOT EXISTS idx_notices_display_order ON notices(display_order);
CREATE INDEX IF NOT EXISTS idx_notices_created_at ON notices(created_at DESC);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_notices_updated_at ON notices;
CREATE TRIGGER update_notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
