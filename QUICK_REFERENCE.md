# 빠른 참조 가이드

## 새로운 테이블 (11개)

| 테이블명 | 용도 | 주요 컬럼 |
|---------|------|----------|
| **inmates** | 수용자 정보 | name, prison_number, current_prison, release_date |
| **prison_restrictions** | 교도소 금지물품 | prison_name, restricted_items[] |
| **customer_flags** | 고객 플래그 | customer_id, flag_type, is_active |
| **monthly_settlements** | 월별 정산 | year, month, total_revenue, net_profit |
| **audit_logs** | 감사 로그 | user_id, action, table_name, old/new_values |
| **inventory_items** | 재고 항목 | item_name, current_quantity, min_quantity |
| **inventory_transactions** | 재고 거래 | item_id, quantity_change, transaction_type |
| **document_retention** | 문서 보관 | letter_id, scheduled_destruction_date |
| **returns** | 반송 처리 | task_id, return_reason, status |
| **system_config** | 시스템 설정 | config_key, config_value, config_type |
| **dormant_points** | 휴면 포인트 | customer_id, confiscated_amount, dormant_since |

---

## 수정된 테이블 (2개)

### points 테이블
```sql
-- 추가된 컬럼:
is_reversed BOOLEAN
reversed_by UUID
reversed_at TIMESTAMP
reversal_reason TEXT
original_transaction_id UUID
```

### task_items 테이블
```sql
-- 추가된 컬럼:
cost_price INTEGER
selling_price INTEGER
shipping_cost INTEGER
```

---

## 주요 함수 (8개)

### 1. reverse_point_transaction()
```sql
-- 포인트 거래 취소
SELECT reverse_point_transaction(
  'transaction_id'::UUID,
  '취소 사유',
  'admin_id'::UUID
);

-- 반환: JSONB
{
  "success": true,
  "message": "거래가 취소되었습니다",
  "new_balance_general": 50000,
  "new_balance_betting": 10000
}
```

### 2. confiscate_dormant_points()
```sql
-- 휴면 계정 포인트 회수 (1년 미활동)
SELECT * FROM confiscate_dormant_points();

-- 반환: TABLE(customer_id, customer_name, confiscated_amount, dormant_since)
```

### 3. check_restricted_items()
```sql
-- 교도소 금지 물품 확인
SELECT * FROM check_restricted_items(
  '서울구치소',
  ARRAY['책', '담배', '라이터']
);

-- 반환: TABLE(is_restricted BOOLEAN, restricted_items TEXT[])
```

### 4. use_inventory_item()
```sql
-- 재고 사용 (차감)
SELECT use_inventory_item(
  'item_id'::UUID,
  10,  -- 수량
  'user_id'::UUID,
  '우편 발송'  -- 메모
);

-- 반환: JSONB
{
  "success": true,
  "new_quantity": 90,
  "needs_restock": false
}
```

### 5. log_audit()
```sql
-- 감사 로그 기록
SELECT log_audit(
  'user_id'::UUID,
  'UPDATE',
  'customers',
  'customer_id',
  '{"name": "홍길동"}'::JSONB,
  '{"name": "김철수"}'::JSONB,
  '192.168.1.1'
);

-- 반환: UUID (로그 ID)
```

### 6. get_config()
```sql
-- 시스템 설정 조회
SELECT get_config('stamp_price');  -- 반환: '430'
SELECT get_config('service_fee');  -- 반환: '500'
```

### 7. calculate_monthly_settlement()
```sql
-- 월별 정산 계산
SELECT calculate_monthly_settlement(
  2026,  -- 년도
  1,     -- 월
  'admin_id'::UUID
);

-- 반환: JSONB
{
  "success": true,
  "year": 2026,
  "month": 1,
  "total_revenue": 1000000,
  "total_cost": 600000,
  "total_shipping": 100000,
  "net_profit": 300000
}
```

### 8. auto_set_document_retention()
```sql
-- letters 테이블에 INSERT 시 자동 실행 (트리거)
-- 90일 후 파기 예정일 자동 설정
```

