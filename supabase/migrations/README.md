# Supabase RPC 함수 마이그레이션 가이드

## 개요

이 디렉토리에는 엑시트컴퍼니 시스템의 금융 트랜잭션 안전성을 보장하기 위한 PostgreSQL RPC (Remote Procedure Call) 함수들이 포함되어 있습니다.

## 마이그레이션 적용 방법

### 방법 1: Supabase Dashboard 사용

1. Supabase 프로젝트 대시보드 접속
2. 좌측 메뉴에서 `SQL Editor` 선택
3. `20260128_rpc_functions.sql` 파일의 내용을 복사
4. 에디터에 붙여넣기
5. `Run` 버튼 클릭하여 실행

### 방법 2: Supabase CLI 사용

```bash
# Supabase CLI 설치 (미설치 시)
npm install -g supabase

# 프로젝트 링크
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

### 방법 3: 로컬 개발 환경

```bash
# 로컬 Supabase 시작
supabase start

# 마이그레이션 적용
supabase db reset

# 또는 특정 파일만 실행
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/20260128_rpc_functions.sql
```

## 포함된 RPC 함수 목록

### 1. `charge_points` - 포인트 충전
회원의 일반 또는 베팅 포인트를 안전하게 충전합니다.

**파라미터:**
- `p_customer_id`: 회원 UUID
- `p_amount`: 충전 금액
- `p_category`: 'general' 또는 'betting'
- `p_charged_by`: 충전 담당자 UUID
- `p_note`: 메모 (선택)

**반환값:** JSON (success, transaction_id, new_balance 등)

### 2. `deduct_points` - 포인트 차감
회원의 포인트를 차감합니다. 잔액 부족 시 자동 실패.

**파라미터:**
- `p_customer_id`: 회원 UUID
- `p_amount`: 차감 금액
- `p_category`: 'general' 또는 'betting'
- `p_deducted_by`: 차감 담당자 UUID
- `p_note`: 메모 (선택)

### 3. `settle_betting` - 배팅 정산
개별 배팅의 당첨/낙첨을 처리합니다.

**파라미터:**
- `p_task_item_id`: 배팅 아이템 UUID
- `p_is_win`: 당첨 여부 (boolean)
- `p_payout`: 지급 금액 (당첨 시)
- `p_settled_by`: 정산 담당자 UUID

### 4. `approve_task_with_deduction` - 티켓 승인 및 포인트 차감
티켓 승인과 동시에 필요 시 포인트를 차감합니다.

**파라미터:**
- `p_task_id`: 티켓 UUID
- `p_approved_by`: 승인자 UUID
- `p_deduct_amount`: 차감 금액 (선택, 기본 0)
- `p_category`: 포인트 카테고리 (선택, 기본 'general')

### 5. `process_refund` - 환불 처리
배팅 또는 거래를 취소하고 포인트를 환불합니다.

**파라미터:**
- `p_task_item_id`: 아이템 UUID
- `p_refund_amount`: 환불 금액
- `p_category`: 'general' 또는 'betting'
- `p_processed_by`: 처리자 UUID
- `p_reason`: 환불 사유 (선택)

### 6. `bulk_settle_betting` - 일괄 배팅 정산
한 경기의 모든 배팅을 한 번에 정산합니다.

**파라미터:**
- `p_match_id`: 경기 UUID
- `p_winning_choice`: 'home', 'away', 'draw'
- `p_settled_by`: 정산 담당자 UUID

**반환값:** 일괄 정산 통계 (총 배팅 수, 당첨 수, 총 지급액 등)

## 사용 예제

### TypeScript/JavaScript 예제

```typescript
import { createClient } from '@/lib/supabase/server'
import { chargePoints, settleBetting } from '@/lib/rpc-transactions'

// 포인트 충전
const supabase = await createClient()
const result = await chargePoints(supabase, {
  customerId: 'customer-uuid',
  amount: 50000,
  category: 'general',
  chargedBy: 'admin-uuid',
  note: '관리자 수동 충전'
})

if (result.success) {
  console.log('충전 완료:', result.new_balance)
} else {
  console.error('충전 실패:', result.error)
}

// 배팅 정산
const settleResult = await settleBetting(supabase, {
  taskItemId: 'task-item-uuid',
  isWin: true,
  payout: 100000,
  settledBy: 'operator-uuid'
})
```

### 직접 RPC 호출 (Supabase Client)

```typescript
const { data, error } = await supabase.rpc('charge_points', {
  p_customer_id: 'customer-uuid',
  p_amount: 50000,
  p_category: 'general',
  p_charged_by: 'admin-uuid',
  p_note: '충전'
})

