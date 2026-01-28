-- 포인트 처리 흐름 확인용 쿼리

-- 1. 최근 생성된 포인트 기록 확인 (티켓 관련)
SELECT
  id,
  customer_id,
  amount,
  type,
  category,
  status,
  reason,
  created_at
FROM points
WHERE reason LIKE '%티켓%'
ORDER BY created_at DESC
LIMIT 10;

-- 2. pending 상태의 포인트 확인
SELECT
  id,
  customer_id,
  amount,
  type,
  category,
  status,
  reason
FROM points
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- 3. 최근 승인된 포인트 확인
SELECT
  id,
  customer_id,
  amount,
  type,
  category,
  status,
  approved_by,
  created_at
FROM points
WHERE status = 'approved'
  AND type = 'use'
ORDER BY created_at DESC
LIMIT 10;
