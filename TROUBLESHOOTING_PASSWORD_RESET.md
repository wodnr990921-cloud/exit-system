# 비밀번호 재설정 문제 해결 가이드

## 문제 1: "존재하지 않는 사용자입니다" 오류

### 원인
- 입력한 username이 데이터베이스에 없음
- RLS(Row Level Security) 정책으로 인한 조회 제한

### 해결 방법

#### 1단계: Supabase에서 사용자 확인

Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- 모든 사용자 확인
SELECT id, username, email, role, is_approved
FROM users
ORDER BY created_at DESC;
```

#### 2단계: 특정 username 확인

```sql
-- 특정 username 검색
SELECT id, username, email, role, is_approved
FROM users
WHERE username = 'wodnr990921';  -- 본인의 username으로 변경
```

#### 3단계: username이 없는 경우

username 컬럼이 비어있다면 업데이트:

```sql
-- email의 @ 앞부분을 username으로 설정
UPDATE users 
SET username = SPLIT_PART(email, '@', 1) 
WHERE username IS NULL OR username = '';
```

또는 직접 설정:

```sql
-- 특정 사용자의 username 설정
UPDATE users 
SET username = 'wodnr990921'  -- 원하는 username
WHERE email = 'your-email@example.com';  -- 본인의 이메일
```

---

## 문제 2: "임시 비밀번호 생성에 실패했습니다" 오류

### 원인
- `SUPABASE_SERVICE_ROLE_KEY` 환경 변수가 설정되지 않음
- Service Role Key가 잘못됨

### 해결 방법

#### 1단계: Service Role Key 확인

1. https://supabase.com 접속
2. 프로젝트 선택
3. Settings > API 메뉴
4. "Project API keys" 섹션에서 `service_role` key 복사

#### 2단계: 환경 변수 설정

`.env.local` 파일 확인/생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # 이것이 필수!
```

⚠️ **중요**: `SUPABASE_SERVICE_ROLE_KEY`가 반드시 있어야 합니다!

#### 3단계: 개발 서버 재시작

환경 변수 변경 후 반드시 재시작:

```bash
# 기존 서버 중지 (Ctrl+C)
# 다시 시작
npm run dev
```

---

## 문제 3: 데이터베이스 마이그레이션 미실행

### 증상
- "column does not exist" 오류
- temp_password 관련 오류

### 해결 방법

Supabase SQL Editor에서 마이그레이션 실행:

```sql
-- schema_migration_password_reset.sql 전체 내용 실행
```

또는 `check_users.sql` 파일에 포함된 내용:

```sql
-- temp_password 컬럼 확인
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('temp_password', 'is_temp_password', 'temp_password_expires_at');
```

컬럼이 없다면 `schema_migration_password_reset.sql` 실행 필요!

---

## 빠른 해결 체크리스트

### 단계 1: 환경 변수 확인
```bash
# PowerShell에서 확인 (주의: 보안상 실제 값은 표시 안 됨)
cd "c:\Users\User\exit system"
Get-Content .env.local | Select-String "SERVICE_ROLE"
```

- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 있는가?
- [ ] 개발 서버를 재시작했는가?

### 단계 2: 데이터베이스 확인

Supabase SQL Editor에서:

```sql
-- 1. 사용자 존재 확인
SELECT username, email FROM users WHERE username = 'your_username';

-- 2. 컬럼 존재 확인
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name LIKE 'temp_%';
```

- [ ] username이 데이터베이스에 존재하는가?
- [ ] temp_password 관련 컬럼이 있는가?

### 단계 3: 마이그레이션 실행

- [ ] `schema_migration_password_reset.sql` 실행했는가?

---

## 즉시 테스트 가능한 사용자 생성

임시로 테스트 사용자를 만들어서 테스트:

```sql
-- 1. Supabase Auth에 사용자 생성 (Supabase Dashboard > Authentication > Users)
--    또는 회원가입 페이지 사용

-- 2. users 테이블에 username 설정
UPDATE users 
SET username = 'testuser', 
    is_approved = true
WHERE email = 'test@example.com';  -- 방금 만든 이메일

-- 3. 확인
SELECT username, email, is_approved FROM users WHERE username = 'testuser';
```

이제 `testuser`로 임시 비밀번호 발급 테스트 가능!

---

## 환경 변수 설정 상세 가이드

### Windows (PowerShell)

`.env.local` 파일 생성/수정:

