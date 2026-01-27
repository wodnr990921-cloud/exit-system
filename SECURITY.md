# 보안 개선 보고서 (Security Improvements Report)

## 개요

2026-01-28에 코드베이스 전체 보안 감사를 수행하여 여러 보안 취약점을 발견하고 즉시 수정했습니다.

---

## ✅ 즉시 수정된 문제들 (FIXED)

### 1. ✅ 노출된 API 키 제거 (CRITICAL)

**문제:**
- `.env.local` 파일에 실제 API 키들이 노출되어 있었음
- OpenAI API Key, Supabase Service Role Key 등

**수정:**
- `.env.local` 파일의 모든 실제 키를 예제 값으로 교체
- 경고 메시지 추가

**추가 조치 필요:**
```bash
# ⚠️ 긴급: 다음 플랫폼에서 노출된 키를 즉시 폐기하고 새로 발급받으세요:

1. OpenAI (https://platform.openai.com/api-keys)
   - 기존 키 삭제
   - 새 키 생성
   - 사용량 모니터링

2. Supabase (https://supabase.com/dashboard)
   - Service Role Key 재생성
   - Anon Key 재생성
   - 접근 로그 확인

3. Git History 정리 (선택사항)
   # 노출된 키가 커밋 히스토리에 남아있을 수 있음
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
```

---

### 2. ✅ 하드코딩된 마스터 패스워드를 환경 변수로 이동 (CRITICAL)

**문제:**
```typescript
// ❌ 하드코딩 (이전)
const ADMIN_CHEAT_CODE = "exitadmin2026"
const MASTER_PASSWORD = "master2026exit"
```

**수정:**
```typescript
// ✅ 환경 변수 사용 (현재)
const ADMIN_CHEAT_CODE = process.env.ADMIN_CHEAT_CODE || null
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || null
```

**환경 변수 설정:**
```bash
# .env.local에 추가 (개발 환경에서만)
MASTER_PASSWORD=master2026exit
ADMIN_CHEAT_CODE=exitadmin2026

# 프로덕션 환경에서는 비워두거나 제거
MASTER_PASSWORD=
ADMIN_CHEAT_CODE=
```

**권장사항:**
- 프로덕션 환경에서는 이 기능들을 완전히 비활성화
- 대신 proper password reset flow 구현
- Admin 계정에 MFA(Multi-Factor Authentication) 추가

---

### 3. ✅ XSS 취약점 수정 (HIGH)

**위치:** `src/components/notice-popup.tsx:162`

**문제:**
```tsx
// ❌ 위험: 사용자 입력 HTML 직접 렌더링
<div dangerouslySetInnerHTML={{ __html: currentNotice.content }} />
```

**수정:**
```tsx
// ✅ 안전: 텍스트로만 렌더링 (줄바꿈 유지)
<div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
  {currentNotice.content}
</div>
```

**향후 개선 (Rich Text 지원 필요시):**
```bash
# DOMPurify 설치
npm install dompurify @types/dompurify

# 사용 예시
import DOMPurify from 'dompurify'

<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(currentNotice.content)
  }}
/>
```

---

### 4. ✅ 누락된 API 인증 체크 추가 (HIGH)

**수정된 파일:**
- `src/app/api/summarize/route.ts` - 인증 추가
- `src/app/api/categorize/route.ts` - 인증 추가

**추가된 코드:**
```typescript
// Authentication check
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

---

### 5. ✅ SQL Injection 위험 완화 (MEDIUM-HIGH)

**위치:** `src/app/api/customers/route.ts:29`

**문제:**
```typescript
// ⚠️ 위험: 사용자 입력 직접 사용
query = query.or(`member_number.ilike.%${search}%,name.ilike.%${search}%`)
```

**수정:**
```typescript
// ✅ 개선: 특수문자 이스케이프
const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&')
query = query.or(`member_number.ilike.%${sanitizedSearch}%,name.ilike.%${sanitizedSearch}%`)
```

---

## ⚠️ 추가 수정 필요한 문제들 (TO DO)

### 6. ⚠️ 약한 패스워드 해싱 (HIGH PRIORITY)

**현재 상태:**
```typescript
// ❌ SHA-256 사용 (salt 없음)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex")
}
```

**권장 개선:**
```bash
# bcrypt 설치
npm install bcrypt @types/bcrypt

# 사용 예시
import bcrypt from 'bcrypt'

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}
```

**장점:**
- Salt 자동 생성
- Slow hashing (brute force 방어)
- Industry standard

---

### 7. ⚠️ Webhook 인증 없음 (HIGH PRIORITY)

**위치:** `src/app/api/webhooks/bank/route.ts`

**문제:**
- 누구나 가짜 입금 알림 전송 가능
- 서명 검증 없음

**권장 개선:**
```typescript
// HMAC 서명 검증 예시
import crypto from 'crypto'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  // 1. 서명 확인
  const signature = request.headers.get('x-webhook-signature')
  const body = await request.text()

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 2. IP 화이트리스트 확인 (선택)
  const clientIP = request.headers.get('x-forwarded-for')
  const ALLOWED_IPS = process.env.WEBHOOK_ALLOWED_IPS?.split(',') || []

  if (!ALLOWED_IPS.includes(clientIP)) {
    return NextResponse.json({ error: 'Unauthorized IP' }, { status: 403 })
  }

  // ... 나머지 로직
}
```

---

### 8. ⚠️ Rate Limiting 부재 (MEDIUM PRIORITY)

**문제:**
- 모든 API 엔드포인트에 Rate Limiting 없음
- OpenAI API 남용 가능 → 비용 폭증
- Database 쿼리 스팸 가능

**권장 개선:**
```bash
# Upstash Rate Limit 설치
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// middleware.ts에 추가
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
})