if (error) {
  console.error('오류:', error.message)
} else {
  console.log('결과:', data)
}
```

## 트랜잭션 안전성

모든 RPC 함수는 다음을 보장합니다:

1. **원자성 (Atomicity)**: 모든 작업이 성공하거나 모두 실패
2. **일관성 (Consistency)**: 잔액 부족 시 자동 실패
3. **격리성 (Isolation)**: `FOR UPDATE` 락을 사용하여 동시성 제어
4. **지속성 (Durability)**: 커밋된 트랜잭션은 영구 저장

### 동시성 처리

여러 요청이 동시에 같은 회원의 포인트를 변경하려 할 때:
- `FOR UPDATE` 락이 자동으로 대기열을 생성
- 한 번에 하나의 트랜잭션만 처리
- 데이터 무결성 보장

## point_history 테이블

모든 포인트 변동은 `point_history` 테이블에 자동 기록됩니다.

**컬럼:**
- `id`: 이력 UUID
- `customer_id`: 회원 UUID
- `amount`: 변동 금액 (양수: 충전/당첨/환불, 음수: 차감)
- `type`: 변동 유형 ('charge', 'deduct', 'win', 'refund')
- `category`: 포인트 카테고리 ('general', 'betting')
- `balance_after`: 변동 후 잔액
- `performed_by`: 처리자 UUID
- `note`: 메모
- `created_at`: 생성 시간

**조회 예제:**
```sql
-- 특정 회원의 이력
SELECT * FROM point_history
WHERE customer_id = 'customer-uuid'
ORDER BY created_at DESC
LIMIT 50;

-- 오늘의 모든 충전 내역
SELECT ph.*, c.name, c.member_number
FROM point_history ph
JOIN customers c ON ph.customer_id = c.id
WHERE ph.type = 'charge'
  AND ph.created_at >= CURRENT_DATE
ORDER BY ph.created_at DESC;
```

## 보안 설정

### RLS (Row Level Security)

- `point_history` 테이블은 RLS 활성화
- 인증된 사용자는 조회만 가능
- 삽입은 RPC 함수(service_role)만 가능

### 함수 권한

- 모든 RPC 함수는 `SECURITY DEFINER` 모드
- 서비스 역할로 실행되어 RLS 우회
- API 계층에서 권한 체크 필수

## 마이그레이션 롤백

문제 발생 시 롤백 방법:

```sql
-- RPC 함수 삭제
DROP FUNCTION IF EXISTS charge_points CASCADE;
DROP FUNCTION IF EXISTS deduct_points CASCADE;
DROP FUNCTION IF EXISTS settle_betting CASCADE;
DROP FUNCTION IF EXISTS approve_task_with_deduction CASCADE;
DROP FUNCTION IF EXISTS process_refund CASCADE;
DROP FUNCTION IF EXISTS bulk_settle_betting CASCADE;

-- point_history 테이블 삭제 (주의: 데이터 손실)
DROP TABLE IF EXISTS point_history CASCADE;
```

## 문제 해결

### 함수 실행 오류

**증상:** RPC 함수 호출 시 오류 발생

**해결:**
1. 함수가 정상적으로 생성되었는지 확인:
   ```sql
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name LIKE '%point%';
   ```

2. 함수 재생성:
   ```sql
   -- 전체 마이그레이션 파일 재실행
   ```

### 권한 오류

**증상:** "permission denied" 오류

**해결:**
- Supabase 서비스 역할 키 사용 확인
- RLS 정책 확인
- 함수의 `SECURITY DEFINER` 설정 확인

### 잔액 부족 오류

**증상:** "잔액이 부족합니다" 오류

**해결:**
- 정상 작동입니다. 트랜잭션 안전성이 작동 중
- 회원 잔액 확인 후 재시도

## 모니터링

### 성능 모니터링

```sql
-- 가장 많이 사용된 RPC 함수
SELECT calls, total_time, mean_time, query
FROM pg_stat_statements
WHERE query LIKE '%charge_points%'
   OR query LIKE '%settle_betting%'
ORDER BY calls DESC;

-- 포인트 이력 통계
SELECT
  type,
  category,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM point_history
WHERE created_at >= CURRENT_DATE
GROUP BY type, category;
```

## 최신 마이그레이션

### `20260128_add_note_to_points.sql` - points 테이블에 note 컬럼 추가

**내용:**
- `points` 테이블에 `note TEXT` 컬럼 추가
- 포인트 지급/차감 시 메모를 기록할 수 있도록 개선

**적용 방법:**
```bash
# Supabase Dashboard SQL Editor에서 실행
# 또는
supabase db execute --file supabase/migrations/20260128_add_note_to_points.sql
```

**적용 후 작업:**
- `src/components/member-unified-view.tsx` 파일에서 note 필드 주석 제거
- 포인트 지급 다이얼로그에서 메모 입력 가능

## 다음 단계

1. [ ] `20260128_add_note_to_points.sql` 마이그레이션 적용
2. [ ] 프로덕션 환경에 마이그레이션 적용
3. [ ] 기존 포인트 충전/차감 API를 RPC 함수로 교체
4. [ ] 배팅 정산 로직을 RPC 함수로 교체
5. [ ] 포인트 이력 조회 UI 구현
6. [ ] 모니터링 대시보드 추가

## 참고 자료

- [Supabase RPC 함수 문서](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL 트랜잭션 가이드](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
