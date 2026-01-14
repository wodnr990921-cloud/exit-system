# 백엔드 API 구현 가이드

## 목차
1. [수용자 관리 API](#1-수용자-관리-api)
2. [블랙리스트 API](#2-블랙리스트-api)
3. [정산 시스템 API](#3-정산-시스템-api)
4. [감사 로그 API](#4-감사-로그-api)
5. [재고 관리 API](#5-재고-관리-api)
6. [문서 파기 API](#6-문서-파기-api)
7. [반송 처리 API](#7-반송-처리-api)
8. [시스템 설정 API](#8-시스템-설정-api)
9. [휴면 계정 API](#9-휴면-계정-api)
10. [포인트 거래 취소 API](#10-포인트-거래-취소-api)

---

## 1. 수용자 관리 API

### GET /api/inmates
수용자 목록 조회
```typescript
// Query Parameters
interface InmatesQuery {
  page?: number;
  limit?: number;
  prison?: string;
  is_released?: boolean;
  search?: string; // 이름 또는 수용번호
}

// Response
interface InmatesResponse {
  data: Inmate[];
  total: number;
  page: number;
  limit: number;
}
```

```sql
-- SQL Query
SELECT
  i.*,
  c.name as customer_name,
  c.member_number
FROM inmates i
LEFT JOIN customers c ON c.id = i.customer_id
WHERE ($1::VARCHAR IS NULL OR i.current_prison = $1)
  AND ($2::BOOLEAN IS NULL OR i.is_released = $2)
  AND ($3::VARCHAR IS NULL OR i.name ILIKE '%' || $3 || '%' OR i.prison_number ILIKE '%' || $3 || '%')
ORDER BY i.created_at DESC
LIMIT $4 OFFSET $5;
```

### GET /api/inmates/:id
수용자 상세 조회
```sql
SELECT
  i.*,
  c.name as customer_name,
  c.member_number,
  c.phone
FROM inmates i
LEFT JOIN customers c ON c.id = i.customer_id
WHERE i.id = $1;
```

### POST /api/inmates
수용자 등록
```typescript
interface CreateInmateRequest {
  name: string;
  prison_number?: string;
  current_prison: string;
  release_date?: string;
  customer_id?: string;
}
```

```sql
INSERT INTO inmates (name, prison_number, current_prison, release_date, customer_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
```

### PUT /api/inmates/:id
수용자 정보 수정
```sql
UPDATE inmates
SET name = COALESCE($1, name),
    prison_number = COALESCE($2, prison_number),
    current_prison = COALESCE($3, current_prison),
    release_date = COALESCE($4, release_date),
    is_released = COALESCE($5, is_released),
    updated_at = NOW()
WHERE id = $6
RETURNING *;
```

### DELETE /api/inmates/:id
수용자 삭제
```sql
DELETE FROM inmates WHERE id = $1;
```

### GET /api/prison-restrictions
교도소 금지 물품 조회
```sql
SELECT * FROM prison_restrictions
ORDER BY prison_name;
```

### POST /api/prison-restrictions/check
금지 물품 확인
```typescript
interface CheckRestrictedRequest {
  prison_name: string;
  items: string[];
}
```

```sql
SELECT * FROM check_restricted_items($1, $2);
```

---

## 2. 블랙리스트 API

### GET /api/customer-flags
고객 플래그 목록 조회
```typescript
interface FlagsQuery {
  customer_id?: string;
  flag_type?: 'blacklist' | 'warning' | 'vip';
  is_active?: boolean;
  page?: number;
  limit?: number;
}
```

```sql
SELECT
  cf.*,
  c.name as customer_name,
  c.member_number,
  u.name as flagged_by_name
FROM customer_flags cf
JOIN customers c ON c.id = cf.customer_id
LEFT JOIN users u ON u.id = cf.flagged_by
WHERE ($1::UUID IS NULL OR cf.customer_id = $1)
  AND ($2::VARCHAR IS NULL OR cf.flag_type = $2)
  AND ($3::BOOLEAN IS NULL OR cf.is_active = $3)
ORDER BY cf.flagged_at DESC
LIMIT $4 OFFSET $5;
```

### POST /api/customer-flags
고객 플래그 추가
```typescript
interface CreateFlagRequest {
  customer_id: string;
  flag_type: 'blacklist' | 'warning' | 'vip';
  reason?: string;
  flagged_by: string; // 현재 사용자 ID
}
```

```sql
INSERT INTO customer_flags (customer_id, flag_type, reason, flagged_by)
VALUES ($1, $2, $3, $4)
RETURNING *;
```

### PUT /api/customer-flags/:id
플래그 수정
```sql
UPDATE customer_flags
SET flag_type = COALESCE($1, flag_type),
    reason = COALESCE($2, reason),
    is_active = COALESCE($3, is_active)
WHERE id = $4
RETURNING *;
```

### DELETE /api/customer-flags/:id
플래그 비활성화
```sql
UPDATE customer_flags
SET is_active = false
WHERE id = $1;
```

### GET /api/customers/:id/flags
특정 고객의 플래그 조회
```sql
SELECT
  cf.*,
  u.name as flagged_by_name
FROM customer_flags cf
LEFT JOIN users u ON u.id = cf.flagged_by
WHERE cf.customer_id = $1
  AND cf.is_active = true
ORDER BY cf.flagged_at DESC;
```

---

## 3. 정산 시스템 API

### GET /api/settlements
월별 정산 목록 조회
```sql
SELECT
  ms.*,
  u.name as settled_by_name
FROM monthly_settlements ms
LEFT JOIN users u ON u.id = ms.settled_by
ORDER BY ms.year DESC, ms.month DESC
LIMIT $1 OFFSET $2;
```

### GET /api/settlements/:year/:month
특정 월 정산 조회
```sql
SELECT * FROM monthly_settlements
WHERE year = $1 AND month = $2;
```

### POST /api/settlements/calculate
월별 정산 실행
```typescript
interface CalculateSettlementRequest {
  year: number;
  month: number;
  settled_by: string; // 현재 사용자 ID
}
```

```sql
SELECT calculate_monthly_settlement($1, $2, $3);
```

### GET /api/settlements/:year/:month/details
정산 상세 내역 조회
```sql
SELECT
  t.ticket_no,
  t.created_at,
  c.name as customer_name,
  ti.description,
  ti.cost_price,
  ti.selling_price,
  ti.shipping_cost,
  (ti.selling_price - ti.cost_price - ti.shipping_cost) as profit,
  u.name as assigned_to_name
FROM task_items ti
JOIN tasks t ON t.id = ti.task_id
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN users u ON u.id = t.assigned_to
WHERE EXTRACT(YEAR FROM t.created_at) = $1
  AND EXTRACT(MONTH FROM t.created_at) = $2
  AND t.status = 'completed'
ORDER BY t.created_at DESC;
```

### GET /api/settlements/dashboard
정산 대시보드 (현재 월 통계)
```sql
WITH current_month AS (
  SELECT
    COALESCE(SUM(ti.selling_price), 0) as revenue,
    COALESCE(SUM(ti.cost_price), 0) as cost,
    COALESCE(SUM(ti.shipping_cost), 0) as shipping,
    COUNT(DISTINCT t.id) as task_count
  FROM task_items ti
  JOIN tasks t ON t.id = ti.task_id
  WHERE EXTRACT(YEAR FROM t.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND EXTRACT(MONTH FROM t.created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND t.status = 'completed'
),
last_month AS (
  SELECT net_profit
  FROM monthly_settlements
  WHERE year = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')
    AND month = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')
)
SELECT
  cm.revenue,
  cm.cost,
  cm.shipping,
  (cm.revenue - cm.cost - cm.shipping) as profit,
  cm.task_count,
  lm.net_profit as last_month_profit
FROM current_month cm
CROSS JOIN last_month lm;
```

---

## 4. 감사 로그 API

### GET /api/audit-logs
감사 로그 조회
```typescript
interface AuditLogsQuery {
  user_id?: string;
  action?: string;
  table_name?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}
```

```sql
SELECT
  al.*,
  u.name as user_name,
  u.email as user_email
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE ($1::UUID IS NULL OR al.user_id = $1)
  AND ($2::VARCHAR IS NULL OR al.action = $2)
  AND ($3::VARCHAR IS NULL OR al.table_name = $3)
  AND ($4::TIMESTAMP IS NULL OR al.created_at >= $4)
  AND ($5::TIMESTAMP IS NULL OR al.created_at <= $5)
ORDER BY al.created_at DESC
LIMIT $6 OFFSET $7;
```

### POST /api/audit-logs
감사 로그 기록
```typescript
interface CreateAuditLogRequest {
  user_id: string;
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  table_name: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
}
```

```sql
SELECT log_audit($1, $2, $3, $4, $5, $6, $7);
```

### GET /api/audit-logs/stats
감사 로그 통계
```sql
SELECT
  action,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM audit_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY action
ORDER BY count DESC;
```

---

## 5. 재고 관리 API

### GET /api/inventory/items
재고 항목 목록 조회
```sql
SELECT
  *,
  CASE
    WHEN current_quantity < min_quantity THEN 'low'
    WHEN current_quantity = 0 THEN 'out'
    ELSE 'normal'
  END as status
FROM inventory_items
ORDER BY item_name;
```

### GET /api/inventory/items/:id
재고 항목 상세 조회
```sql
SELECT * FROM inventory_items WHERE id = $1;
```

### POST /api/inventory/items
재고 항목 생성
```typescript
interface CreateInventoryItemRequest {
  item_name: string;
  item_type: 'stamp' | 'envelope' | 'paper' | 'label' | 'other';
  current_quantity?: number;
  min_quantity?: number;
  unit?: string;
}
```

```sql
INSERT INTO inventory_items (item_name, item_type, current_quantity, min_quantity, unit)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
```

### PUT /api/inventory/items/:id
재고 항목 수정
```sql
UPDATE inventory_items
SET item_name = COALESCE($1, item_name),
    item_type = COALESCE($2, item_type),
    min_quantity = COALESCE($3, min_quantity),
    unit = COALESCE($4, unit),
    updated_at = NOW()
WHERE id = $5
RETURNING *;
```

### POST /api/inventory/items/:id/use
재고 사용
```typescript
interface UseInventoryRequest {
  quantity: number;
  user_id: string;
  notes?: string;
}
```

```sql
SELECT use_inventory_item($1, $2, $3, $4);
```

### POST /api/inventory/items/:id/restock
재고 입고
```sql
BEGIN;

UPDATE inventory_items
SET current_quantity = current_quantity + $1,
    last_restocked_at = NOW(),
    updated_at = NOW()
WHERE id = $2;

INSERT INTO inventory_transactions (item_id, quantity_change, transaction_type, notes, user_id)
VALUES ($2, $1, 'restock', $3, $4);

COMMIT;
```

### GET /api/inventory/transactions
재고 거래 내역
```sql
SELECT
  it.*,
  ii.item_name,
  u.name as user_name
FROM inventory_transactions it
JOIN inventory_items ii ON ii.id = it.item_id
LEFT JOIN users u ON u.id = it.user_id
ORDER BY it.created_at DESC
LIMIT $1 OFFSET $2;
```

### GET /api/inventory/low-stock
재고 부족 알림
```sql
SELECT
  *,
  min_quantity - current_quantity as shortage
FROM inventory_items
WHERE current_quantity < min_quantity
ORDER BY (current_quantity::FLOAT / NULLIF(min_quantity, 0)) ASC;
```

---

## 6. 문서 파기 API

### GET /api/document-retention
문서 보관 목록 조회
```typescript
interface DocumentRetentionQuery {
  is_destroyed?: boolean;
  days_until_destruction?: number; // 파기까지 남은 일수
  page?: number;
  limit?: number;
}
```

```sql
SELECT
  dr.*,
  l.file_name,
  l.file_url,
  t.ticket_no,
  c.name as customer_name,
  (dr.scheduled_destruction_date - CURRENT_DATE) as days_remaining
FROM document_retention dr
JOIN letters l ON l.id = dr.letter_id
LEFT JOIN tasks t ON t.letter_id = l.id
LEFT JOIN customers c ON c.id = t.customer_id
WHERE ($1::BOOLEAN IS NULL OR dr.is_destroyed = $1)
  AND ($2::INTEGER IS NULL OR (dr.scheduled_destruction_date - CURRENT_DATE) <= $2)
ORDER BY dr.scheduled_destruction_date ASC
LIMIT $3 OFFSET $4;
```

### GET /api/document-retention/due
파기 예정 문서 (7일 이내)
```sql
SELECT
  dr.*,
  l.file_name,
  t.ticket_no,
  c.name as customer_name
FROM document_retention dr
JOIN letters l ON l.id = dr.letter_id
LEFT JOIN tasks t ON t.letter_id = l.id
LEFT JOIN customers c ON c.id = t.customer_id
WHERE dr.is_destroyed = false
  AND dr.scheduled_destruction_date <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY dr.scheduled_destruction_date ASC;
```

### POST /api/document-retention/:id/destroy
문서 파기 실행
```typescript
interface DestroyDocumentRequest {
  destroyed_by: string;
  destruction_notes?: string;
}
```

```sql
UPDATE document_retention
SET is_destroyed = true,
    destroyed_at = NOW(),
    destroyed_by = $1,
    destruction_notes = $2
WHERE id = $3
RETURNING *;
```

### PUT /api/document-retention/:id/extend
보관 기간 연장
```typescript
interface ExtendRetentionRequest {
  additional_days: number;
}
```

```sql
UPDATE document_retention
SET scheduled_destruction_date = scheduled_destruction_date + ($1 || ' days')::INTERVAL,
    retention_days = retention_days + $1
WHERE id = $2
RETURNING *;
```

---

## 7. 반송 처리 API

### GET /api/returns
반송 목록 조회
```typescript
interface ReturnsQuery {
  status?: 'pending' | 'resend' | 'disposed';
  return_reason?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}
```

```sql
SELECT
  r.*,
  t.ticket_no,
  c.name as customer_name,
  u.name as handler_name
FROM returns r
JOIN tasks t ON t.id = r.task_id
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN users u ON u.id = r.handled_by
WHERE ($1::VARCHAR IS NULL OR r.status = $1)
  AND ($2::VARCHAR IS NULL OR r.return_reason = $2)
  AND ($3::DATE IS NULL OR r.return_date >= $3)
  AND ($4::DATE IS NULL OR r.return_date <= $4)
ORDER BY r.return_date DESC
LIMIT $5 OFFSET $6;
```

### GET /api/returns/:id
반송 상세 조회
```sql
SELECT
  r.*,
  t.*,
  c.name as customer_name,
  u.name as handler_name
FROM returns r
JOIN tasks t ON t.id = r.task_id
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN users u ON u.id = r.handled_by
WHERE r.id = $1;
```

### POST /api/returns
반송 등록
```typescript
interface CreateReturnRequest {
  task_id: string;
  return_reason: '이감' | '출소' | '수취인불명' | '금지물품' | '기타';
  return_date?: string;
  notes?: string;
  handled_by: string;
}
```

```sql
INSERT INTO returns (task_id, return_reason, return_date, notes, handled_by)
VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
RETURNING *;
```

### PUT /api/returns/:id
반송 처리 (재발송/폐기)
```typescript
interface UpdateReturnRequest {
  status: 'resend' | 'disposed';
  resend_cost?: number;
  notes?: string;
}
```

```sql
UPDATE returns
SET status = $1,
    resend_cost = COALESCE($2, resend_cost),
    notes = COALESCE($3, notes),
    updated_at = NOW()
WHERE id = $4
RETURNING *;
```

### GET /api/returns/stats
반송 통계
```sql
SELECT
  return_reason,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'resend') as resend_count,
  COUNT(*) FILTER (WHERE status = 'disposed') as disposed_count
FROM returns
WHERE return_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY return_reason
ORDER BY count DESC;
```

---

## 8. 시스템 설정 API

### GET /api/config
전체 설정 조회
```sql
SELECT * FROM system_config
ORDER BY config_key;
```

### GET /api/config/:key
특정 설정 조회
```sql
SELECT get_config($1);
```

### PUT /api/config/:key
설정 수정
```typescript
interface UpdateConfigRequest {
  config_value: string;
  updated_by: string;
}
```

```sql
UPDATE system_config
SET config_value = $1,
    updated_by = $2,
    updated_at = NOW()
WHERE config_key = $3
RETURNING *;
```

### POST /api/config
새 설정 추가
```typescript
interface CreateConfigRequest {
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  updated_by: string;
}
```

```sql
INSERT INTO system_config (config_key, config_value, config_type, description, updated_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;
```

---

## 9. 휴면 계정 API

### GET /api/dormant/candidates
휴면 계정 후보 조회
```sql
SELECT
  c.id,
  c.name,
  c.member_number,
  c.total_point_general + c.total_point_betting as total_points,
  MAX(COALESCE(p.created_at, c.created_at)) as last_activity,
  CURRENT_DATE - MAX(COALESCE(p.created_at, c.created_at))::DATE as days_inactive
FROM customers c
LEFT JOIN points p ON p.customer_id = c.id
WHERE c.id NOT IN (SELECT customer_id FROM dormant_points WHERE customer_id IS NOT NULL)
GROUP BY c.id, c.name, c.member_number, c.total_point_general, c.total_point_betting
HAVING CURRENT_DATE - MAX(COALESCE(p.created_at, c.created_at))::DATE > 365
  AND (c.total_point_general + c.total_point_betting) > 0
ORDER BY last_activity ASC;
```

### POST /api/dormant/confiscate
휴면 포인트 회수 실행
```sql
SELECT * FROM confiscate_dormant_points();
```

### GET /api/dormant/history
휴면 포인트 회수 내역
```sql
SELECT
  dp.*,
  c.name,
  c.member_number
FROM dormant_points dp
JOIN customers c ON c.id = dp.customer_id
ORDER BY dp.confiscated_at DESC
LIMIT $1 OFFSET $2;
```

---

## 10. 포인트 거래 취소 API

### POST /api/points/:id/reverse
포인트 거래 취소
```typescript
interface ReversePointRequest {
  reversal_reason: string;
  reversed_by: string; // 현재 사용자 ID
}
```

```sql
SELECT reverse_point_transaction($1, $2, $3);
```

### GET /api/points/:id/reversal-history
취소 거래 내역 조회
```sql
SELECT
  p.*,
  c.name as customer_name,
  u1.name as requested_by_name,
  u2.name as reversed_by_name
FROM points p
LEFT JOIN customers c ON c.id = p.customer_id
LEFT JOIN users u1 ON u1.id = p.requested_by
LEFT JOIN users u2 ON u2.id = p.reversed_by
WHERE p.original_transaction_id = $1 OR p.id = $1
ORDER BY p.created_at;
```

### GET /api/points/reversed
취소된 거래 목록
```sql
SELECT
  p.*,
  c.name as customer_name,
  u.name as reversed_by_name
FROM points p
LEFT JOIN customers c ON c.id = p.customer_id
LEFT JOIN users u ON u.id = p.reversed_by
WHERE p.is_reversed = true
ORDER BY p.reversed_at DESC
LIMIT $1 OFFSET $2;
```

---

## 공통 미들웨어

### 1. 감사 로그 미들웨어
모든 중요 API 호출에 대해 자동으로 감사 로그 기록

```typescript
async function auditLogMiddleware(req, res, next) {
  const originalJson = res.json;

  res.json = function(data) {
    // 성공한 경우에만 로그 기록
    if (res.statusCode < 400) {
      const action = req.method === 'GET' ? 'SELECT' :
                     req.method === 'POST' ? 'INSERT' :
                     req.method === 'PUT' ? 'UPDATE' :
                     req.method === 'DELETE' ? 'DELETE' : 'UNKNOWN';

      // 비동기로 로그 기록 (응답 지연 방지)
      logAudit({
        user_id: req.user.id,
        action,
        table_name: extractTableName(req.path),
        record_id: req.params.id,
        new_values: req.body,
        ip_address: req.ip
      }).catch(console.error);
    }

    return originalJson.call(this, data);
  };

  next();
}
```

### 2. 권한 확인 미들웨어
```typescript
function requireRole(...roles: string[]) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

// 사용 예시
app.post('/api/dormant/confiscate', requireRole('ceo', 'admin'), ...);
app.delete('/api/inmates/:id', requireRole('ceo', 'admin'), ...);
```

### 3. 에러 핸들링 미들웨어
```typescript
function errorHandler(err, req, res, next) {
  console.error(err);

  // PostgreSQL 에러 코드
  if (err.code === '23505') {
    return res.status(409).json({ error: '중복된 데이터입니다.' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: '참조 무결성 오류입니다.' });
  }

  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
}
```

---

## 스케줄러 (Cron Jobs)

### 1. 휴면 계정 포인트 회수 (월 1회)
```typescript
// 매월 1일 오전 3시 실행
cron.schedule('0 3 1 * *', async () => {
  try {
    const result = await supabase.rpc('confiscate_dormant_points');
    console.log(`휴면 포인트 회수 완료: ${result.data.length}건`);

    // 관리자에게 알림
    await sendNotification({
      type: 'dormant_points_confiscated',
      count: result.data.length
    });
  } catch (error) {
    console.error('휴면 포인트 회수 실패:', error);
  }
});
```

### 2. 문서 파기 알림 (매일)
```typescript
// 매일 오전 9시 실행
cron.schedule('0 9 * * *', async () => {
  try {
    const { data } = await supabase
      .from('document_retention')
      .select('*, letters(*)')
      .eq('is_destroyed', false)
      .lte('scheduled_destruction_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('scheduled_destruction_date', { ascending: true });

    if (data && data.length > 0) {
      await sendNotification({
        type: 'documents_due_for_destruction',
        count: data.length,
        documents: data
      });
    }
  } catch (error) {
    console.error('문서 파기 알림 실패:', error);
  }
});
```

### 3. 재고 부족 알림 (매일)
```typescript
// 매일 오전 10시 실행
cron.schedule('0 10 * * *', async () => {
  try {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .lt('current_quantity', 'min_quantity');

    if (data && data.length > 0) {
      await sendNotification({
        type: 'low_inventory_alert',
        items: data
      });
    }
  } catch (error) {
    console.error('재고 부족 알림 실패:', error);
  }
});
```

---

## 응답 포맷 표준

### 성공 응답
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}
```

### 오류 응답
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}
```

### 페이지네이션 응답
```typescript
interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

## 환경 변수

```bash
# .env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# 스케줄러 설정
ENABLE_DORMANT_SCHEDULER=true
ENABLE_DOCUMENT_SCHEDULER=true
ENABLE_INVENTORY_SCHEDULER=true

# 알림 설정
ADMIN_EMAIL=admin@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx
```

---

## 보안 고려사항

1. **Row Level Security (RLS)** 활성화
   - 테이블별 적절한 RLS 정책 설정
   - 사용자 역할별 접근 제어

2. **API 키 보호**
   - Service Role Key는 백엔드에서만 사용
   - Anon Key는 프론트엔드에서 사용

3. **입력 검증**
   - 모든 사용자 입력 검증
   - SQL Injection 방지

4. **감사 로그**
   - 모든 중요 작업 로깅
   - IP 주소 기록

5. **권한 확인**
   - 민감한 작업은 관리자만 수행
   - 역할 기반 접근 제어 (RBAC)

---

## 테스트 체크리스트

- [ ] 각 API 엔드포인트 단위 테스트
- [ ] 권한 체크 테스트
- [ ] 에러 핸들링 테스트
- [ ] 페이지네이션 테스트
- [ ] 트랜잭션 롤백 테스트
- [ ] 동시성 테스트
- [ ] 성능 테스트 (대량 데이터)
- [ ] 스케줄러 테스트
- [ ] 감사 로그 기록 테스트

---

이 가이드를 기반으로 백엔드 API를 구현하면 데이터베이스 마이그레이션과 완벽하게 통합됩니다.
