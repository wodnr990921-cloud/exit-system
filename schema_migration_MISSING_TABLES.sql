-- ============================================================================
-- 누락된 테이블 추가: inventory, stock_transactions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🚀 누락된 테이블 생성 시작';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- ============================================================================
-- 1. 소모품 재고 관리 테이블 (inventory)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📦 inventory 테이블 생성 중...';
END $$;

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,                    -- 소모품명
  item_code TEXT UNIQUE NOT NULL,             -- 소모품 코드
  current_stock INTEGER NOT NULL DEFAULT 0,   -- 현재 재고
  min_stock_level INTEGER NOT NULL DEFAULT 10,-- 최소 재고 수준
  unit TEXT NOT NULL DEFAULT '개',            -- 단위
  unit_price NUMERIC(10,2) DEFAULT 0,         -- 단가
  last_restocked_at TIMESTAMPTZ,              -- 마지막 입고일
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '✓ inventory 테이블 생성 완료';
END $$;

-- ============================================================================
-- 2. 재고 거래 내역 테이블 (stock_transactions)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📋 stock_transactions 테이블 생성 중...';
END $$;

CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjust')),
  quantity INTEGER NOT NULL,                  -- 수량 (입고는 +, 출고는 -)
  before_stock INTEGER NOT NULL,              -- 거래 전 재고
  after_stock INTEGER NOT NULL,               -- 거래 후 재고
  reason TEXT,                                -- 사유
  created_by UUID REFERENCES users(id),       -- 처리자
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '✓ stock_transactions 테이블 생성 완료';
END $$;

-- ============================================================================
-- 3. 인덱스 생성
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔍 인덱스 생성 중...';
END $$;

-- inventory 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_item_code ON inventory(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_current_stock ON inventory(current_stock);

-- stock_transactions 인덱스
CREATE INDEX IF NOT EXISTS idx_stock_transactions_item_id ON stock_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at ON stock_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_by ON stock_transactions(created_by);

DO $$
BEGIN
  RAISE NOTICE '✓ 인덱스 생성 완료';
END $$;

-- ============================================================================
-- 4. RLS 정책 설정
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '🔐 RLS 정책 설정 중...';
END $$;

-- RLS 활성화
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

-- inventory 정책: 인증된 사용자 모두 읽기 가능
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON inventory;
CREATE POLICY "Authenticated users can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (true);

-- inventory 정책: 관리자만 수정 가능
DROP POLICY IF EXISTS "Admin users can manage inventory" ON inventory;
CREATE POLICY "Admin users can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ceo', 'operator', 'admin')
    )
  );

-- stock_transactions 정책: 인증된 사용자 모두 읽기 가능
DROP POLICY IF EXISTS "Authenticated users can view stock transactions" ON stock_transactions;
CREATE POLICY "Authenticated users can view stock transactions"
  ON stock_transactions FOR SELECT
  TO authenticated
  USING (true);

-- stock_transactions 정책: 관리자만 추가 가능
DROP POLICY IF EXISTS "Admin users can create stock transactions" ON stock_transactions;
CREATE POLICY "Admin users can create stock transactions"
  ON stock_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('ceo', 'operator', 'admin')
    )
  );

DO $$
BEGIN
  RAISE NOTICE '✓ RLS 정책 설정 완료';
END $$;

-- ============================================================================
-- 5. 트리거 생성: updated_at 자동 갱신
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '⚡ 트리거 생성 중...';
END $$;

-- updated_at 갱신 함수 (존재하지 않을 경우에만 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- inventory 트리거
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  RAISE NOTICE '✓ 트리거 생성 완료';
END $$;

-- ============================================================================
-- 6. 샘플 데이터 추가 (선택사항)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '📝 샘플 데이터 추가 중...';
END $$;

INSERT INTO inventory (item_name, item_code, current_stock, min_stock_level, unit, unit_price)
VALUES
  ('A4 용지', 'PAPER-A4', 500, 100, '장', 5),
  ('볼펜 (흑색)', 'PEN-BLACK', 50, 20, '개', 500),
  ('포장 박스 (소)', 'BOX-S', 100, 30, '개', 300),
  ('포장 박스 (중)', 'BOX-M', 80, 30, '개', 500),
  ('포장 박스 (대)', 'BOX-L', 50, 20, '개', 700),
  ('테이프', 'TAPE', 30, 10, '개', 1000)
ON CONFLICT (item_code) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✓ 샘플 데이터 추가 완료';
END $$;

-- ============================================================================
-- 완료
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ 모든 테이블이 성공적으로 생성되었습니다!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📋 생성된 테이블:';
  RAISE NOTICE '  • inventory (소모품 재고)';
  RAISE NOTICE '  • stock_transactions (재고 거래 내역)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 다음 단계:';
  RAISE NOTICE '  1. 개발 서버 재시작: Ctrl+C 후 npm run dev';
  RAISE NOTICE '  2. 브라우저 새로고침';
  RAISE NOTICE '';
END $$;
