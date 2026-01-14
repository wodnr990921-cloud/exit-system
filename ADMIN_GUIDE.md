# 관리자 계정 관리 가이드

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [데이터베이스 구조](#데이터베이스-구조)
3. [관리자 권한 시스템](#관리자-권한-시스템)
4. [초기 설정 방법](#초기-설정-방법)
5. [계정 생성 방법](#계정-생성-방법)
6. [API 엔드포인트 설명](#api-엔드포인트-설명)
7. [보안 고려사항](#보안-고려사항)
8. [트러블슈팅](#트러블슈팅)

---

## 시스템 개요

관리자가 사용자에게 직접 계정을 생성하고 부여할 수 있는 시스템입니다. 
Supabase Auth와 통합되어 있으며, 관리자 권한을 가진 사용자만 계정 생성이 가능합니다.

### 주요 기능

- ✅ 관리자 권한 기반 계정 생성
- ✅ 사용자 목록 조회
- ✅ 권한 설정 (일반 사용자/관리자)
- ✅ 자동 비밀번호 생성
- ✅ 사용자 정보 관리

---

## 데이터베이스 구조

### users 테이블

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',  -- 'admin' 또는 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 필드 설명

- **id**: 사용자 고유 식별자 (UUID, Supabase Auth와 연동)
- **email**: 사용자 이메일 주소 (고유값, 필수)
- **name**: 사용자 이름 (선택사항)
- **role**: 사용자 권한 ('admin' 또는 'user', 기본값: 'user')
- **created_at**: 계정 생성 시간
- **updated_at**: 계정 정보 수정 시간

### Auth 연동 트리거

```sql
-- auth.users 테이블에 새 사용자가 생성될 때 users 테이블에 자동으로 레코드 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

이 트리거는 Supabase Auth에 새 사용자가 생성될 때 자동으로 실행되어 `users` 테이블에 사용자 정보를 추가합니다.

---

## 관리자 권한 시스템

### 권한 확인 로직

`src/lib/utils/admin.ts` 파일에 구현되어 있습니다:

```typescript
// 사용자가 관리자인지 확인
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()
  
  return data?.role === "admin"
}

// 현재 로그인한 사용자의 관리자 권한 확인
export async function checkAdminAccess() {
  const { user } = await supabase.auth.getUser()
  if (!user) return { isAdmin: false, userId: null }
  
  const adminStatus = await isAdmin(user.id)
  return { isAdmin: adminStatus, userId: user.id }
}
```

### 권한 레벨

1. **admin (관리자)**
   - 계정 생성/관리 권한
   - 회원 관리 페이지 접근
   - 모든 사용자 목록 조회

2. **user (일반 사용자)**
   - 자신의 데이터만 접근
   - 계정 생성 불가
   - 회원 관리 페이지 접근 불가

---

## 초기 설정 방법

### 1단계: 데이터베이스 스키마 업데이트

1. Supabase Dashboard 접속
2. **SQL Editor** 메뉴로 이동
3. `schema.sql` 파일의 다음 부분을 실행:

```sql
-- users 테이블에 role 필드 추가 (이미 있다면 생략)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2단계: 최초 관리자 계정 생성

#### 방법 A: 기존 계정을 관리자로 변경

1. 일반 계정으로 로그인하거나 Supabase Dashboard에서 계정 생성
2. SQL Editor에서 다음 쿼리 실행:

```sql
-- 이메일로 사용자 찾기
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- users 테이블의 role 업데이트
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

#### 방법 B: Supabase Dashboard에서 직접 생성

1. **Authentication > Users** 메뉴로 이동
2. **Add user** 클릭
3. 이메일과 비밀번호 입력
4. **Add user** 클릭
5. SQL Editor에서 관리자 권한 부여:

```sql
UPDATE users SET role = 'admin' WHERE email = 'created-email@example.com';
```

---

## 계정 생성 방법

### UI를 통한 계정 생성

1. **관리자로 로그인**
   - 관리자 권한이 있는 계정으로 로그인

2. **회원 관리 페이지 접근**
   - 사이드바에서 "회원관리" 클릭
   - 또는 `/dashboard/members` 직접 접근

3. **새 계정 생성**
   - "+ 새 계정 생성" 버튼 클릭
   - 계정 정보 입력:
     - **이메일**: 사용자 이메일 주소 (필수)
     - **비밀번호**: 로그인 비밀번호 (필수)
       - 직접 입력하거나 "생성" 버튼으로 자동 생성 가능
     - **이름**: 사용자 이름 (선택사항)
     - **권한**: 일반 사용자 또는 관리자 선택
   - "계정 생성" 버튼 클릭

4. **계정 정보 전달**
   - 생성된 계정의 이메일과 비밀번호를 사용자에게 안전하게 전달
   - 사용자는 전달받은 정보로 즉시 로그인 가능

### 자동 비밀번호 생성 기능

"생성" 버튼을 클릭하면 다음 조건으로 비밀번호가 자동 생성됩니다:
- 길이: 12자
- 포함 문자: 대문자, 소문자, 숫자, 특수문자 (!@#$%^&*)
- 예시: `Kp9$mN2@xQwL`

---

## API 엔드포인트 설명

### POST /api/admin/create-user

관리자가 새 사용자 계정을 생성하는 API입니다.

#### 요청 헤더

```
Content-Type: application/json
```

#### 요청 본문

```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "홍길동",
  "role": "user"  // "user" 또는 "admin"
}
```

#### 필수 필드

- `email`: 사용자 이메일 주소
- `password`: 로그인 비밀번호

#### 선택 필드

- `name`: 사용자 이름
- `role`: 사용자 권한 (기본값: "user")

#### 응답 (성공)

```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "user"
  },
  "message": "계정이 성공적으로 생성되었습니다."
}
```

#### 응답 (실패)

```json
{
  "error": "에러 메시지"
}
```

#### 인증

- 관리자 권한이 필요합니다
- 비관리자가 요청하면 403 Forbidden 반환

#### 처리 과정

1. 관리자 권한 확인
2. 요청 데이터 유효성 검사
3. Supabase Auth에 사용자 생성
4. `users` 테이블에 사용자 정보 추가
5. 생성된 계정 정보 반환

---

## 보안 고려사항

### 1. 권한 검증

- 모든 관리자 기능은 서버 측에서 권한을 확인합니다
- 클라이언트 측 권한 체크만으로는 보안이 보장되지 않습니다

### 2. 비밀번호 정책

현재 구현:
- 최소 길이: 6자 (Supabase 기본값)
- 복잡도: 사용자 정의 가능

권장 개선사항:
```typescript
// 비밀번호 검증 예시
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
```

### 3. RLS (Row Level Security) 정책

`users` 테이블에 RLS 정책을 설정하여 데이터 접근을 제한할 수 있습니다:

```sql
-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 사용자 조회 가능
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 일반 사용자는 자신의 정보만 조회 가능
CREATE POLICY "Users can view own data"
ON users FOR SELECT
USING (id = auth.uid());
```

### 4. 로그 및 감사

중요한 작업(계정 생성, 권한 변경)에 대한 로그를 남기는 것을 권장합니다:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 트러블슈팅

### 문제 1: "관리자 권한이 필요합니다" 오류

**원인**: 현재 로그인한 사용자가 관리자 권한이 없음

**해결방법**:
1. 관리자 계정으로 로그인했는지 확인
2. `users` 테이블에서 role이 'admin'으로 설정되어 있는지 확인:

```sql
SELECT email, role FROM users WHERE id = 'your-user-id';
```

### 문제 2: 계정 생성 후 users 테이블에 레코드가 없음

**원인**: 트리거 함수가 제대로 작동하지 않음

**해결방법**:
1. 트리거가 생성되어 있는지 확인:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

2. 트리거가 없다면 `schema.sql`의 트리거 부분을 다시 실행

3. 트리거가 작동하지 않는 경우, 수동으로 추가:

```sql
INSERT INTO users (id, email, name, role)
VALUES (
  'auth-user-id',
  'email@example.com',
  'Name',
  'user'
);
```

### 문제 3: 회원 관리 페이지 접근 불가

**원인**: 관리자 권한이 없거나 인증되지 않음

**해결방법**:
1. 로그인 상태 확인
2. 관리자 권한 확인:

```sql
-- 현재 사용자 확인
SELECT id, email, role FROM users 
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

### 문제 4: 이메일 인증 요구

**원인**: Supabase Auth 설정에서 이메일 인증이 활성화되어 있음

**해결방법**:
1. Supabase Dashboard > Authentication > Settings
2. "Confirm email" 옵션 비활성화
3. 또는 관리자 계정 생성 시 이메일 인증을 건너뛰도록 설정

---

## 추가 기능 개선 제안

### 1. 계정 수정/삭제 기능

```typescript
// 계정 정보 수정
PUT /api/admin/users/:id

// 계정 삭제
DELETE /api/admin/users/:id
```

### 2. 비밀번호 재설정

```typescript
// 관리자가 사용자 비밀번호 재설정
POST /api/admin/users/:id/reset-password
```

### 3. 대량 계정 생성

```typescript
// CSV 파일 업로드로 여러 계정 한번에 생성
POST /api/admin/users/bulk-create
```

### 4. 계정 활동 로그

```typescript
// 사용자 로그인 기록, 활동 내역 등
GET /api/admin/users/:id/activity
```

---

---

## 파일 구조

### 프로젝트 디렉토리 구조

```
src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                    # 대시보드 메인 페이지 (서버 컴포넌트)
│   │   ├── dashboard-client.tsx        # 대시보드 클라이언트 컴포넌트
│   │   └── members/
│   │       ├── page.tsx                # 회원 관리 페이지 (서버 컴포넌트)
│   │       └── members-client.tsx      # 회원 관리 클라이언트 컴포넌트
│   ├── api/
│   │   └── admin/
│   │       └── create-user/
│   │           └── route.ts            # 계정 생성 API 엔드포인트
│   └── page.tsx                        # 로그인 페이지
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Supabase 클라이언트 (브라우저)
│   │   └── server.ts                   # Supabase 클라이언트 (서버)
│   └── utils/
│       └── admin.ts                    # 관리자 권한 확인 유틸리티
└── components/
    └── ui/                             # Shadcn UI 컴포넌트들
```

### 주요 파일 설명

#### 1. `src/lib/utils/admin.ts`

관리자 권한을 확인하는 유틸리티 함수들이 정의되어 있습니다.

**주요 함수:**
- `isAdmin(userId)`: 특정 사용자가 관리자인지 확인
- `checkAdminAccess()`: 현재 로그인한 사용자의 관리자 권한 확인

**사용 예시:**
```typescript
import { checkAdminAccess } from "@/lib/utils/admin"

const { isAdmin, userId } = await checkAdminAccess()
if (!isAdmin) {
  // 권한 없음 처리
}
```

#### 2. `src/app/api/admin/create-user/route.ts`

관리자가 새 계정을 생성하는 API 엔드포인트입니다.

**처리 흐름:**
1. 요청한 사용자의 관리자 권한 확인
2. 요청 데이터 유효성 검사
3. Supabase Auth에 사용자 생성
4. `users` 테이블에 사용자 정보 추가
5. 생성 결과 반환

**보안:**
- 관리자 권한이 없으면 403 Forbidden 반환
- 모든 검증은 서버 측에서 수행

#### 3. `src/app/dashboard/members/page.tsx`

회원 관리 페이지의 서버 컴포넌트입니다.

**기능:**
- 인증 확인 (로그인되지 않으면 리다이렉트)
- 관리자 권한 확인 (권한이 없으면 대시보드로 리다이렉트)
- 클라이언트 컴포넌트 렌더링

#### 4. `src/app/dashboard/members/members-client.tsx`

회원 관리 페이지의 클라이언트 컴포넌트입니다.

**주요 기능:**
- 사용자 목록 조회 및 표시
- 새 계정 생성 폼
- 자동 비밀번호 생성
- 에러/성공 메시지 표시

**상태 관리:**
- `users`: 사용자 목록
- `loading`: 로딩 상태
- `creating`: 계정 생성 진행 상태
- `error`: 에러 메시지
- `success`: 성공 메시지
- `showCreateForm`: 계정 생성 폼 표시 여부
- `newUser`: 새 계정 정보 (이메일, 비밀번호, 이름, 권한)

---

## 데이터 흐름

### 계정 생성 프로세스

```
1. 관리자 로그인
   ↓
2. 회원 관리 페이지 접근 (/dashboard/members)
   ↓
3. "새 계정 생성" 버튼 클릭
   ↓
4. 계정 정보 입력 (이메일, 비밀번호, 이름, 권한)
   ↓
5. "계정 생성" 버튼 클릭
   ↓
6. POST /api/admin/create-user API 호출
   ↓
7. 서버 측 관리자 권한 확인
   ↓
8. Supabase Auth에 사용자 생성
   ↓
9. 트리거 함수 실행 → users 테이블에 레코드 추가
   ↓
10. 사용자 목록 새로고침
   ↓
11. 생성된 계정 정보 표시
```

### 권한 확인 프로세스

```
1. 페이지/API 접근 시도
   ↓
2. Supabase Auth에서 현재 사용자 확인
   ↓
3. users 테이블에서 사용자 role 조회
   ↓
4. role === 'admin' 확인
   ↓
5. 권한이 있으면 접근 허용, 없으면 차단
```

---

## 실전 사용 예시

### 시나리오 1: 새 직원 계정 생성

1. 관리자(김관리)가 로그인
2. 사이드바에서 "회원관리" 클릭
3. "+ 새 계정 생성" 버튼 클릭
4. 다음 정보 입력:
   - 이메일: `hong@company.com`
   - 비밀번호: 자동 생성 또는 직접 입력
   - 이름: `홍길동`
   - 권한: `일반 사용자`
5. "계정 생성" 클릭
6. 생성 완료 메시지 확인
7. 홍길동에게 이메일과 비밀번호 전달
8. 홍길동이 받은 정보로 로그인

### 시나리오 2: 부관리자 계정 생성

1. 관리자가 회원 관리 페이지 접근
2. 새 계정 생성 폼 열기
3. 다음 정보 입력:
   - 이메일: `admin2@company.com`
   - 비밀번호: 강력한 비밀번호 입력
   - 이름: `이부관리`
   - 권한: `관리자`
4. 계정 생성
5. 이부관리도 관리자 권한으로 계정 생성 가능

---

## 참고 자료

- [Supabase Auth 문서](https://supabase.com/docs/guides/auth)
- [Supabase RLS 정책](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