```powershell
# 프로젝트 루트로 이동
cd "c:\Users\User\exit system"

# .env.local 파일이 없으면 생성
if (!(Test-Path .env.local)) {
    New-Item .env.local -ItemType File
}

# 메모장으로 열기
notepad .env.local
```

다음 내용 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

저장 후 개발 서버 재시작!

---

## 실제 오류 메시지별 해결

### "아이디 'wodnr990921'을(를) 찾을 수 없습니다"

**의미**: 데이터베이스에 해당 username이 없음

**해결**:
```sql
-- Supabase에서 실행
SELECT username, email FROM users;

-- username이 없으면 설정
UPDATE users SET username = 'wodnr990921' WHERE id = 'your-user-id';
```

### "임시 비밀번호 생성에 실패했습니다. 관리자에게 문의하세요"

**의미**: Service Role Key 문제

**해결**:
1. `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가
2. Supabase Dashboard > Settings > API에서 키 복사
3. 개발 서버 재시작

### "사용자 조회 중 오류가 발생했습니다"

**의미**: 데이터베이스 연결 문제 또는 RLS 정책 문제

**해결**:
```sql
-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 필요시 임시로 RLS 비활성화 (개발 환경만!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

---

## 최종 확인 명령어 모음

```sql
-- === Supabase SQL Editor에서 실행 ===

-- 1. 모든 사용자 보기
SELECT username, email, role, is_approved, created_at 
FROM users 
ORDER BY created_at DESC;

-- 2. 특정 사용자 찾기
SELECT * FROM users WHERE username = 'wodnr990921';

-- 3. username이 NULL인 사용자 찾기
SELECT email, username FROM users WHERE username IS NULL;

-- 4. username 자동 설정
UPDATE users 
SET username = SPLIT_PART(email, '@', 1) 
WHERE username IS NULL;

-- 5. 필요한 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN (
    'temp_password', 
    'temp_password_expires_at', 
    'is_temp_password',
    'username'
  );

-- 6. 마이그레이션 필요 여부 확인
SELECT COUNT(*) as missing_columns
FROM (
  SELECT 'temp_password' as col
  UNION SELECT 'temp_password_expires_at'
  UNION SELECT 'is_temp_password'
  UNION SELECT 'username'
) expected
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = expected.col
);
-- 결과가 0이면 모든 컬럼 존재, 0보다 크면 마이그레이션 필요!
```

---

## 개발자 도구로 디버깅

### 브라우저 콘솔 확인

1. F12 또는 Ctrl+Shift+I로 개발자 도구 열기
2. Console 탭 선택
3. 임시 비밀번호 발급 시도
4. 빨간 오류 메시지 확인

### 터미널 로그 확인

개발 서버 터미널에서:
- "Supabase Auth 비밀번호 변경 오류" 메시지 확인
- "사용자 조회 오류" 메시지 확인

---

## 여전히 해결되지 않는 경우

### 1. 완전 초기화

```sql
-- Supabase에서 실행 (주의: 개발 환경에서만!)
-- 기존 임시 비밀번호 데이터 초기화
UPDATE users SET 
  temp_password = NULL,
  temp_password_expires_at = NULL,
  is_temp_password = false;
```

### 2. RLS 정책 임시 비활성화 (개발만!)

```sql
-- 개발 환경에서 테스트용
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 테스트 완료 후 다시 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### 3. 로그 추가하여 디버깅

API 파일 (`src/app/api/auth/reset-password/route.ts`)에 임시로 추가:

```typescript
console.log('Username:', username)
console.log('User Data:', userData)
console.log('Service Role Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
```

---

## 지금 바로 시도해볼 것

1. **Supabase SQL Editor 열기**
   ```sql
   SELECT username, email FROM users LIMIT 10;
   ```

2. **본인 username 확인 및 설정**
   ```sql
   UPDATE users SET username = 'wodnr990921' 
   WHERE email = '본인이메일@example.com';
   ```

3. **환경 변수 확인**
   - `.env.local` 파일 열기
   - `SUPABASE_SERVICE_ROLE_KEY` 있는지 확인
   - 없으면 Supabase Dashboard에서 복사

4. **개발 서버 재시작**
   ```bash
   npm run dev
   ```

5. **다시 테스트**
   - 로그인 페이지
   - "비밀번호를 잊으셨나요?"
   - username 입력
   - 임시 비밀번호 발급

---

**문제가 계속되면 브라우저 콘솔과 터미널 로그를 확인하세요!**
