# 환경 변수 설정 가이드

## 필수 환경 변수

직원 계정 등록 등의 관리자 기능을 사용하려면 **Service Role Key**가 필요합니다.

### 1. Supabase 대시보드에서 키 확인

1. Supabase 프로젝트 대시보드 접속
2. **Settings** > **API** 메뉴로 이동
3. 다음 값들을 확인:

```
Project URL: https://xxxxx.supabase.co
anon public: eyJhbGc...
service_role: eyJhbGc... ⚠️ 이것이 필요합니다!
```

### 2. 로컬 개발 환경 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (anon public 키)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (service_role 키)
```

### 3. Vercel 배포 환경 설정

1. Vercel 대시보드 > 프로젝트 선택
2. **Settings** > **Environment Variables** 메뉴
3. 다음 변수들을 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` (anon 키) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (service_role 키) | Production, Preview, Development |

4. **Save** 클릭
5. **Redeploy** 클릭하여 새로운 환경 변수로 재배포

### 4. 확인

환경 변수가 제대로 설정되었는지 확인:

```bash
# 로컬에서 개발 서버 실행
npm run dev

# 직원 등록 기능 테스트
# 설정 > 직원 관리 > 직원 추가
```

## ⚠️ 보안 주의사항

- **Service Role Key는 절대 클라이언트에 노출하지 마세요!**
- `.env.local` 파일은 `.gitignore`에 포함되어 있으므로 Git에 커밋되지 않습니다
- Service Role Key는 모든 데이터베이스 권한을 가지므로 신중하게 관리해야 합니다
- 실수로 노출된 경우 즉시 Supabase 대시보드에서 재생성하세요

## 문제 해결

### "service role key가 설정되지 않았습니다" 오류

1. `.env.local` 파일에 `SUPABASE_SERVICE_ROLE_KEY`가 있는지 확인
2. 개발 서버를 재시작 (`npm run dev` 종료 후 다시 실행)
3. Vercel의 경우 환경 변수 설정 후 Redeploy

### "Permission denied" 오류

- Service Role Key가 아닌 anon key를 사용한 경우
- 키를 확인하고 올바른 service_role 키를 사용하세요
