-- ============================================
-- Bank Transactions 자동화 시스템
-- ============================================

-- ============================================
-- STEP 1: Bank Transactions 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(255) UNIQUE, -- 은행에서 제공하는 거래 고유 ID
  transaction_type VARCHAR(50) NOT NULL, -- 'deposit', 'withdrawal', 'transfer'
  amount INTEGER NOT NULL,
  balance_after INTEGER, -- 거래 후 잔액
  depositor_name VARCHAR(255), -- 입금자명
  account_number VARCHAR(50), -- 상대방 계좌번호
  bank_name VARCHAR(100), -- 상대방 은행
  content TEXT, -- 적요/메모
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'matched', 'unidentified', 'approved', 'rejected', 'internal'
  is_internal BOOLEAN DEFAULT FALSE, -- 내부 이체 여부
  matched_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  matched_point_id UUID REFERENCES points(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT, -- 관리자 메모
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_type ON bank_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_date ON bank_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_depositor_name ON bank_transactions(depositor_name);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_matched_customer_id ON bank_transactions(matched_customer_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_is_internal ON bank_transactions(is_internal);

-- ============================================
-- STEP 2: 계좌 별칭 관리 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS internal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_alias VARCHAR(100) NOT NULL UNIQUE, -- 계좌 별칭 (예: A계좌, C계좌)
  account_number VARCHAR(50), -- 실제 계좌번호
  bank_name VARCHAR(100),
  account_holder VARCHAR(255), -- 예금주
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_internal_accounts_account_alias ON internal_accounts(account_alias);
CREATE INDEX IF NOT EXISTS idx_internal_accounts_account_number ON internal_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_internal_accounts_is_active ON internal_accounts(is_active) WHERE is_active = TRUE;

-- ============================================
-- STEP 3: 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_bank_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bank_transactions_updated_at ON bank_transactions;
CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_transactions_updated_at();

CREATE OR REPLACE FUNCTION update_internal_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_internal_accounts_updated_at ON internal_accounts;
CREATE TRIGGER update_internal_accounts_updated_at
  BEFORE UPDATE ON internal_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_internal_accounts_updated_at();

-- ============================================
-- STEP 4: 입금자 자동 매칭 함수
-- ============================================

CREATE OR REPLACE FUNCTION match_depositor_to_customer(
  p_depositor_name VARCHAR(255),
  p_amount INTEGER
)
RETURNS TABLE (
  customer_id UUID,
  customer_name VARCHAR(255),
  member_number VARCHAR(50),
  confidence_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.member_number,
    CASE
      -- 이름이 정확히 일치하면 100점
      WHEN c.name = p_depositor_name THEN 100
      -- 이름이 포함되어 있으면 80점
      WHEN c.name LIKE '%' || p_depositor_name || '%' OR p_depositor_name LIKE '%' || c.name || '%' THEN 80
      -- 예금주명이 정확히 일치하면 90점
      WHEN c.depositor_name = p_depositor_name THEN 90
      -- 예금주명이 포함되어 있으면 70점
      WHEN c.depositor_name LIKE '%' || p_depositor_name || '%' OR p_depositor_name LIKE '%' || c.depositor_name || '%' THEN 70
      ELSE 0
    END AS confidence_score
  FROM customers c
  WHERE
    c.name = p_depositor_name
    OR c.name LIKE '%' || p_depositor_name || '%'
    OR p_depositor_name LIKE '%' || c.name || '%'
    OR c.depositor_name = p_depositor_name
    OR c.depositor_name LIKE '%' || p_depositor_name || '%'
    OR p_depositor_name LIKE '%' || c.depositor_name || '%'
  ORDER BY confidence_score DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: 내부 계좌 체크 함수
-- ============================================

CREATE OR REPLACE FUNCTION is_internal_account(
  p_content TEXT,
  p_account_number VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_internal BOOLEAN := FALSE;
BEGIN
  -- 적요에 등록된 계좌 별칭이 포함되어 있는지 확인
  SELECT EXISTS (
    SELECT 1
    FROM internal_accounts
    WHERE
      is_active = TRUE
      AND (
        p_content ILIKE '%' || account_alias || '%'
        OR p_account_number = account_number
      )
  ) INTO v_is_internal;

  RETURN v_is_internal;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: 기본 내부 계좌 샘플 데이터 (선택사항)
-- ============================================

-- 주석 해제하여 사용
/*
INSERT INTO internal_accounts (account_alias, account_number, bank_name, account_holder, description)
VALUES
  ('A계좌', '1234567890', '국민은행', '회사명', '주거래 계좌'),
  ('C계좌', '9876543210', '신한은행', '회사명', '급여 계좌')
ON CONFLICT (account_alias) DO NOTHING;
*/

-- ============================================
-- 마이그레이션 완료!
-- ============================================

-- 검증 쿼리
/*
-- 1. bank_transactions 테이블 확인
SELECT * FROM bank_transactions LIMIT 1;

-- 2. internal_accounts 테이블 확인
SELECT * FROM internal_accounts;

-- 3. 입금자 매칭 함수 테스트
SELECT * FROM match_depositor_to_customer('홍길동', 50000);

-- 4. 내부 계좌 체크 함수 테스트
SELECT is_internal_account('A계좌로 이체', NULL);
*/