---

## 주요 트리거

| 트리거명 | 테이블 | 실행 시점 | 기능 |
|---------|--------|-----------|------|
| trigger_auto_set_document_retention | letters | INSERT 후 | 문서 파기 일정 자동 생성 |
| update_inmates_updated_at | inmates | UPDATE 전 | updated_at 자동 갱신 |
| update_prison_restrictions_updated_at | prison_restrictions | UPDATE 전 | updated_at 자동 갱신 |
| update_customer_flags_updated_at | customer_flags | UPDATE 전 | updated_at 자동 갱신 |
| update_inventory_items_updated_at | inventory_items | UPDATE 전 | updated_at 자동 갱신 |
| update_returns_updated_at | returns | UPDATE 전 | updated_at 자동 갱신 |
| update_system_config_updated_at | system_config | UPDATE 전 | updated_at 자동 갱신 |

---

## 데이터 타입 및 제약조건

### flag_type (customer_flags)
- `'blacklist'`: 블랙리스트
- `'warning'`: 경고
- `'vip'`: VIP 고객

### return_reason (returns)
- `'이감'`: 다른 교도소로 이동
- `'출소'`: 출소 완료
- `'수취인불명'`: 수취인을 찾을 수 없음
- `'금지물품'`: 금지된 물품 포함
- `'기타'`: 기타 사유

### return status (returns)
- `'pending'`: 반송 대기
- `'resend'`: 재발송
- `'disposed'`: 폐기

### item_type (inventory_items)
- `'stamp'`: 우표
- `'envelope'`: 봉투
- `'paper'`: 용지
- `'label'`: 라벨
- `'other'`: 기타

### transaction_type (inventory_transactions)
- `'restock'`: 입고
- `'use'`: 사용
- `'adjustment'`: 재고 조정

### config_type (system_config)
- `'string'`: 문자열
- `'number'`: 숫자
- `'boolean'`: 참/거짓
- `'json'`: JSON 객체

### audit action
- `'SELECT'`: 조회
- `'INSERT'`: 생성
- `'UPDATE'`: 수정
- `'DELETE'`: 삭제
- `'LOGIN'`: 로그인
- `'LOGOUT'`: 로그아웃

---

## 실전 시나리오

### 시나리오 1: 신규 수용자 등록
```sql
-- 1. 고객 조회
SELECT * FROM customers WHERE member_number = 'M2024001';

-- 2. 수용자 등록
INSERT INTO inmates (name, prison_number, current_prison, release_date, customer_id)
VALUES ('홍길동', 'P2024-001', '서울구치소', '2026-12-31', 'customer_id');

-- 3. 교도소 금지 물품 확인
SELECT * FROM prison_restrictions WHERE prison_name = '서울구치소';
```

### 시나리오 2: 블랙리스트 등록
```sql
-- 1. 고객 플래그 추가
INSERT INTO customer_flags (customer_id, flag_type, reason, flagged_by)
VALUES (
  'customer_id'::UUID,
  'blacklist',
  '허위 정보 제공',
  'admin_id'::UUID
);

-- 2. 플래그 조회
SELECT cf.*, c.name, c.member_number
FROM customer_flags cf
JOIN customers c ON c.id = cf.customer_id
WHERE cf.is_active = true AND cf.flag_type = 'blacklist';
```

### 시나리오 3: 월별 정산
```sql
-- 1. 정산 실행
SELECT calculate_monthly_settlement(2026, 1, 'admin_id'::UUID);

-- 2. 정산 결과 조회
SELECT * FROM monthly_settlements
WHERE year = 2026 AND month = 1;

-- 3. 상세 내역 조회
SELECT
  t.ticket_no,
  ti.description,
  ti.cost_price,
  ti.selling_price,
  ti.shipping_cost,
  (ti.selling_price - ti.cost_price - ti.shipping_cost) as profit
FROM task_items ti
JOIN tasks t ON t.id = ti.task_id
WHERE EXTRACT(YEAR FROM t.created_at) = 2026
  AND EXTRACT(MONTH FROM t.created_at) = 1
  AND t.status = 'completed';
```

