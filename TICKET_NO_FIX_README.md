# Ticket Number Auto-Generation Fix 🎫

## 문제 상황

```
❌ Error: column reference "ticket_no" is ambiguous
```

이 오류는 다음과 같은 경우에 발생합니다:
1. `ticket_no` 컬럼이 자동 생성되지 않음
2. SQL 쿼리에서 여러 테이블을 조인할 때 테이블명을 명시하지 않음

---

## 해결 방법

### 1️⃣ Supabase SQL Editor에서 실행

```sql
-- fix_ticket_no_auto_generation.sql 파일의 내용을 복사하여 실행
```

**실행 순서:**
1. Supabase Dashboard → SQL Editor
2. `fix_ticket_no_auto_generation.sql` 내용 복사
3. "Run" 버튼 클릭
4. 성공 메시지 확인

---

## 📊 설정 내용

### ✅ 자동 생성되는 내용:

1. **ticket_no 컬럼**
   - 타입: `VARCHAR(50)`
   - UNIQUE constraint 적용
   - 자동 생성 트리거 설정

2. **생성 형식**
   ```
   YYMMDD-NNNN
   
   예시:
   - 260120-0001  (2026년 1월 20일의 첫 번째 티켓)
   - 260120-0002  (2026년 1월 20일의 두 번째 티켓)
   - 260121-0001  (2026년 1월 21일의 첫 번째 티켓)
   ```

3. **자동 생성 함수**
   - `generate_ticket_no()`: 새로운 티켓 번호 생성
   - `auto_generate_ticket_no()`: INSERT 시 자동 실행
   - 트리거: `trigger_auto_generate_ticket_no`

4. **기존 티켓 처리**
   - ticket_no가 없는 기존 티켓에 자동으로 번호 부여
   - 생성 순서대로 번호 할당

---

## 🔍 "ticket_no is ambiguous" 오류 해결

### ❌ 잘못된 SQL (오류 발생):

```sql
SELECT 
  ticket_no,
  customer_name
FROM tasks
JOIN customers ON tasks.customer_id = customers.id;
```

**문제:** `ticket_no`가 어느 테이블의 컬럼인지 불명확

### ✅ 올바른 SQL (오류 해결):

```sql
SELECT 
  tasks.ticket_no,           -- 테이블명 명시
  customers.name AS customer_name
FROM tasks
JOIN customers ON tasks.customer_id = customers.id;
```

**해결:** 테이블명을 명시하여 명확하게 지정

---

## 💡 사용 예시

### 새 티켓 생성:

```typescript
// ✅ ticket_no를 지정하지 않으면 자동 생성됨
const { data, error } = await supabase
  .from('tasks')
  .insert({
    customer_id: customerId,
    assigned_to: staffId,
    status: 'pending',
    // ticket_no는 자동으로 생성됨!
  })
  .select()
  .single()

// data.ticket_no → "260120-0001"
```

### 티켓 조회:

```typescript
// ✅ tasks.ticket_no로 명시
const { data, error } = await supabase
  .from('tasks')
  .select(`
    id,
    ticket_no,
    status,
    customer:customers!tasks_customer_id_fkey(
      name,
      member_number
    )
  `)
  .eq('status', 'pending')

// 결과:
// {
//   id: "...",
//   ticket_no: "260120-0001",
//   status: "pending",
//   customer: { name: "홍길동", member_number: "M001" }
// }
```

---

## 🧪 테스트 방법

### 1. 자동 생성 확인:

```sql
-- 새 티켓 생성 (ticket_no 없이)
INSERT INTO tasks (customer_id, status)
VALUES ('some-customer-id', 'pending');

-- ticket_no 자동 생성 확인
SELECT id, ticket_no, created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 1;

-- 결과: ticket_no가 "260120-0001" 형식으로 자동 생성됨
```

### 2. 번호 증가 확인:

```sql
-- 여러 티켓 생성
INSERT INTO tasks (customer_id, status)
SELECT 'some-customer-id', 'pending'
FROM generate_series(1, 5);

-- 순차 증가 확인
SELECT ticket_no, created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 5;

-- 결과:
-- 260120-0005
-- 260120-0004
-- 260120-0003
-- 260120-0002
-- 260120-0001
```

### 3. 날짜 변경 확인:

```sql
-- 다음 날 티켓 생성 시뮬레이션
SELECT generate_ticket_no();

-- 결과: "260121-0001" (날짜가 바뀌면 다시 0001부터 시작)
```

---

## 🔧 트러블슈팅

### 문제 1: "ticket_no already exists"

**원인:** UNIQUE constraint 위반

**해결:**
```sql
-- 중복 ticket_no 확인
SELECT ticket_no, COUNT(*)
FROM tasks
GROUP BY ticket_no
HAVING COUNT(*) > 1;

-- 중복 제거 (조심해서 사용!)
UPDATE tasks t1
SET ticket_no = generate_ticket_no()
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY ticket_no ORDER BY created_at) as rn
    FROM tasks
  ) t2 WHERE t2.rn > 1
);
```

### 문제 2: "function generate_ticket_no() does not exist"

**원인:** 함수가 생성되지 않음

**해결:**
```sql
-- fix_ticket_no_auto_generation.sql 파일을 다시 실행
```

### 문제 3: 트리거가 작동하지 않음

**원인:** 트리거가 비활성화되었거나 삭제됨

**해결:**
```sql
-- 트리거 상태 확인
SELECT * FROM pg_trigger WHERE tgname = 'trigger_auto_generate_ticket_no';

-- 트리거 재생성
DROP TRIGGER IF EXISTS trigger_auto_generate_ticket_no ON tasks;
CREATE TRIGGER trigger_auto_generate_ticket_no
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_ticket_no();
```

---

## 📊 통계 확인

```sql
-- 오늘 생성된 티켓 수
SELECT COUNT(*) as today_tickets
FROM tasks
WHERE ticket_no LIKE TO_CHAR(NOW(), 'YYMMDD') || '-%';

-- 티켓 번호 분포
SELECT 
  LEFT(ticket_no, 6) as date,
  COUNT(*) as count,
  MIN(ticket_no) as first_ticket,
  MAX(ticket_no) as last_ticket
FROM tasks
WHERE ticket_no IS NOT NULL
GROUP BY LEFT(ticket_no, 6)
ORDER BY date DESC
LIMIT 10;

-- ticket_no가 없는 티켓 확인
SELECT COUNT(*) as tickets_without_number
FROM tasks
WHERE ticket_no IS NULL;
```

---

## ✅ 완료 체크리스트

- [ ] `fix_ticket_no_auto_generation.sql` 실행 완료
- [ ] 기존 티켓에 ticket_no 부여 확인
- [ ] 새 티켓 생성 시 자동 생성 확인
- [ ] SQL 쿼리에서 `tasks.ticket_no` 형태로 명시
- [ ] "ticket_no is ambiguous" 오류 해결 확인

---

## 🚀 다음 단계

1. **코드 수정**: SQL 쿼리에서 `ticket_no` 사용 시 테이블명 명시
2. **테스트**: 새 티켓 생성 및 조회 테스트
3. **모니터링**: 티켓 번호 중복 발생 여부 확인

---

## 📞 추가 도움이 필요한 경우

"ticket_no is ambiguous" 오류가 발생한 정확한 위치(파일명, 라인 번호)를 알려주시면 해당 코드를 직접 수정해드리겠습니다!
