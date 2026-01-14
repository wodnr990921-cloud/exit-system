-- =====================================================
-- 은행 거래 자동화 및 Webhook 지원
-- =====================================================
-- night_work.md Phase 8 요구사항 구현
-- Supabase SQL Editor에서 실행하세요!
-- =====================================================

-- bank_transactions 테이블 생성 (입출금 내역 기록)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    depositor_name VARCHAR(100) NOT NULL, -- 입금자명
    amount DECIMAL(12, 2) NOT NULL, -- 금액
    bank_name VARCHAR(50), -- 은행명
    transaction_time TIMESTAMP WITH TIME ZONE, -- 입금 시간
    transaction_type VARCHAR(20) DEFAULT 'deposit' CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer')), -- 거래 유형
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'processed', 'cancelled')), -- 상태
    matched_point_id UUID REFERENCES points(id) ON DELETE SET NULL, -- 매칭된 포인트 요청 ID
    notes TEXT, -- 메모
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_bank_transactions_depositor_name ON bank_transactions(depositor_name);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_amount ON bank_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_time ON bank_transactions(transaction_time);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_at ON bank_transactions(created_at DESC);

-- Trigger: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_bank_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bank_transactions_updated_at ON bank_transactions;
CREATE TRIGGER trigger_update_bank_transactions_updated_at
    BEFORE UPDATE ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_transactions_updated_at();

-- RLS 활성화
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능
DROP POLICY IF EXISTS bank_transactions_admin_all ON bank_transactions;
CREATE POLICY bank_transactions_admin_all ON bank_transactions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'operator', 'ceo')
        )
    );

-- points 테이블에 'matched' 상태 추가 (이미 있을 수 있음)
DO $$
BEGIN
    -- status 체크 제약 조건 업데이트
    ALTER TABLE points DROP CONSTRAINT IF EXISTS points_status_check;
    ALTER TABLE points ADD CONSTRAINT points_status_check 
        CHECK (status IN ('pending', 'matched', 'approved', 'rejected', 'cancelled'));
END $$;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 은행 거래 자동화 테이블 생성 완료!';
    RAISE NOTICE '📝 Webhook URL: https://your-domain.com/api/webhooks/bank';
    RAISE NOTICE '📝 POST 요청 형식: {"depositor_name": "홍길동", "amount": 50000}';
END $$;
