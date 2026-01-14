# 비밀번호 재설정 시스템 배포 가이드

## 🚀 즉시 배포 가능

모든 코드 작업이 완료되었습니다. 아래 단계를 따라 배포하세요.

## 📋 배포 전 체크리스트

### 1. 데이터베이스 마이그레이션 실행 ✅ 필수

Supabase 대시보드에 접속하여 SQL Editor에서 다음 파일을 실행하세요:

```sql
-- 파일: schema_migration_password_reset.sql
-- 또는 ALL_MIGRATIONS.sql의 마지막 섹션
```

**실행 방법:**
1. https://supabase.com 접속
2. 프로젝트 선택
3. SQL Editor 메뉴 클릭
4. New Query 클릭
5. `schema_migration_password_reset.sql` 내용 붙여넣기
6. Run 버튼 클릭

**확인 방법:**
```sql
-- users 테이블에 새 컬럼이 추가되었는지 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('temp_password', 'is_temp_password', 'temp_password_expires_at')
ORDER BY column_name;
```

### 2. 환경 변수 확인

`.env.local` 파일에 다음 변수가 설정되어 있는지 확인:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Admin API 사용을 위해 필요
```

⚠️ **중요**: `SUPABASE_SERVICE_ROLE_KEY`가 없으면 비밀번호 변경 기능이 작동하지 않습니다.

### 3. 어드민 치트 코드 설정 (선택)

프로덕션 환경에서는 치트 코드를 변경하거나 제거하는 것을 권장합니다.

**현재 치트 코드:** `exitadmin2026`

**변경 방법:**
```typescript
// src/app/api/auth/login/route.ts
const ADMIN_CHEAT_CODE = process.env.ADMIN_CHEAT_CODE || "exitadmin2026"
```

`.env.local`에 추가:
```env
ADMIN_CHEAT_CODE=your_secret_code_here
```

**또는 완전히 제거:**
```typescript
// src/app/api/auth/login/route.ts
// 27-52번 줄의 치트 코드 체크 로직 주석 처리 또는 삭제
```

## 🧪 로컬 테스트

### 1. 개발 서버 실행

```bash
npm run dev
```

서버가 http://localhost:3000 에서 실행됩니다.

### 2. 테스트 시나리오

#### 테스트 1: 로그인 UI 크기 확인
- [ ] 로그인 페이지 접속
- [ ] 카드 크기가 이전보다 작은지 확인
- [ ] 모바일 화면에서도 확인

#### 테스트 2: 임시 비밀번호 발급
- [ ] "비밀번호를 잊으셨나요?" 클릭
- [ ] 기존 사용자 아이디 입력
- [ ] "임시 비밀번호 발급" 클릭
- [ ] 8자리 임시 비밀번호 표시 확인
- [ ] 임시 비밀번호 복사

#### 테스트 3: 임시 비밀번호로 로그인
- [ ] 로그인 페이지로 돌아가기
- [ ] 아이디와 임시 비밀번호 입력
- [ ] 로그인 성공 확인
- [ ] "비밀번호를 변경해주세요" 메시지 확인
- [ ] 비밀번호 변경 화면 표시 확인

#### 테스트 4: 비밀번호 변경
- [ ] 현재 비밀번호(임시 비밀번호) 입력
- [ ] 새 비밀번호 입력 (6자 이상)
- [ ] 비밀번호 확인 입력
- [ ] "비밀번호 변경" 클릭
- [ ] 성공 메시지 확인
- [ ] 새 비밀번호로 재로그인 확인

#### 테스트 5: 어드민 치트 코드
- [ ] 로그인 페이지에서 아이디 입력
- [ ] 비밀번호에 `exitadmin2026` 입력
- [ ] "어드민 권한이 부여되었습니다" 메시지 확인
- [ ] 실제 비밀번호로 재로그인
- [ ] 대시보드에서 admin 권한 확인

#### 테스트 6: 일반 로그인
- [ ] 기존 비밀번호로 정상 로그인 확인
- [ ] 잘못된 비밀번호 입력 시 오류 메시지 확인

#### 테스트 7: 임시 비밀번호 만료 (선택)
- [ ] 데이터베이스에서 `temp_password_expires_at`를 과거로 변경
- [ ] 만료된 임시 비밀번호로 로그인 시도
- [ ] "임시 비밀번호가 만료되었습니다" 메시지 확인

## 🔧 문제 해결

### 문제 1: "임시 비밀번호 생성에 실패했습니다"

**원인:** Supabase Service Role Key가 설정되지 않음

**해결:**
```env
# .env.local
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Supabase 대시보드 > Settings > API > service_role key 복사

### 문제 2: 임시 비밀번호로 로그인이 안 됨

