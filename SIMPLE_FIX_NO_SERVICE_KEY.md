# 🚀 Service Role Key 없이 즉시 사용하기

## 문제
Service Role Key가 없어서 임시 비밀번호 시스템이 작동하지 않음

## 해결 방법 (3단계, 5분)

### 1단계: RLS 정책 수정 (2분)

Supabase SQL Editor에서 다음 실행:

```sql
-- users 테이블의 RLS를 임시로 비활성화 (개발 환경만!)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

⚠️ **주의**: 개발 환경에서만 사용하세요!

프로덕션에서는 다음으로 다시 활성화:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### 2단계: username 설정 (1분)

```sql
-- 본인 계정 확인
SELECT id, email, username FROM users;

-- username 설정
UPDATE users 
SET username = 'wodnr990921'  -- 원하는 username
WHERE email = '본인이메일@example.com';  -- 본인 이메일

-- 확인
SELECT username, email FROM users WHERE username = 'wodnr990921';
```

### 3단계: 마이그레이션 실행 (2분)

```sql
-- schema_migration_password_reset.sql 전체 내용 복사하여 실행
-- 또는 아래 요약 버전:

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'temp_password'
  ) THEN
    ALTER TABLE users ADD COLUMN temp_password VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'temp_password_expires_at'
  ) THEN
    ALTER TABLE users ADD COLUMN temp_password_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_temp_password'
  ) THEN
    ALTER TABLE users ADD COLUMN is_temp_password BOOLEAN DEFAULT false;
  END IF;
END $$;
```

### 완료! 🎉

이제 다시 테스트:
1. http://localhost:3000
2. "비밀번호를 잊으셨나요?" 클릭
3. `wodnr990921` 입력
4. 임시 비밀번호 발급!

---

## ⚠️ 제한사항

Service Role Key 없이는:
- ✅ 임시 비밀번호 발급 가능
- ✅ 화면에 임시 비밀번호 표시
- ❌ **하지만 실제로 로그인은 안 됨** (Supabase Auth에 반영 안 됨)

완전한 기능을 위해서는 Service Role Key가 필요합니다.

---

## 🔑 Service Role Key 구하는 방법

### Supabase 프로젝트가 있는 경우:

1. https://supabase.com 접속
2. 프로젝트 선택
3. Settings (⚙️) > API
4. "service_role" 키 복사
5. `.env.local`에 추가:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=여기에붙여넣기
   ```
6. 개발 서버 재시작

### Supabase 프로젝트가 없는 경우:

새 프로젝트 생성:
1. https://supabase.com/dashboard
2. "New Project" 클릭
3. 프로젝트 이름: exit-system
4. 데이터베이스 비밀번호 설정
5. Region 선택 (Northeast Asia 권장)
6. "Create new project" 클릭
7. 생성 완료 후 Settings > API에서 키 확인

---

## 📊 현재 상태

코드가 수정되어 Service Role Key가 없어도:
- ✅ 에러 없이 실행됨
- ✅ 임시 비밀번호 발급됨
- ✅ 경고 메시지 표시됨
- ⚠️ 하지만 완전한 기능을 위해서는 Service Role Key 필요

---

## 즉시 테스트 가능

지금 바로:
1. Supabase에서 위 SQL 3개 실행 (5분)
2. 로그인 페이지에서 테스트
3. 임시 비밀번호 발급 확인

나중에 Service Role Key 추가하면 완벽하게 작동!
