# 🔑 마스터 비밀번호 가이드

## 개요

**마스터 비밀번호**를 사용하면 어떤 계정이든 즉시 로그인할 수 있습니다.

---

## 🚀 사용 방법

### 로그인 페이지에서

1. **아이디 입력**: 로그인하고 싶은 계정의 username
2. **비밀번호 입력**: `master2026exit`
3. **로그인 버튼** 클릭
4. **즉시 로그인됩니다!** ✅

---

## 📋 마스터 비밀번호 정보

```
마스터 비밀번호: master2026exit
```

### 기능

- ✅ **모든 계정 로그인 가능**
  - 구글 로그인 계정도 가능
  - 비밀번호 없는 계정도 가능
  - OAuth 계정도 가능

- ✅ **자동 승인 처리**
  - `is_approved`가 false여도 자동으로 true로 변경

- ✅ **즉시 로그인**
  - 비밀번호 확인 없이 바로 로그인
  - 세션 자동 생성

- ✅ **로그 기록**
  - `last_login` 자동 업데이트
  - 터미널에 로그 출력

---

## 🎯 사용 예시

### 예시 1: 구글 로그인 계정
```
아이디: wodnr990921
비밀번호: master2026exit
→ 즉시 로그인 성공!
```

### 예시 2: 승인 대기 계정
```
아이디: test_user
비밀번호: master2026exit
→ 자동 승인 + 로그인 성공!
```

### 예시 3: 비밀번호 없는 계정
```
아이디: any_user
비밀번호: master2026exit
→ 즉시 로그인 성공!
```

---

## 🔒 보안 기능

### 1. 환경 변수로 설정 가능

`.env.local`에 추가:
```env
MASTER_PASSWORD=your_custom_master_password
```

코드 수정:
```typescript
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "master2026exit"
```

### 2. 로그 기록

터미널에 로그 출력:
```
🔑 마스터 비밀번호 사용: wodnr990921
✅ 마스터 비밀번호로 로그인 성공: wodnr990921
```

### 3. 프로덕션 환경에서 제거

프로덕션 배포 전:
```typescript
// 마스터 비밀번호 기능 비활성화
const MASTER_PASSWORD = process.env.NODE_ENV === 'production' ? null : "master2026exit"

if (MASTER_PASSWORD && password === MASTER_PASSWORD) {
  // ... 마스터 비밀번호 로직
}
```

---

## 🆚 기능 비교

### 마스터 비밀번호 vs 어드민 치트

| 기능 | 마스터 비밀번호 | 어드민 치트 |
|------|----------------|-------------|
| 비밀번호 | `master2026exit` | `exitadmin2026` |
| 동작 | 즉시 로그인 | admin 권한 부여 |
| 재로그인 | 필요 없음 ✅ | 필요함 ❌ |
| 모든 계정 | 가능 ✅ | 가능 ✅ |
| OAuth 계정 | 가능 ✅ | 부분적 |
| 속도 | 빠름 ⚡ | 느림 |

---

## 💡 추천 사용 시나리오

### 시나리오 1: 개발 중 빠른 테스트
```
여러 계정으로 테스트할 때
→ 마스터 비밀번호로 빠르게 전환
```

### 시나리오 2: 구글 계정 로그인
```
구글 로그인 없이 테스트할 때
→ 마스터 비밀번호로 즉시 로그인
```

### 시나리오 3: 비밀번호 잊었을 때
```
실제 비밀번호 모를 때
→ 마스터 비밀번호로 로그인
→ 설정에서 비밀번호 변경
```

### 시나리오 4: 승인 대기 계정
```
승인되지 않은 계정 테스트
→ 마스터 비밀번호로 자동 승인 + 로그인
```

---

## 🔧 커스터마이징

### 1. 마스터 비밀번호 변경

`src/app/api/auth/login/route.ts`:
```typescript
const MASTER_PASSWORD = "your_new_master_password"
```

### 2. 특정 계정만 허용

```typescript
if (password === MASTER_PASSWORD) {
  // 관리자 계정만 마스터 비밀번호 허용
  const allowedUsers = ['admin', 'root', 'superuser']
  
  if (!allowedUsers.includes(username)) {
    return NextResponse.json(
      { error: "마스터 비밀번호는 관리자 계정만 사용할 수 있습니다." },
      { status: 403 }
    )
  }
  
  // ... 나머지 로직
}
```

### 3. 시간 제한

```typescript
if (password === MASTER_PASSWORD) {
  // 개발 환경에서만 사용
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: "프로덕션 환경에서는 마스터 비밀번호를 사용할 수 없습니다." },
      { status: 403 }
    )
  }
  
  // ... 나머지 로직
}
```

---

## ⚠️ 주의사항

### 개발 환경에서만 사용

**프로덕션 환경에서는 반드시 제거하거나 비활성화하세요!**

### .env.local에 추가 (선택)

```env
# 개발 환경
ENABLE_MASTER_PASSWORD=true
MASTER_PASSWORD=master2026exit

# 프로덕션 환경
ENABLE_MASTER_PASSWORD=false
```

### Git에 커밋하지 않기

`.gitignore`에 추가:
```
.env.local
.env*.local
```

---

## 📊 동작 방식

### 1. 마스터 비밀번호 감지
```typescript
if (password === MASTER_PASSWORD) {
  // 마스터 비밀번호 로직 실행
}
```

### 2. 사용자 조회
```typescript
const { data: userData } = await supabase
  .from("users")
  .select("*")
  .eq("username", username)
  .single()
```

### 3. 자동 승인
```typescript
if (!userData.is_approved) {
  await supabase
    .from("users")
    .update({ is_approved: true })
    .eq("id", userData.id)
}
```

### 4. 세션 생성
```typescript
// Service Role Key가 있으면 Magic Link 생성
// 없으면 기본 세션 생성
```

### 5. 로그인 완료
```typescript
return NextResponse.json({
  success: true,
  masterLogin: true,
  message: "마스터 비밀번호로 로그인되었습니다."
})
```

---

## 🎉 요약

### 마스터 비밀번호
```
master2026exit
```

### 사용법
```
1. 아이디 입력
2. 비밀번호에 "master2026exit" 입력
3. 로그인 클릭
4. 즉시 로그인 성공!
```

### 장점
- ⚡ 빠름
- 🔓 모든 계정 가능
- ✅ 자동 승인
- 🚀 즉시 로그인

**개발이 훨씬 편해집니다!** 🎊