### 시나리오 4: 포인트 거래 취소
```sql
-- 1. 거래 조회
SELECT * FROM points WHERE id = 'transaction_id';

-- 2. 거래 취소
SELECT reverse_point_transaction(
  'transaction_id'::UUID,
  '고객 요청으로 인한 취소',
  'admin_id'::UUID
);

-- 3. 취소 내역 확인
SELECT
  p1.*,
  p2.id as reversal_id
FROM points p1
LEFT JOIN points p2 ON p2.original_transaction_id = p1.id
WHERE p1.id = 'transaction_id';
```

### 시나리오 5: 재고 관리
```sql
-- 1. 재고 현황 조회
SELECT
  item_name,
  current_quantity,
  min_quantity,
  CASE
    WHEN current_quantity < min_quantity THEN '재고 부족'
    ELSE '정상'
  END as status
FROM inventory_items;

-- 2. 재고 입고
INSERT INTO inventory_transactions (item_id, quantity_change, transaction_type, notes, user_id)
VALUES ('item_id'::UUID, 100, 'restock', '우표 입고', 'user_id'::UUID);

UPDATE inventory_items
SET current_quantity = current_quantity + 100,
    last_restocked_at = NOW()
WHERE id = 'item_id'::UUID;

-- 3. 재고 사용
SELECT use_inventory_item('item_id'::UUID, 10, 'user_id'::UUID, '우편 발송');

-- 4. 재고 거래 내역
SELECT
  it.*,
  ii.item_name,
  u.name as user_name
FROM inventory_transactions it
JOIN inventory_items ii ON ii.id = it.item_id
LEFT JOIN users u ON u.id = it.user_id
ORDER BY it.created_at DESC
LIMIT 50;
```

### 시나리오 6: 반송 처리
```sql
-- 1. 반송 등록
INSERT INTO returns (task_id, return_reason, status, notes, handled_by)
VALUES (
  'task_id'::UUID,
  '이감',
  'pending',
  '대전교도소로 이감',
  'user_id'::UUID
);

-- 2. 반송 목록 조회
SELECT
  r.*,
  t.ticket_no,
  c.name as customer_name,
  u.name as handler_name
FROM returns r
JOIN tasks t ON t.id = r.task_id
JOIN customers c ON c.id = t.customer_id
LEFT JOIN users u ON u.id = r.handled_by
WHERE r.status = 'pending'
ORDER BY r.return_date DESC;

-- 3. 반송 처리 (재발송)
UPDATE returns
SET status = 'resend',
    resend_cost = 3000,
    notes = '새 주소로 재발송 완료'
WHERE id = 'return_id'::UUID;
```

### 시나리오 7: 휴면 계정 관리
```sql
-- 1. 휴면 계정 후보 조회
SELECT
  c.id,
  c.name,
  c.member_number,
  c.total_point_general + c.total_point_betting as total_points,
  MAX(COALESCE(p.created_at, c.created_at)) as last_activity,
  CURRENT_DATE - MAX(COALESCE(p.created_at, c.created_at))::DATE as days_inactive
FROM customers c
LEFT JOIN points p ON p.customer_id = c.id
GROUP BY c.id, c.name, c.member_number, c.total_point_general, c.total_point_betting
HAVING CURRENT_DATE - MAX(COALESCE(p.created_at, c.created_at))::DATE > 365
  AND (c.total_point_general + c.total_point_betting) > 0
ORDER BY last_activity ASC;

-- 2. 포인트 회수 실행
SELECT * FROM confiscate_dormant_points();

-- 3. 회수 내역 조회
SELECT
  dp.*,
  c.name,
  c.member_number
FROM dormant_points dp
JOIN customers c ON c.id = dp.customer_id
ORDER BY dp.confiscated_at DESC;
```

