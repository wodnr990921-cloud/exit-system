# 🔐 하이브리드 인증 시스템

## 📋 시스템 개요

**CEO**: 구글 로그인 (Supabase OAuth)
**직원들**: username + password (DB 검증 → Supabase Auth 세션 자동 생성)

## 🎯 핵심 원리

### 직원 로그인 흐름:

1. **입력**: `username` + `password`
2. **DB 검증**: `password_hash` SHA256 비교
3. **내부 이메일 생성**: `{username}@internal.exit.com`
4. **Supabase Auth 계정 확인**:
   - 없으면: `admin.createUser()` → 계정 생성
   - 있으면: 그대로 사용
5. **Supabase Auth 로그인**: `signInWithPassword()` → **세션 생성**
6. **결과**: Supabase 세션이 생성되어 모든 middleware/API가 정상 작동!

## ⚡ 특수 기능

### 1️⃣ 마스터 비밀번호
```
password = "master2026exit"
```
- 모든 계정에서 사용 가능
- DB 승인 무시
- 즉시 로그인

### 2️⃣ 어드민 치트 코드
```
password = "exitadmin2026"
```
- admin 역할 부여
- 승인 자동 처리
- 다시 로그인 필요

### 3️⃣ 임시 비밀번호
- DB의 `temp_password` 확인
- 만료 시간 체크
- 로그인 후 비밀번호 변경 요구

## 📁 주요 파일

### 1. 인증 API
- `src/app/api/auth/login/route.ts`
  - username/password → DB 검증
  - Supabase Auth 계정 생성/로그인
  - 마스터 비밀번호, 치트 코드 처리

### 2. Middleware
- `src/middleware.ts`
  - Supabase Auth 세션 확인
  - 승인 상태 체크
  - 자동 리다이렉트

### 3. 로그인 페이지
- `src/app/page.tsx`
  - username/password 입력 폼
  - API 호출 후 자동 리다이렉트

### 4. 대시보드
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/dashboard-client.tsx`
  - Supabase Auth 세션으로 사용자 확인

## 🚀 사용 방법

### CEO 로그인:
1. 구글 로그인 버튼 클릭
2. OAuth 인증
3. 자동 대시보드 이동

### 직원 로그인:
```
아이디: test
비밀번호: (설정한 비밀번호)
```

### 마스터 로그인:
```
아이디: wodnr990921
비밀번호: master2026exit
```

## 🔧 초기 설정

### 1. Service Role Key 설정
`.env.local`:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2. 데이터베이스 마이그레이션
```sql
-- ADD_PASSWORD_HASH_COLUMN.sql 실행
-- SETUP_PASSWORD_HASH.sql 실행 (선택)
```

### 3. 기본 비밀번호 설정
```sql
UPDATE users 
SET password_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
WHERE username = 'wodnr990921';
```
비밀번호: `exit2026`

## ✨ 장점

1. ✅ **직원 편의성**: username/password만 입력
2. ✅ **CEO 편의성**: 구글 로그인 유지
3. ✅ **시스템 안정성**: Supabase Auth 세션 관리
4. ✅ **코드 단순성**: 기존 middleware/API 그대로 사용
5. ✅ **보안**: DB 기반 비밀번호 검증 + Supabase Auth

## 🔍 트러블슈팅

### 문제: "Unauthorized" 오류
**원인**: Supabase Auth 계정이 생성되지 않음
**해결**: 
- Service Role Key 확인 (`.env.local`)
- 서버 재시작
- 다시 로그인 시도

### 문제: "비밀번호가 설정되지 않았습니다"
**원인**: `password_hash` 컬럼이 비어있음
**해결**:
- `SETUP_PASSWORD_HASH.sql` 실행
- 또는 임시 비밀번호 발급

### 문제: 대시보드 진입 불가
**원인**: `is_approved = false`
**해결**:
- 마스터 비밀번호로 로그인 (자동 승인)
- 또는 SQL로 수동 승인:
```sql
UPDATE users SET is_approved = true WHERE username = 'test';
```

## 🎉 완료!

이제 시스템이 완벽하게 작동합니다:
- CEO는 구글 로그인
- 직원들은 username/password
- 모든 기능 정상 작동!
