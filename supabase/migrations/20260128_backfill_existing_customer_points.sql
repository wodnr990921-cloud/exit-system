-- Migration: Backfill existing customer points to points table
-- Created: 2026-01-28
-- Description: 기존 회원들의 포인트를 points 테이블에 초기 레코드로 생성 (승인 완료 상태)

-- 일반 포인트가 있는 회원들의 레코드 생성
INSERT INTO points (
  customer_id,
  user_id,
  amount,
  type,
  category,
  status,
  note,
  created_at
)
SELECT
  c.id AS customer_id,
  (SELECT id FROM users WHERE role = 'ceo' ORDER BY created_at ASC LIMIT 1) AS user_id,
  c.total_point_general AS amount,
  'charge' AS type,
  'general' AS category,
  'approved' AS status,
  '시스템 소급 적용: 기존 일반 포인트 잔액' AS note,
  c.created_at
FROM customers c
WHERE c.total_point_general > 0
  AND NOT EXISTS (
    SELECT 1 FROM points p
    WHERE p.customer_id = c.id
      AND p.category = 'general'
      AND p.note LIKE '%시스템 소급 적용%'
  );

-- 베팅 포인트가 있는 회원들의 레코드 생성
INSERT INTO points (
  customer_id,
  user_id,
  amount,
  type,
  category,
  status,
  note,
  created_at
)
SELECT
  c.id AS customer_id,
  (SELECT id FROM users WHERE role = 'ceo' ORDER BY created_at ASC LIMIT 1) AS user_id,
  c.total_point_betting AS amount,
  'charge' AS type,
  'betting' AS category,
  'approved' AS status,
  '시스템 소급 적용: 기존 베팅 포인트 잔액' AS note,
  c.created_at
FROM customers c
WHERE c.total_point_betting > 0
  AND NOT EXISTS (
    SELECT 1 FROM points p
    WHERE p.customer_id = c.id
      AND p.category = 'betting'
      AND p.note LIKE '%시스템 소급 적용%'
  );

-- 실행 결과 확인
SELECT 'Backfill completed successfully' AS status;
