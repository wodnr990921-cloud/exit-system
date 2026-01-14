# 임시 비밀번호 로그인 디버깅 가이드

## 문제: 임시 비밀번호 발급은 되지만 로그인이 안 됨

### 원인 분석

1. **Supabase Auth 반영 확인**
   - 임시 비밀번호가 실제로 Supabase Auth에 저장되었는지 확인 필요

2. **입력 오류**
   - 대소문자 구분 (임시 비밀번호는 대소문자 섞여있음)
   - 공백 문자 포함 여부
   - 복사/붙여넣기 시 앞뒤 공백

3. **타이밍 문제**
   - 비밀번호 변경 후 즉시 로그인 시 반영 안 될 수 있음

---

## 즉시 확인할 것

### 1단계: 브라우저 개발자 도구 확인

1. **F12** 또는 **Ctrl+Shift+I** 로 개발자 도구 열기
2. **Console** 탭 선택
3. 임시 비밀번호로 로그인 시도
4. 빨간색 오류 메시지 확인

**예상 로그:**
```
로그인 시도: username=wodnr990921, email=..., is_temp_password=true
Login auth error: ...
```

### 2단계: 터미널 로그 확인

개발 서버 터미널에서:
```
로그인 시도: username=wodnr990921, email=user@example.com, is_temp_password=true
Login auth error: { message: 'Invalid login credentials', status: 400 }
```

### 3단계: Supabase에서 직접 확인

```sql
-- 사용자 정보 확인
SELECT 
  id, 
  username, 
  email, 
  is_temp_password,
  temp_password_expires_at,
  temp_password
FROM users 
WHERE username = 'wodnr990921';  -- 본인 username
```

**확인사항:**
- `is_temp_password`가 `true`인가?
- `temp_password_expires_at`가 미래 시간인가?
- `temp_password`에 값이 있는가?

---

## 해결 방법

### 방법 1: 임시 비밀번호 재발급 (추천)

1. 로그인 페이지에서 "비밀번호를 잊으셨나요?" 다시 클릭
2. username 입력
3. **새로운** 임시 비밀번호 받기
4. 화면에 표시된 비밀번호를 **정확히** 복사
5. 바로 로그인 시도 (앞뒤 공백 주의!)

### 방법 2: Supabase Auth 사용자 확인

Supabase 대시보드에서:
1. **Authentication** > **Users** 메뉴
2. 본인 이메일 찾기
3. 사용자가 존재하는지 확인
4. 존재한다면 비밀번호가 업데이트되었는지 확인 (최근 업데이트 시간)

### 방법 3: 직접 비밀번호 설정

Supabase Dashboard:
1. **Authentication** > **Users**
2. 본인 계정 찾기
3. **...** (더보기) > **Reset Password**
4. 새 비밀번호 입력
5. 그 비밀번호로 로그인

그 후 데이터베이스에서:
```sql
UPDATE users 
SET is_temp_password = false,
    temp_password = NULL,
    temp_password_expires_at = NULL
WHERE username = 'wodnr990921';
```

---

## 임시 비밀번호 입력 시 주의사항

### ✅ 올바른 방법
```
1. 화면에 표시된 임시 비밀번호: Abc12345
2. 복사 버튼 클릭 또는 드래그하여 정확히 복사
3. 로그인 화면의 비밀번호 필드에 붙여넣기
4. 앞뒤 공백 없는지 확인
5. 로그인 버튼 클릭
```

### ❌ 흔한 실수
```
- 수동으로 타이핑 (대소문자 실수)
- 앞뒤 공백 포함하여 복사
- O(오)와 0(영), I(아이)와 l(엘) 혼동
- 임시 비밀번호 발급 후 너무 오래 지남 (24시간 만료)
```

---

## 완전한 테스트 시나리오

### 시나리오 1: 새로 발급받아서 로그인

```bash
1. 브라우저 시크릿 모드 열기 (Ctrl+Shift+N)
2. http://localhost:3000 접속
3. "비밀번호를 잊으셨나요?" 클릭
4. username 입력: wodnr990921
5. "임시 비밀번호 발급" 클릭
6. 화면 결과:
   - 성공: "임시 비밀번호: Abc12345 ..."
   - 실패: 오류 메시지 확인
7. 임시 비밀번호 복사 (드래그 선택 후 Ctrl+C)
8. "로그인으로 돌아가기" 클릭
9. username 입력: wodnr990921
10. 비밀번호 붙여넣기 (Ctrl+V)
11. 로그인 클릭
12. 결과:
    - 성공: 비밀번호 변경 화면 또는 대시보드
    - 실패: 콘솔 및 터미널 로그 확인
```

### 시나리오 2: 데이터베이스 직접 확인

```sql
-- 1. 사용자 존재 확인
SELECT id, username, email FROM users WHERE username = 'wodnr990921';

-- 2. 임시 비밀번호 상태 확인
SELECT 
  username,
  is_temp_password,
  temp_password IS NOT NULL as has_temp_password,
  temp_password_expires_at,
  CASE 
    WHEN temp_password_expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as status
FROM users 
WHERE username = 'wodnr990921';

-- 3. Supabase Auth 사용자 확인
SELECT 
  id,
  email,
  created_at,
  updated_at,
  last_sign_in_at
FROM auth.users
WHERE email = (SELECT email FROM users WHERE username = 'wodnr990921');
```

---

## Service Role Key 재확인

`.env.local` 파일:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # 실제 키가 있는가?
```

터미널에서 확인:
```powershell
cd "c:\Users\User\exit system"
Get-Content .env.local | Select-String "SERVICE_ROLE"
```

결과가 나와야 함!

---

## 여전히 안 되면

### 임시 해결책: 관리자가 직접 비밀번호 설정

Supabase SQL Editor:
```sql
-- 1. 임시 비밀번호 플래그 초기화
UPDATE users 
SET is_temp_password = false,
    temp_password = NULL,
    temp_password_expires_at = NULL
WHERE username = 'wodnr990921';

-- 2. Supabase Dashboard > Authentication > Users에서
--    해당 사용자의 비밀번호를 수동으로 재설정
--    (예: "newpassword123")

-- 3. 그 비밀번호로 로그인
```

---

## 로그 분석

### 정상 로그 예시:
```
로그인 시도: username=wodnr990921, email=user@example.com, is_temp_password=true
로그인 성공: wodnr990921
```

### 실패 로그 예시:
```
로그인 시도: username=wodnr990921, email=user@example.com, is_temp_password=true
Login auth error: { message: 'Invalid login credentials', status: 400 }
Error details: { message: 'Invalid login credentials', status: 400, name: 'AuthApiError' }
```

**해석:**
- `Invalid login credentials` = 비밀번호가 Supabase Auth와 일치하지 않음
- 임시 비밀번호가 제대로 반영되지 않았을 가능성

---

## 최종 체크리스트

- [ ] Service Role Key가 .env.local에 있는가?
- [ ] 개발 서버를 재시작했는가?
- [ ] 임시 비밀번호를 정확히 복사했는가?
- [ ] 24시간이 지나지 않았는가?
- [ ] 브라우저 콘솔에서 오류 메시지를 확인했는가?
- [ ] 터미널에서 로그를 확인했는가?
- [ ] Supabase에서 사용자 정보를 확인했는가?

---

## 지금 바로 시도

1. **F12로 개발자 도구 열기**
2. **Console 탭 선택**
3. **임시 비밀번호로 로그인 시도**
4. **빨간 오류 메시지 복사해서 알려주기**

오류 메시지를 보면 정확한 원인을 찾을 수 있습니다!