---

## 유용한 조회 쿼리

### 대시보드용 집계
```sql
-- 오늘의 통계
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
  COUNT(DISTINCT customer_id) as unique_customers,
  SUM(amount) FILTER (WHERE status = 'completed') as total_revenue
FROM tasks
WHERE DATE(created_at) = CURRENT_DATE;

-- 재고 부족 항목
SELECT * FROM inventory_items
WHERE current_quantity < min_quantity
ORDER BY (current_quantity::FLOAT / min_quantity) ASC;

-- 파기 예정 문서
SELECT
  dr.*,
  l.file_name,
  t.ticket_no
FROM document_retention dr
JOIN letters l ON l.id = dr.letter_id
LEFT JOIN tasks t ON t.letter_id = l.id
WHERE dr.is_destroyed = false
  AND dr.scheduled_destruction_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY dr.scheduled_destruction_date ASC;

-- 활성 블랙리스트
SELECT
  c.member_number,
  c.name,
  cf.flag_type,
  cf.reason,
  cf.flagged_at,
  u.name as flagged_by_name
FROM customer_flags cf
JOIN customers c ON c.id = cf.customer_id
LEFT JOIN users u ON u.id = cf.flagged_by
WHERE cf.is_active = true
  AND cf.flag_type IN ('blacklist', 'warning')
ORDER BY cf.flagged_at DESC;
```

---

## 성능 팁

1. **대량 데이터 조회 시 페이지네이션 사용**
```sql
-- LIMIT/OFFSET 사용
SELECT * FROM audit_logs
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

2. **날짜 범위 조회 시 인덱스 활용**
```sql
-- 인덱스가 있는 created_at 사용
SELECT * FROM audit_logs
WHERE created_at >= '2026-01-01'
  AND created_at < '2026-02-01'
ORDER BY created_at DESC;
```

3. **JSONB 검색**
```sql
-- 감사 로그에서 특정 변경 사항 검색
SELECT * FROM audit_logs
WHERE new_values->>'status' = 'completed';

SELECT * FROM audit_logs
WHERE new_values ? 'amount';  -- amount 키가 존재하는 경우
```

4. **배열 검색**
```sql
-- 금지 물품 검색
SELECT * FROM prison_restrictions
WHERE '담배' = ANY(restricted_items);
```

---

## 마이그레이션 체크리스트

- [ ] schema_migration_complete.sql 실행
- [ ] 검증 쿼리 실행 (파일 하단)
- [ ] 테이블 11개 생성 확인
- [ ] 컬럼 추가 확인 (points, task_items)
- [ ] 함수 8개 생성 확인
- [ ] 트리거 7개 생성 확인
- [ ] 인덱스 생성 확인
- [ ] 기본 데이터 삽입 확인 (system_config, inventory_items)
- [ ] 함수 테스트 실행
- [ ] RLS 정책 설정 (필요시)
- [ ] 백엔드 API 연동

---

## 문제 해결

### 외래 키 오류
```sql
-- 테이블 생성 순서가 중요합니다
-- customers, users, tasks, letters 테이블이 먼저 존재해야 함
-- 기존 schema.sql이 먼저 실행되어야 합니다
```

### 함수 실행 오류
```sql
-- 권한 확인
GRANT EXECUTE ON FUNCTION reverse_point_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION confiscate_dormant_points TO authenticated;
```

### 트리거 미작동
```sql
-- 트리거 확인
SELECT * FROM pg_trigger WHERE tgname LIKE '%document_retention%';

-- 트리거 재생성
DROP TRIGGER IF EXISTS trigger_auto_set_document_retention ON letters;
CREATE TRIGGER trigger_auto_set_document_retention
  AFTER INSERT ON letters
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_document_retention();
```

---

## 관련 파일
- `schema_migration_complete.sql` - 마이그레이션 파일 (1028줄)
- `MIGRATION_SUMMARY.md` - 상세 문서
- `QUICK_REFERENCE.md` - 이 파일
