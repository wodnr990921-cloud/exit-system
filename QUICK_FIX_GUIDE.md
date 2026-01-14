# 🚨 임시 비밀번호 로그인 안 되는 문제 즉시 해결

## 문제 상황
- 임시 비밀번호 발급은 성공 (200 OK)
- 하지만 로그인 시도하면 401 Unauthorized

## 🎯 즉시 해결 방법 (3가지 중 선택)

---

### 방법 1: Supabase에서 직접 비밀번호 설정 (가장 빠름! ⚡)

#### 1단계: Supabase Dashboard 접속
1. https://supabase.com 로그인
2. 프로젝트 선택
3. **Authentication** > **Users** 메뉴

#### 2단계: 비밀번호 직접 설정
1. 본인 이메일 찾기
2. 오른쪽 **...** (더보기) 클릭
3. **Reset Password** 선택
4. 새 비밀번호 입력 (예: `newpass123`)
5. **Update user** 클릭

#### 3단계: 데이터베이스 정리
Supabase SQL Editor에서:
```sql
UPDATE users 
SET 
  is_temp_password = false,
  temp_password = NULL,
  temp_password_expires_at = NULL,
  is_approved = true
WHERE username = 'wodnr990921';  -- 본인 username
```

#### 4단계: 로그인
- username: wodnr990921
- password: newpass123 (방금 설정한 비밀번호)

✅ **이제 로그인 됩니다!**

---

### 방법 2: SQL로 모든 문제 해결

Supabase SQL Editor에서 `FIX_LOGIN_ISSUE.sql` 파일 내용 실행:

```sql
-- 1. 승인 처리
UPDATE users 
SET is_approved = true 
WHERE username = 'wodnr990921';

-- 2. 임시 비밀번호 초기화
UPDATE users 
SET 
  is_temp_password = false,
  temp_password = NULL,
  temp_password_expires_at = NULL
WHERE username = 'wodnr990921';

-- 3. 확인
SELECT username, email, is_approved, is_temp_password
FROM users 
WHERE username = 'wodnr990921';
```

그 다음 **방법 1**의 2단계로 가서 비밀번호 직접 설정!

---

### 방법 3: 완전 초기화 후 재발급

#### 1단계: 초기화
```sql
-- Supabase SQL Editor
UPDATE users 
SET 
  is_temp_password = false,
  temp_password = NULL,
  temp_password_expires_at = NULL,
  is_approved = true
WHERE username = 'wodnr990921';
```

#### 2단계: 서버 재시작
터미널에서 Ctrl+C 후:
```bash
npm run dev
```

#### 3단계: 새로 임시 비밀번호 발급
1. http://localhost:3000
2. "비밀번호를 잊으셨나요?"
3. username 입력
4. 임시 비밀번호 발급
5. **화면에 표시된 비밀번호를 메모장에 복사**

#### 4단계: 즉시 로그인
- 발급받은 비밀번호를 **정확히** 입력
- 앞뒤 공백 없이!

---

## 🔍 문제 원인 분석

### 가능한 원인:

1. **is_approved가 false**
   ```sql
   -- 확인
   SELECT is_approved FROM users WHERE username = 'wodnr990921';
   
   -- 해결
   UPDATE users SET is_approved = true WHERE username = 'wodnr990921';
   ```

2. **Service Role Key 문제**
   - 임시 비밀번호가 Supabase Auth에 반영 안 됨
   - `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 확인

3. **RLS 정책 문제**
   ```sql
   -- 임시 해결 (개발 환경만!)
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ```

4. **비밀번호 입력 오류**
   - 대소문자 구분 (Abc12345 ≠ abc12345)
   - 앞뒤 공백
   - O(오)와 0(영) 혼동

---

## 🎯 지금 당장 해야 할 것

### 옵션 A: 빠른 해결 (5분)
1. Supabase Dashboard > Authentication > Users
2. 본인 계정 찾아서 비밀번호 직접 설정
3. 그 비밀번호로 로그인
4. 로그인 후 설정 > 비밀번호 변경에서 원하는 비밀번호로 변경

### 옵션 B: 디버깅 (10분)
1. `FIX_LOGIN_ISSUE.sql` 실행
2. 브라우저 F12 > Console 탭에서 오류 확인
3. 오류 메시지 복사해서 알려주기

---

## 💡 확인 체크리스트

```sql
-- Supabase SQL Editor에서 실행
SELECT 
  username,
  email,
  is_approved,
  is_temp_password,
  temp_password IS NOT NULL as has_temp_pwd,
  temp_password_expires_at > NOW() as is_valid
FROM users 
WHERE username = 'wodnr990921';
```

**결과가 이래야 함:**
- `is_approved`: true ✓
- `is_temp_password`: true (임시 비번 사용 중)
- `has_temp_pwd`: true
- `is_valid`: true

**하나라도 false면 문제!**

---

## 🆘 여전히 안 되면

### 브라우저 콘솔 로그 확인
1. F12 키
2. Console 탭
3. 로그인 시도
4. 빨간색 오류 메시지 복사
5. 알려주기

### 터미널 로그 확인
개발 서버 터미널에서:
```
로그인 시도: username=..., email=..., is_temp_password=...
Login auth error: ...
```

이 로그를 복사해서 알려주세요!

---

## ⚡ 가장 빠른 해결책

**지금 바로:**

1. Supabase Dashboard 열기
2. Authentication > Users
3. 본인 계정 찾기
4. Reset Password로 새 비밀번호 설정
5. 그 비밀번호로 로그인!

**끝!** 🎉

임시 비밀번호는 나중에 다시 테스트하고,
일단 로그인부터 하세요!
