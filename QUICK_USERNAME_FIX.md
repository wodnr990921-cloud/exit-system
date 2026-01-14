# 🚨 "아이디를 찾을 수 없습니다" 오류 해결

## 문제
마스터 비밀번호를 입력했는데 "아이디를 찾을 수 없습니다" 오류 발생

## 원인
데이터베이스에 `username`이 설정되지 않았거나 잘못된 username을 입력함

---

## ⚡ 즉시 해결 방법

### 1단계: Supabase에서 본인 username 확인

Supabase SQL Editor에서 실행:

```sql
-- 모든 사용자 확인
SELECT id, username, email, role
FROM users
ORDER BY created_at DESC;
```

**결과 예시:**
```
id                  | username    | email
--------------------|-------------|------------------
abc-123-def         | NULL        | user@gmail.com
xyz-456-ghi         | testuser    | test@example.com
```

### 2단계: 본인 이메일 찾기

```sql
-- 이메일로 검색
SELECT username, email 
FROM users 
WHERE email LIKE '%gmail%';  -- 본인 이메일 일부
```

### 3단계: username 설정

**방법 A: 이메일로 username 설정**
```sql
UPDATE users 
SET username = 'wodnr990921'  -- 원하는 username
WHERE email = '본인이메일@gmail.com';  -- 본인 실제 이메일
```

**방법 B: 모든 사용자에게 username 자동 설정**
```sql
-- 이메일의 @ 앞부분을 username으로 설정
UPDATE users 
SET username = SPLIT_PART(email, '@', 1) 
WHERE username IS NULL OR username = '';
```

### 4단계: 확인

```sql
SELECT username, email 
FROM users 
WHERE email = '본인이메일@gmail.com';
```

결과:
```
username    | email
------------|------------------
wodnr990921 | 본인이메일@gmail.com
```

### 5단계: 다시 로그인

- **아이디**: `wodnr990921` (또는 확인한 username)
- **비밀번호**: `master2026exit`

✅ **이제 로그인됩니다!**

---

## 🔍 이메일 찾는 방법

### 방법 1: Supabase Dashboard

1. https://supabase.com 접속
2. Authentication > Users
3. 본인 계정 찾기
4. 이메일 확인

### 방법 2: SQL로 확인

```sql
-- 최근 생성된 사용자 확인
SELECT email, username, created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;

-- 구글 로그인 사용자 확인
SELECT u.email, u.username
FROM users u
JOIN auth.users au ON u.id = au.id
WHERE au.raw_app_meta_data->>'provider' = 'google';
```

---

## 💡 빠른 해결책

### 옵션 1: 이메일 알 때

```sql
-- 1. 본인 이메일로 확인
SELECT username, email FROM users WHERE email = '본인이메일';

-- 2. username 설정
UPDATE users SET username = 'wodnr990921' WHERE email = '본인이메일';

-- 3. 확인
SELECT username FROM users WHERE email = '본인이메일';
```

### 옵션 2: 이메일 모를 때

```sql
-- 1. 모든 사용자 확인
SELECT email, username, created_at 
FROM users 
ORDER BY created_at DESC;

-- 2. 본인 이메일 찾기
-- 3. 위 옵션 1 실행
```

### 옵션 3: 첫 번째 사용자로 로그인

```sql
-- 가장 먼저 생성된 사용자 확인
SELECT username, email 
FROM users 
ORDER BY created_at ASC 
LIMIT 1;

-- username이 NULL이면 설정
UPDATE users 
SET username = 'admin' 
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
```

그 다음:
- **아이디**: `admin`
- **비밀번호**: `master2026exit`

---

## 🎯 체크리스트

- [ ] Supabase SQL Editor 열기
- [ ] `SELECT * FROM users;` 실행
- [ ] 본인 이메일 찾기
- [ ] username 확인
- [ ] username이 NULL이면 설정
- [ ] 로그인 재시도

---

## 📋 자주 묻는 질문

### Q: username과 email의 차이?
- **email**: 구글 로그인 시 사용한 이메일 (변경 불가)
- **username**: 로그인 아이디 (변경 가능, 직접 설정 필요)

### Q: username이 NULL이면?
데이터베이스에 username이 설정되지 않은 것입니다. SQL로 설정하세요.

### Q: 여러 계정이 있으면?
가장 최근에 만든 계정 또는 본인이 사용하는 이메일을 찾아서 설정하세요.

---

## 🚀 지금 바로 실행

```sql
-- Supabase SQL Editor에서 실행

-- 1단계: 확인
SELECT email, username FROM users ORDER BY created_at DESC;

-- 2단계: 본인 이메일 찾기
-- (위 결과에서 본인 이메일 확인)

-- 3단계: username 설정
UPDATE users 
SET username = 'wodnr990921' 
WHERE email = '여기에_본인_이메일_입력';

-- 4단계: 다시 확인
SELECT username, email FROM users WHERE username = 'wodnr990921';
```

**이제 로그인하세요!** 🎉

---

## 🆘 여전히 안 되면

터미널 로그 확인:
```
🔑 마스터 비밀번호 사용: wodnr990921
아이디를 찾을 수 없습니다
```

이 오류가 뜨면 username이 데이터베이스에 없는 것입니다.
위의 SQL을 실행해서 username을 설정하세요!