export async function middleware(request: NextRequest) {
  // AI 엔드포인트에 대해 rate limiting
  if (request.nextUrl.pathname.startsWith('/api/ocr') ||
      request.nextUrl.pathname.startsWith('/api/summarize') ||
      request.nextUrl.pathname.startsWith('/api/categorize')) {

    const ip = request.ip ?? '127.0.0.1'
    const { success } = await ratelimit.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }
  }

  // ... 기존 코드
}
```

---

### 9. ⚠️ Database Transaction 부재 (MEDIUM PRIORITY)

**문제:**
- 수동 롤백 사용 (진짜 트랜잭션 아님)
- 동시성 문제 가능
- 데이터 무결성 위험

**권장 개선:**
```sql
-- Supabase에서 RPC 함수 생성
CREATE OR REPLACE FUNCTION create_ticket_with_items(
  p_ticket_data jsonb,
  p_items jsonb[]
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_task_id uuid;
  v_item jsonb;
BEGIN
  -- Transaction 자동 시작

  -- 1. Task 생성
  INSERT INTO tasks (...)
  VALUES (...)
  RETURNING id INTO v_task_id;

  -- 2. Task Items 생성
  FOREACH v_item IN ARRAY p_items
  LOOP
    INSERT INTO task_items (task_id, ...)
    VALUES (v_task_id, ...);
  END LOOP;

  -- 성공 시 자동 COMMIT
  RETURN jsonb_build_object('success', true, 'task_id', v_task_id);

EXCEPTION
  WHEN OTHERS THEN
    -- 실패 시 자동 ROLLBACK
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

```typescript
// API에서 사용
const { data, error } = await supabase.rpc('create_ticket_with_items', {
  p_ticket_data: ticketData,
  p_items: items
})
```

---

### 10. ⚠️ Input Validation 부족 (MEDIUM PRIORITY)

**권장:** Zod 사용

```bash
npm install zod
```

```typescript
import { z } from 'zod'

// 스키마 정의
const CreateTicketSchema = z.object({
  member_id: z.string().uuid(),
  items: z.array(z.object({
    category: z.enum(['book', 'game', 'goods', 'inquiry', 'other']),
    description: z.string().min(1).max(1000),
    amount: z.number().min(0).max(10000000),
  })).min(1).max(50),
})

// API에서 사용
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Validation
  const result = CreateTicketSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json({
      error: "Invalid input",
      details: result.error.format()
    }, { status: 400 })
  }

  const { member_id, items } = result.data
  // ... 나머지 로직
}
```

---

## 🔒 보안 Best Practices

### 환경 변수 관리

```bash
# ✅ DO
- .env.local은 절대 커밋하지 않기
- 프로덕션 환경은 플랫폼의 환경 변수 관리 도구 사용 (Vercel, AWS, etc.)
- Service Role Key는 서버에서만 사용
- 주기적으로 키 로테이션

# ❌ DON'T
- .env 파일을 git에 커밋
- 코드에 키 하드코딩
- 클라이언트에서 Service Role Key 사용
- 공개 저장소에 키 노출
```

### API 보안

```typescript
// 모든 API 라우트에 적용할 패턴
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const { user } = await authenticate(request)

    // 2. Authorization
    if (!hasPermission(user, 'action')) {
      return unauthorized()
    }

    // 3. Input Validation
    const validated = schema.safeParse(await request.json())
    if (!validated.success) return badRequest(validated.error)

    // 4. Rate Limiting
    await checkRateLimit(user.id)

    // 5. Business Logic
    const result = await doSomething(validated.data)

    // 6. Audit Logging
    await logAction(user.id, 'action', result)

    return success(result)

  } catch (error) {
    // 7. Error Handling
    logError(error)
    return serverError()
  }
}
```

### Database 보안

```sql
-- Row Level Security (RLS) 활성화
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 읽기 정책
CREATE POLICY "Users can read their own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id OR (
    SELECT role FROM users WHERE id = auth.uid()
  ) IN ('ceo', 'admin', 'operator'));

-- 쓰기 정책
CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 업데이트 정책
CREATE POLICY "Only admin can update tasks"
  ON tasks FOR UPDATE
  USING ((
    SELECT role FROM users WHERE id = auth.uid()
  ) IN ('ceo', 'admin', 'operator'));
```

---

## 📋 우선순위별 할 일

### 🔴 High Priority (1주일 이내)

- [ ] 노출된 API 키 폐기 및 재발급
- [ ] 패스워드 해싱을 bcrypt로 변경
- [ ] Webhook 서명 검증 추가
- [ ] 나머지 API 엔드포인트에 인증 체크 추가

### 🟡 Medium Priority (2-4주)

- [ ] Rate Limiting 구현
- [ ] Input Validation (Zod) 추가
- [ ] Database Transaction을 RPC 함수로 변경
- [ ] Impersonation 기능 개선 (시간 제한, 로깅)

### 🟢 Low Priority (기술 부채)

- [ ] Console.log를 proper logging으로 교체
- [ ] React Error Boundaries 추가
- [ ] TypeScript strict mode 활성화
- [ ] 자동화된 보안 테스트 추가

---

## 📚 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [OpenAI API Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)

---

**마지막 업데이트:** 2026-01-28
**작성자:** Claude Code (Automated Security Audit)
