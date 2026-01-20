# 🚀 Vercel 배포 가이드

## 📋 배포 전 체크리스트

### 1️⃣ 필수 환경 변수

Vercel Dashboard에서 설정해야 할 환경 변수들:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# The Odds API (스포츠 배당)
ODDS_API_KEY=your_odds_api_key

# API-Volleyball (선택사항 - KOVO 데이터)
VOLLEYBALL_API_KEY=your_volleyball_api_key

# API-Basketball (선택사항 - KBL/WKBL 데이터)
BASKETBALL_API_KEY=your_basketball_api_key
```

---

## 🔧 배포 단계

### 1단계: Vercel CLI 설치 (완료 ✅)

```bash
npm install -g vercel
```

### 2단계: Vercel 로그인

```bash
vercel login
```

**브라우저가 열리면:**
1. Vercel 계정으로 로그인
2. 터미널에서 인증 확인 대기

### 3단계: 프로젝트 연결

```bash
vercel link
```

**질문에 답변:**
```
? Set up and deploy? [Y/n] Y
? Which scope? [your-account]
? Link to existing project? [y/N] N (처음) 또는 Y (기존 프로젝트)
? What's your project's name? exit-system
? In which directory is your code located? ./
```

### 4단계: 환경 변수 다운로드

```bash
vercel env pull .env.local
```

**주의:** 기존 `.env.local` 파일이 덮어씌워지므로 백업 권장!

### 5단계: 환경 변수 업로드 (Vercel에 추가)

```bash
# .env.local 파일을 Vercel에 업로드
vercel env add ODDS_API_KEY
# 프롬프트에서 값 입력

# 또는 파일에서 일괄 업로드
vercel env pull
```

### 6단계: 배포

```bash
# 프로덕션 배포
vercel --prod

# 미리보기 배포 (테스트용)
vercel
```

---

## 🤖 AI Gateway 설정 (선택사항)

### AI Gateway란?

Vercel의 AI Gateway는 OpenAI, Anthropic 등의 AI API 요청을 관리하는 기능입니다.

**우리 프로젝트에서는 필요 없습니다!** ❌

이유:
- The Odds API는 AI가 아닌 스포츠 데이터 API
- Supabase는 AI 서비스가 아님
- AI 기능을 사용하지 않음

### AI Gateway 경고 무시하는 방법

1. **Vercel Dashboard** 접속
2. **프로젝트 선택**
3. **Settings** → **AI Gateway**
4. **Skip** 또는 **Disable** 클릭

---

## 🌐 Vercel Dashboard에서 환경 변수 설정

### 방법 1: UI로 설정 (권장)

1. **Vercel Dashboard** → **프로젝트 선택**
2. **Settings** → **Environment Variables**
3. **Add** 버튼 클릭
4. 각 환경 변수 입력:
   - Key: `ODDS_API_KEY`
   - Value: `실제_API_키`
   - Environments: `Production`, `Preview`, `Development` 모두 체크
5. **Save** 클릭

### 방법 2: CLI로 설정

```bash
# 개별 추가
vercel env add ODDS_API_KEY production

# .env 파일에서 일괄 추가
cat .env.local | while read line; do
  if [[ $line =~ ^([^=]+)=(.+)$ ]]; then
    vercel env add ${BASH_REMATCH[1]} production
  fi
