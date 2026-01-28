-- ============================================================================
-- 엑시트컴퍼니 데이터베이스 트랜잭션 RPC 함수
-- 목적: 금융 관련 작업의 원자성(Atomicity) 보장
-- 작성일: 2026-01-28
-- ============================================================================

-- ============================================================================
-- 1. 포인트 충전 함수 (트랜잭션)
-- ============================================================================
CREATE OR REPLACE FUNCTION charge_points(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_category TEXT, -- 'general' or 'betting'
  p_charged_by UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer RECORD;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- 고객 정보 조회 및 락
  SELECT * INTO v_customer
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '회원을 찾을 수 없습니다: %', p_customer_id;
  END IF;

  -- 금액 검증
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '충전 금액은 0보다 커야 합니다: %', p_amount;
  END IF;

  -- 카테고리별 잔액 업데이트
  IF p_category = 'general' THEN
    v_new_balance := COALESCE(v_customer.total_point_general, 0) + p_amount;
    UPDATE customers
    SET total_point_general = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;
  ELSIF p_category = 'betting' THEN
    v_new_balance := COALESCE(v_customer.total_point_betting, 0) + p_amount;
    UPDATE customers
    SET total_point_betting = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;
  ELSE
    RAISE EXCEPTION '잘못된 카테고리: %', p_category;
  END IF;

  -- 포인트 이력 기록 (point_history 테이블이 있다고 가정)
  INSERT INTO point_history (
    customer_id,
    amount,
    type,
    category,
    balance_after,
    performed_by,
    note,
    created_at
  ) VALUES (
    p_customer_id,
    p_amount,
    'charge',
    p_category,
    v_new_balance,
    p_charged_by,
    p_note,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- 성공 응답
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'customer_id', p_customer_id,
    'amount', p_amount,
    'category', p_category,
    'new_balance', v_new_balance,
    'timestamp', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '포인트 충전 실패: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 2. 포인트 차감 함수 (트랜잭션)
-- ============================================================================
CREATE OR REPLACE FUNCTION deduct_points(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_category TEXT, -- 'general' or 'betting'
  p_deducted_by UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer RECORD;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- 고객 정보 조회 및 락
  SELECT * INTO v_customer
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '회원을 찾을 수 없습니다: %', p_customer_id;
  END IF;

  -- 금액 검증
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '차감 금액은 0보다 커야 합니다: %', p_amount;
  END IF;

  -- 카테고리별 잔액 확인
  IF p_category = 'general' THEN
    v_current_balance := COALESCE(v_customer.total_point_general, 0);
  ELSIF p_category = 'betting' THEN
    v_current_balance := COALESCE(v_customer.total_point_betting, 0);
  ELSE
    RAISE EXCEPTION '잘못된 카테고리: %', p_category;
  END IF;

  -- 잔액 부족 확인
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION '잔액이 부족합니다. 현재: %, 차감: %', v_current_balance, p_amount;
  END IF;

  -- 잔액 차감
  v_new_balance := v_current_balance - p_amount;

  -- 카테고리별 업데이트
  IF p_category = 'general' THEN
    UPDATE customers
    SET total_point_general = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;
  ELSE
    UPDATE customers
    SET total_point_betting = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  -- 포인트 이력 기록
  INSERT INTO point_history (
    customer_id,
    amount,
    type,
    category,
    balance_after,
    performed_by,
    note,
    created_at
  ) VALUES (
    p_customer_id,
    -p_amount, -- 음수로 기록
    'deduct',
    p_category,
    v_new_balance,
    p_deducted_by,
    p_note,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  -- 성공 응답
  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'customer_id', p_customer_id,
    'amount', p_amount,
    'category', p_category,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'timestamp', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '포인트 차감 실패: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 3. 배팅 정산 함수 (트랜잭션)
-- ============================================================================
CREATE OR REPLACE FUNCTION settle_betting(
  p_task_item_id UUID,
  p_is_win BOOLEAN,
  p_payout NUMERIC,
  p_settled_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_item RECORD;
  v_task RECORD;
  v_customer_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_bet_amount NUMERIC;
BEGIN
  -- task_item 조회 및 락
  SELECT * INTO v_task_item
  FROM task_items
  WHERE id = p_task_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '배팅 아이템을 찾을 수 없습니다: %', p_task_item_id;
  END IF;

  -- 이미 정산된 경우
  IF v_task_item.status IN ('won', 'lost') THEN
    RAISE EXCEPTION '이미 정산된 배팅입니다: %', v_task_item.status;
  END IF;

  -- task 조회
  SELECT * INTO v_task
  FROM tasks
  WHERE id = v_task_item.task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '티켓을 찾을 수 없습니다: %', v_task_item.task_id;
  END IF;

  v_customer_id := v_task.member_id;
  v_bet_amount := v_task_item.amount;

  -- 고객 정보 조회 및 락
  SELECT total_point_betting INTO v_current_balance
  FROM customers
  WHERE id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '회원을 찾을 수 없습니다: %', v_customer_id;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);

  -- 당첨 처리
  IF p_is_win THEN
    -- 배당금 지급
    v_new_balance := v_current_balance + p_payout;

    UPDATE customers
    SET total_point_betting = v_new_balance,
        updated_at = NOW()
    WHERE id = v_customer_id;

    -- task_item 상태 업데이트
    UPDATE task_items
    SET status = 'won',
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_task_item_id;

    -- 포인트 이력 기록
    INSERT INTO point_history (
      customer_id,
      amount,
      type,
      category,
      balance_after,
      performed_by,
      note,
      created_at
    ) VALUES (
      v_customer_id,
      p_payout,
      'win',
      'betting',
      v_new_balance,
      p_settled_by,
      '배팅 당첨금 지급',
      NOW()
    );
  ELSE
    -- 낙첨 처리 (잔액 변동 없음)
    UPDATE task_items
    SET status = 'lost',
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_task_item_id;

    v_new_balance := v_current_balance;
  END IF;

  -- 성공 응답
  RETURN json_build_object(
    'success', true,
    'task_item_id', p_task_item_id,
    'customer_id', v_customer_id,
    'is_win', p_is_win,
    'bet_amount', v_bet_amount,
    'payout', p_payout,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'timestamp', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '배팅 정산 실패: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 4. 티켓 승인 및 포인트 차감 함수 (트랜잭션)
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_task_with_deduction(
  p_task_id UUID,
  p_approved_by UUID,
  p_deduct_amount NUMERIC DEFAULT 0,
  p_category TEXT DEFAULT 'general'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task RECORD;
  v_customer_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- task 조회 및 락
  SELECT * INTO v_task
  FROM tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '티켓을 찾을 수 없습니다: %', p_task_id;
  END IF;

  -- 이미 승인된 경우
  IF v_task.status = 'approved' THEN
    RAISE EXCEPTION '이미 승인된 티켓입니다';
  END IF;

  v_customer_id := v_task.member_id;

  -- 포인트 차감이 필요한 경우
  IF p_deduct_amount > 0 THEN
    -- 고객 잔액 조회 및 락
    IF p_category = 'general' THEN
      SELECT total_point_general INTO v_current_balance
      FROM customers
      WHERE id = v_customer_id
      FOR UPDATE;
    ELSE
      SELECT total_point_betting INTO v_current_balance
      FROM customers
      WHERE id = v_customer_id
      FOR UPDATE;
    END IF;

    v_current_balance := COALESCE(v_current_balance, 0);

    -- 잔액 확인
    IF v_current_balance < p_deduct_amount THEN
      RAISE EXCEPTION '잔액이 부족합니다. 현재: %, 필요: %', v_current_balance, p_deduct_amount;
    END IF;

    -- 잔액 차감
    v_new_balance := v_current_balance - p_deduct_amount;

    IF p_category = 'general' THEN
      UPDATE customers
      SET total_point_general = v_new_balance,
          updated_at = NOW()
      WHERE id = v_customer_id;
    ELSE
      UPDATE customers
      SET total_point_betting = v_new_balance,
          updated_at = NOW()
      WHERE id = v_customer_id;
    END IF;

    -- 포인트 이력 기록
    INSERT INTO point_history (
      customer_id,
      amount,
      type,
      category,
      balance_after,
      performed_by,
      note,
      created_at
    ) VALUES (
      v_customer_id,
      -p_deduct_amount,
      'deduct',
      p_category,
      v_new_balance,
      p_approved_by,
      '티켓 승인 시 포인트 차감',
      NOW()
    );
  ELSE
    v_new_balance := v_current_balance;
  END IF;

  -- task 상태 업데이트
  UPDATE tasks
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = p_approved_by,
      updated_at = NOW()
  WHERE id = p_task_id;

  -- 성공 응답
  RETURN json_build_object(
    'success', true,
    'task_id', p_task_id,
    'customer_id', v_customer_id,
    'deducted_amount', p_deduct_amount,
    'category', p_category,
    'new_balance', v_new_balance,
    'timestamp', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '티켓 승인 실패: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 5. 환불 처리 함수 (트랜잭션)
-- ============================================================================
CREATE OR REPLACE FUNCTION process_refund(
  p_task_item_id UUID,
  p_refund_amount NUMERIC,
  p_category TEXT,
  p_processed_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_item RECORD;
  v_task RECORD;
  v_customer_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- task_item 조회 및 락
  SELECT * INTO v_task_item
  FROM task_items
  WHERE id = p_task_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '아이템을 찾을 수 없습니다: %', p_task_item_id;
  END IF;

  -- task 조회
  SELECT * INTO v_task
  FROM tasks
  WHERE id = v_task_item.task_id;

  v_customer_id := v_task.member_id;

  -- 환불 금액 검증
  IF p_refund_amount <= 0 THEN
    RAISE EXCEPTION '환불 금액은 0보다 커야 합니다: %', p_refund_amount;
  END IF;

  -- 고객 잔액 조회 및 락
  IF p_category = 'general' THEN
    SELECT total_point_general INTO v_current_balance
    FROM customers
    WHERE id = v_customer_id
    FOR UPDATE;
  ELSE
    SELECT total_point_betting INTO v_current_balance
    FROM customers
    WHERE id = v_customer_id
    FOR UPDATE;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance := v_current_balance + p_refund_amount;

  -- 잔액 업데이트
  IF p_category = 'general' THEN
    UPDATE customers
    SET total_point_general = v_new_balance,
        updated_at = NOW()
    WHERE id = v_customer_id;
  ELSE
    UPDATE customers
    SET total_point_betting = v_new_balance,
        updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  -- task_item 상태 업데이트
  UPDATE task_items
  SET status = 'refunded',
      refunded_at = NOW(),
      updated_at = NOW()
  WHERE id = p_task_item_id;

  -- 포인트 이력 기록
  INSERT INTO point_history (
    customer_id,
    amount,
    type,
    category,
    balance_after,
    performed_by,
    note,
    created_at
  ) VALUES (
    v_customer_id,
    p_refund_amount,
    'refund',
    p_category,
    v_new_balance,
    p_processed_by,
    COALESCE(p_reason, '환불 처리'),
    NOW()
  );

  -- 성공 응답
  RETURN json_build_object(
    'success', true,
    'task_item_id', p_task_item_id,
    'customer_id', v_customer_id,
    'refund_amount', p_refund_amount,
    'category', p_category,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'timestamp', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '환불 처리 실패: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 6. 일괄 배팅 정산 함수 (트랜잭션)
-- ============================================================================
CREATE OR REPLACE FUNCTION bulk_settle_betting(
  p_match_id UUID,
  p_winning_choice TEXT, -- 'home', 'away', 'draw'
  p_settled_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_item RECORD;
  v_total_bets INT := 0;
  v_total_wins INT := 0;
  v_total_losses INT := 0;
  v_total_payout NUMERIC := 0;
  v_total_bet_amount NUMERIC := 0;
  v_results JSON[];
BEGIN
  -- 해당 경기의 모든 배팅 처리
  FOR v_task_item IN
    SELECT ti.*, t.member_id, ti.betting_odds, ti.betting_choice
    FROM task_items ti
    JOIN tasks t ON ti.task_id = t.id
    WHERE ti.match_id = p_match_id
      AND ti.category = 'betting'
      AND ti.status = 'pending'
    FOR UPDATE OF ti
  LOOP
    v_total_bets := v_total_bets + 1;
    v_total_bet_amount := v_total_bet_amount + v_task_item.amount;

    -- 승패 판단
    IF v_task_item.betting_choice = p_winning_choice THEN
      -- 당첨
      DECLARE
        v_payout NUMERIC;
        v_current_balance NUMERIC;
        v_new_balance NUMERIC;
      BEGIN
        v_payout := FLOOR(v_task_item.amount * v_task_item.betting_odds);
        v_total_payout := v_total_payout + v_payout;
        v_total_wins := v_total_wins + 1;

        -- 고객 잔액 업데이트
        SELECT total_point_betting INTO v_current_balance
        FROM customers
        WHERE id = v_task_item.member_id
        FOR UPDATE;

        v_current_balance := COALESCE(v_current_balance, 0);
        v_new_balance := v_current_balance + v_payout;

        UPDATE customers
        SET total_point_betting = v_new_balance,
            updated_at = NOW()
        WHERE id = v_task_item.member_id;

        -- task_item 상태 업데이트
        UPDATE task_items
        SET status = 'won',
            settled_at = NOW(),
            updated_at = NOW()
        WHERE id = v_task_item.id;

        -- 포인트 이력 기록
        INSERT INTO point_history (
          customer_id,
          amount,
          type,
          category,
          balance_after,
          performed_by,
          note,
          created_at
        ) VALUES (
          v_task_item.member_id,
          v_payout,
          'win',
          'betting',
          v_new_balance,
          p_settled_by,
          '배팅 당첨',
          NOW()
        );

        v_results := array_append(v_results, json_build_object(
          'task_item_id', v_task_item.id,
          'customer_id', v_task_item.member_id,
          'status', 'won',
          'payout', v_payout
        ));
      END;
    ELSE
      -- 낙첨
      v_total_losses := v_total_losses + 1;

      UPDATE task_items
      SET status = 'lost',
          settled_at = NOW(),
          updated_at = NOW()
      WHERE id = v_task_item.id;

      v_results := array_append(v_results, json_build_object(
        'task_item_id', v_task_item.id,
        'customer_id', v_task_item.member_id,
        'status', 'lost',
        'payout', 0
      ));
    END IF;
  END LOOP;

  -- 경기 정산 완료 표시
  UPDATE sports_matches
  SET is_settled = true,
      settled_at = NOW(),
      settled_by = p_settled_by
  WHERE id = p_match_id;

  -- 성공 응답
  RETURN json_build_object(
    'success', true,
    'match_id', p_match_id,
    'winning_choice', p_winning_choice,
    'total_bets', v_total_bets,
    'total_wins', v_total_wins,
    'total_losses', v_total_losses,
    'total_bet_amount', v_total_bet_amount,
    'total_payout', v_total_payout,
    'profit', v_total_bet_amount - v_total_payout,
    'results', v_results,
    'timestamp', NOW()
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '일괄 배팅 정산 실패: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 7. point_history 테이블 생성 (이력 기록용)
-- ============================================================================
CREATE TABLE IF NOT EXISTS point_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'deduct', 'win', 'refund')),
  category TEXT NOT NULL CHECK (category IN ('general', 'betting')),
  balance_after NUMERIC NOT NULL,
  performed_by UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_point_history_customer ON point_history(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_history_type ON point_history(type, created_at DESC);

-- ============================================================================
-- 8. RLS (Row Level Security) 설정
-- ============================================================================

-- point_history 테이블 RLS 활성화
ALTER TABLE point_history ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 조회 가능
CREATE POLICY "Anyone can view point history" ON point_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 시스템만 삽입 가능 (RPC 함수에서만)
CREATE POLICY "Only system can insert point history" ON point_history
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 완료
-- ============================================================================
COMMENT ON FUNCTION charge_points IS '포인트 충전 (트랜잭션 안전)';
COMMENT ON FUNCTION deduct_points IS '포인트 차감 (트랜잭션 안전)';
COMMENT ON FUNCTION settle_betting IS '배팅 정산 (트랜잭션 안전)';
COMMENT ON FUNCTION approve_task_with_deduction IS '티켓 승인 및 포인트 차감 (트랜잭션 안전)';
COMMENT ON FUNCTION process_refund IS '환불 처리 (트랜잭션 안전)';
COMMENT ON FUNCTION bulk_settle_betting IS '일괄 배팅 정산 (트랜잭션 안전)';