**원인 1:** 대소문자 구분
- 임시 비밀번호는 대소문자를 정확히 입력해야 함

**원인 2:** 만료됨
- 24시간이 지났는지 확인
- 새로운 임시 비밀번호 재발급

**원인 3:** 데이터베이스 마이그레이션 미실행
- `schema_migration_password_reset.sql` 실행 확인

### 문제 3: 비밀번호 변경이 안 됨

**원인:** Service Role Key 권한 부족

**해결:**
1. Supabase 대시보드에서 Service Role Key 확인
2. `.env.local`에 올바르게 설정되었는지 확인
3. 개발 서버 재시작

### 문제 4: 어드민 치트가 작동하지 않음

**확인사항:**
1. 치트 코드 정확히 입력: `exitadmin2026` (소문자)
2. 해당 아이디가 데이터베이스에 존재하는지 확인
3. 브라우저 개발자 도구 콘솔에서 오류 확인

## 📦 프로덕션 배포

### Vercel 배포

```bash
# 변경사항 커밋
git add .
git commit -m "feat: 비밀번호 재설정 및 로그인 개선"
git push

# Vercel이 자동으로 배포
```

### 환경 변수 설정 (Vercel)

Vercel 대시보드 > Settings > Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_CHEAT_CODE=your_production_cheat_code  # 선택사항
```

### 배포 후 확인

1. 프로덕션 URL 접속
2. 로그인 페이지 UI 확인
3. 임시 비밀번호 발급 테스트
4. 로그인 테스트

## 📊 모니터링

### 로그 확인

개발 환경:
```bash
# 터미널에서 로그 확인
npm run dev
```

프로덕션 환경:
- Vercel 대시보드 > Logs
- Supabase 대시보드 > Logs

### 주요 확인 사항

1. **임시 비밀번호 발급 오류**
   - "임시 비밀번호 저장 오류" 로그 확인
   - Supabase Auth 비밀번호 변경 오류 확인

2. **로그인 오류**
   - "Login error" 로그 확인
   - "Login auth error" 로그 확인

3. **비밀번호 변경 오류**
   - "비밀번호 변경 오류" 로그 확인

## 🔐 보안 권장사항

### 1. 어드민 치트 코드 관리

**개발 환경:**
- 현재 코드 그대로 사용 가능

**프로덕션 환경:**
- 환경 변수로 관리
- 또는 완전히 제거
- 감사 로그 추가 권장

### 2. 임시 비밀번호 전송

**현재:** 화면에만 표시

**권장:** 이메일 또는 SMS로 전송
```typescript
// 향후 개선
// 1. 이메일 전송 (Supabase Auth Email)
// 2. SMS 전송 (Twilio 등)
```

### 3. 비밀번호 정책 강화

**현재:** 최소 6자

**권장:**
- 최소 8자 이상
- 특수문자 포함
- 대소문자 혼합
- 숫자 포함

### 4. Rate Limiting

임시 비밀번호 발급 API에 Rate Limiting 추가 권장:
```typescript
// 예: 1시간에 3번까지만 발급 가능
```

## 📝 사용자 안내

### 사용자에게 전달할 내용

1. **비밀번호를 잊은 경우**
   - 로그인 페이지에서 "비밀번호를 잊으셨나요?" 클릭
   - 아이디 입력 후 임시 비밀번호 발급
   - 발급된 임시 비밀번호로 로그인
   - 즉시 새 비밀번호로 변경

2. **임시 비밀번호 유효기간**
   - 24시간 동안만 사용 가능
   - 만료 후에는 새로운 임시 비밀번호 재발급 필요

3. **보안 주의사항**
   - 임시 비밀번호는 즉시 변경하세요
   - 비밀번호는 다른 사람과 공유하지 마세요

## ✅ 배포 완료 체크리스트

- [ ] 데이터베이스 마이그레이션 실행
- [ ] 환경 변수 설정 확인
- [ ] 로컬 테스트 완료
- [ ] 어드민 치트 코드 설정/제거
- [ ] Git 커밋 및 푸시
- [ ] Vercel 배포 완료
- [ ] 프로덕션 환경 테스트
- [ ] 사용자 안내 문서 작성
- [ ] 팀원에게 공유

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. `PASSWORD_RESET_GUIDE.md` - 상세한 사용 가이드
2. `WORK_COMPLETION_PASSWORD_RESET.md` - 구현 내용 및 기술 상세
3. 브라우저 개발자 도구 콘솔
4. Supabase 대시보드 로그
5. Vercel 대시보드 로그

---

**모든 준비가 완료되었습니다! 🎉**

데이터베이스 마이그레이션만 실행하면 즉시 사용 가능합니다.