done
```

---

## 🔄 Cron Job 설정 (자동 동기화)

`vercel.json` 파일이 자동으로 적용됩니다:

```json
{
  "crons": [
    {
      "path": "/api/sync-sports",
      "schedule": "0 0,5,12 * * *"
    },
    {
      "path": "/api/sync-domestic",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/sync-odds-api",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

**Vercel Pro 플랜 이상 필요!** ⚠️

무료 플랜에서는 Cron Job을 사용할 수 없습니다.

---

## 🧪 배포 테스트

### 1. 배포 URL 확인

```bash
vercel inspect
```

**출력 예시:**
```
https://exit-system-abc123.vercel.app
```

### 2. API 테스트

```powershell
# 스포츠 동기화 테스트
Invoke-RestMethod -Uri "https://exit-system-abc123.vercel.app/api/sync-odds-api"

# 경기 일정 조회
Invoke-RestMethod -Uri "https://exit-system-abc123.vercel.app/api/sports/schedule"
```

### 3. 브라우저에서 확인

```
https://exit-system-abc123.vercel.app/dashboard/sports
```

---

## 📊 배포 후 모니터링

### Vercel Logs

```bash
# 실시간 로그 확인
vercel logs --follow

# 특정 배포 로그
vercel logs [deployment-url]
```

### Supabase 데이터 확인

```sql
-- 스포츠 경기 데이터 확인
SELECT COUNT(*) FROM sports_matches;

-- 최근 동기화 시간
SELECT MAX(updated_at) FROM sports_matches;

-- 리그별 경기 수
SELECT sport_key, COUNT(*) 
FROM sports_matches 
GROUP BY sport_key;
```

---

## 🐛 배포 오류 해결

### 오류 1: "Build failed"

**원인:** TypeScript 컴파일 오류

**해결:**
```bash
# 로컬에서 빌드 테스트
npm run build

# 오류 수정 후 다시 배포
vercel --prod
```

### 오류 2: "Environment variable not found"

**원인:** 환경 변수 미설정

**해결:**
1. Vercel Dashboard → Settings → Environment Variables
2. 누락된 변수 추가
3. **Redeploy** 클릭

### 오류 3: "API 호출 실패"

**원인:** CORS, API 키 문제

**해결:**
```bash
# 로그 확인
vercel logs --follow

# API 키 재확인
vercel env ls
```

---

## 🔒 보안 설정

### 1. 환경 변수 보호

```bash
# 민감한 정보는 절대 Git에 커밋하지 마세요!
.env.local
.env*.local
```

### 2. Vercel 환경 분리

- **Production**: 실제 서비스용
- **Preview**: PR 테스트용
- **Development**: 로컬 개발용

각 환경마다 다른 API 키 사용 권장!

### 3. Supabase RLS 정책

프로덕션 배포 전에 RLS 정책 강화:

```sql
-- 개발용 (현재)
CREATE POLICY "allow_all" ON sports_matches
  FOR ALL USING (true);

-- 프로덕션용 (변경 필요)
CREATE POLICY "authenticated_only" ON sports_matches
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## 📈 성능 최적화

### 1. Edge Functions 활용

Vercel Edge Functions는 전 세계 CDN에서 실행:

```typescript
// API를 Edge Runtime으로 변경
export const runtime = 'edge';
```

### 2. 이미지 최적화

```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['ijokjxmzyvonjpiosffu.supabase.co'],
  },
};
```

### 3. API 응답 캐싱

```typescript
// 경기 일정 캐싱 (10분)
export const revalidate = 600;
```

---

## 🎯 배포 체크리스트

```
□ Vercel CLI 설치 완료
□ vercel login 완료
□ vercel link 완료
□ 환경 변수 설정 완료 (Dashboard 또는 CLI)
□ vercel --prod 실행
□ 배포 URL 확인
□ API 테스트 완료
□ 브라우저에서 동작 확인
□ Cron Job 설정 (Pro 플랜)
□ 로그 모니터링 설정
```

---

## 🆘 도움말

### Vercel 문서

- **공식 문서**: https://vercel.com/docs
- **Next.js on Vercel**: https://vercel.com/docs/frameworks/nextjs
- **Cron Jobs**: https://vercel.com/docs/cron-jobs

### 자주 묻는 질문

**Q: AI Gateway는 꼭 설정해야 하나요?**
A: 아니요! 우리 프로젝트는 AI를 사용하지 않으므로 불필요합니다.

**Q: 무료 플랜으로 배포 가능한가요?**
A: 네! 단, Cron Job은 Pro 플랜 이상에서만 사용 가능합니다.

**Q: 환경 변수를 변경했는데 반영이 안 돼요.**
A: Vercel Dashboard에서 **Redeploy** 버튼을 클릭하세요.

**Q: 배포 후 오류가 발생해요.**
A: `vercel logs --follow`로 실시간 로그를 확인하세요.

---

## 🎉 배포 완료!

배포가 성공하면:
1. ✅ 프로덕션 URL 확인
2. ✅ /dashboard/sports 접속
3. ✅ 경기 일정 불러오기 테스트
4. ✅ 배팅 기능 테스트
5. ✅ Vercel Logs 모니터링

**축하합니다! 이제 전 세계에서 접속 가능합니다!** 🌍🎊
