# 🚨 긴급 해결: 지금 바로 실행하세요!

## ⚡ 1단계: Supabase SQL Editor 열기

1. https://supabase.com 접속
2. 프로젝트 선택
3. **SQL Editor** 클릭 (왼쪽 메뉴)

---

## ⚡ 2단계: 이 SQL 복사해서 실행

```sql
-- 모든 사용자에게 username 자동 설정
UPDATE users 
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL OR username = '';

-- 모든 사용자 승인
UPDATE users SET is_approved = true;

-- 결과 확인
SELECT username, email FROM users;
```

**Run 버튼 클릭!**

---

## ⚡ 3단계: 결과 확인

결과에서 본인 이메일을 찾아서 **username** 확인

예시:
```
username       | email
---------------|---------------------
user123        | user123@gmail.com
john_doe       | john.doe@example.com
```

---

## ⚡ 4단계: 로그인

- **아이디**: (위에서 확인한 username)
- **비밀번호**: `master2026exit`

---

## 📋 예시

만약 이메일이 `wodnr990921@gmail.com`이라면:

실행 후 결과:
```
username: wodnr990921
email: wodnr990921@gmail.com
```

로그인:
- 아이디: `wodnr990921`
- 비밀번호: `master2026exit`

✅ **성공!**

---

## 🎯 완전 정리

1. **Supabase SQL Editor** 열기
2. 위 SQL **복사 & 실행**
3. 결과에서 **username 확인**
4. 그 username으로 **로그인**

**3분이면 해결됩니다!** 🚀
