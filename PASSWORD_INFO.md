# 비밀번호 정보

## 기본 비밀번호
SQL 스크립트로 설정된 기본 비밀번호: `exit2026`

SHA256 해시: `8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918`

## 마스터 비밀번호
모든 계정에서 사용 가능한 마스터 비밀번호: `master2026exit`

- 이 비밀번호로 모든 계정에 즉시 로그인 가능
- DB 승인 상태 무시
- 코드: `src/app/api/auth/login/route.ts`의 `MASTER_PASSWORD`

## 어드민 치트 코드
어드민 권한 부여: `exitadmin2026`

- 이 비밀번호로 로그인하면 자동으로 admin 역할 부여
- `is_approved`도 자동으로 true로 설정

## 로그인 순서

### 1번 방법: 마스터 비밀번호 (가장 빠름)
```
아이디: wodnr990921
비밀번호: master2026exit
```

### 2번 방법: 기본 비밀번호
```
1. SQL 스크립트 실행 (SETUP_PASSWORD_HASH.sql)
2. 로그인:
   아이디: wodnr990921
   비밀번호: exit2026
```

### 3번 방법: 임시 비밀번호
```
1. "비밀번호 찾기" 클릭
2. 아이디 입력
3. 임시 비밀번호 발급
4. 임시 비밀번호로 로그인
5. 새 비밀번호 설정
```

## SQL 실행 방법

1. Supabase Dashboard 접속
2. SQL Editor 선택
3. `SETUP_PASSWORD_HASH.sql` 내용 복사/붙여넣기
4. Run 버튼 클릭
