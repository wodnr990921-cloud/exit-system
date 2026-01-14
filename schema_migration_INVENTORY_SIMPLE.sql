-- ============================================================================
-- 간단한 버전: inventory, stock_transactions 테이블 (RLS 비활성화)
-- ============================================================================

-- ============================================================================
-- 1. 기존 테이블 삭제 (있다면)
-- ============================================================================

DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;

-- ============================================================================
-- 2. inventory 테이블 생성
-- ============================================================================

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  item_code TEXT UNIQUE NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 10,
  unit TEXT NOT NULL DEFAULT '개',
  unit_price NUMERIC(10,2) DEFAULT 0,
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. stock_transactions 테이블 생성
-- ============================================================================

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjust')),
  quantity INTEGER NOT NULL,
  before_stock INTEGER NOT NULL,
  after_stock INTEGER NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. 인덱스 생성
-- ============================================================================

CREATE INDEX idx_inventory_item_code ON inventory(item_code);
CREATE INDEX idx_inventory_current_stock ON inventory(current_stock);
CREATE INDEX idx_stock_transactions_item_id ON stock_transactions(item_id);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at DESC);
CREATE INDEX idx_stock_transactions_created_by ON stock_transactions(created_by);

-- ============================================================================
-- 5. RLS 비활성화 (개발 중에는 간단하게)
-- ============================================================================

ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions DISABLE ROW LEVEL SECURITY;

-- 또는 RLS를 활성화하고 모든 인증된 사용자에게 권한 부여
-- ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Allow all for authenticated users" ON inventory;
-- CREATE POLICY "Allow all for authenticated users"
--   ON inventory FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow all for authenticated users" ON stock_transactions;
-- CREATE POLICY "Allow all for authenticated users"
--   ON stock_transactions FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- ============================================================================
-- 6. updated_at 트리거
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. 샘플 데이터
-- ============================================================================

INSERT INTO inventory (item_name, item_code, current_stock, min_stock_level, unit, unit_price)
VALUES
  ('A4 용지', 'PAPER-A4', 500, 100, '장', 5),
  ('볼펜 (흑색)', 'PEN-BLACK', 50, 20, '개', 500),
  ('포장 박스 (소)', 'BOX-S', 100, 30, '개', 300),
  ('포장 박스 (중)', 'BOX-M', 80, 30, '개', 500),
  ('포장 박스 (대)', 'BOX-L', 50, 20, '개', 700),
  ('테이프', 'TAPE', 30, 10, '개', 1000),
  ('에어캡', 'BUBBLE-WRAP', 200, 50, 'm', 100),
  ('OPP 테이프', 'TAPE-OPP', 25, 10, '개', 1500)
ON CONFLICT (item_code) DO NOTHING;

-- ============================================================================
-- 완료 메시지
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ inventory, stock_transactions 테이블 생성 완료!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 생성된 테이블:';
  RAISE NOTICE '  • inventory: % 개 항목', (SELECT COUNT(*) FROM inventory);
  RAISE NOTICE '  • stock_transactions';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  RLS가 비활성화되어 있습니다 (개발용)';
  RAISE NOTICE '   운영 환경에서는 RLS를 활성화하세요!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 다음 단계:';
  RAISE NOTICE '  1. 개발 서버 재시작 (Ctrl+C 후 npm run dev)';
  RAISE NOTICE '  2. 브라우저에서 /dashboard/inventory 확인';
  RAISE NOTICE '';
END $$;
