# ✅ 최종 설정 체크리스트

## 🎉 거의 다 끝났습니다!

---

## 📋 완료된 작업

✅ GitHub에 푸시 완료 (5f6ff11)
✅ .env.local에 OPENAI_API_KEY 추가
✅ .env.local에 AI_GATEWAY_API_KEY 추가
✅ 20개 리그 스포츠 동기화 시스템
✅ 배당 변동 추적 시스템
✅ OpenAI 8개 API 확인
✅ 문서 작성 완료

---

## 🚀 마지막 단계: Vercel 환경 변수 설정

### 1단계: Vercel Dashboard 접속

```
https://vercel.com/dashboard
```

### 2단계: 프로젝트 선택

```
exit-system (또는 실제 프로젝트 이름) 클릭
```

### 3단계: 환경 변수 추가

```
Settings 탭 → Environment Variables 메뉴
```

### 4단계: 추가할 변수들

#### ✅ 이미 있는 것 (확인만)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

#### ⚠️ 추가 필요 (아직 없다면)

**1. OPENAI_API_KEY** (필수!)
```
Name: OPENAI_API_KEY
Value: sk-proj-xxxxx (실제 키 붙여넣기)
Environments: 
  ✅ Production
  ✅ Preview
  ✅ Development
```

**2. ODDS_API_KEY** (스포츠 배당)
```
Name: ODDS_API_KEY
Value: your_odds_api_key
Environments: 
  ✅ Production
  ✅ Preview
  ✅ Development
```

**3. AI_GATEWAY_API_KEY** (선택 - 비용 절감)
```
Name: AI_GATEWAY_API_KEY
Value: vck_6WVouQMO9wEMQwSKK8OUgTSFmmcFXXWJVY6q47TEVmtLP6FbvN0QCDKl
Environments: 
  ✅ Production
  ✅ Preview
  ✅ Development
```

**4. VOLLEYBALL_API_KEY** (선택 - KOVO)
```
Name: VOLLEYBALL_API_KEY
Value: your_volleyball_api_key (있다면)
Environments: 
  ✅ Production
```

**5. BASKETBALL_API_KEY** (선택 - KBL/WKBL)
```
Name: BASKETBALL_API_KEY
Value: your_basketball_api_key (있다면)
Environments: 
  ✅ Production
```

### 5단계: Redeploy

**환경 변수 추가 후:**
```
Deployments 탭
→ 최신 배포의 ... 메뉴
→ "Redeploy" 클릭
```

---

## 🔍 환경 변수 확인 방법

### Vercel Dashboard에서

```
Settings → Environment Variables

확인할 항목:
✅ NEXT_PUBLIC_SUPABASE_URL
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ OPENAI_API_KEY ← 필수!
✅ ODDS_API_KEY ← 필수!
✅ AI_GATEWAY_API_KEY ← 권장
```

### 로컬에서 (.env.local)

```bash
# PowerShell
Get-Content .env.local

# 또는
code .env.local
```

**예상 내용:**
```bash
NEXT_PUBLIC_SUPABASE_URL="https://ijokjxmzyvonjpiosffu.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
OPENAI_API_KEY="sk-proj-xxxxx"
ODDS_API_KEY="your_odds_api_key"
AI_GATEWAY_API_KEY="vck_6WVouQMO9wEMQwSKK8OUgTSFmmcFXXWJVY6q47TEVmtLP6FbvN0QCDKl"
```

---

## 🧪 배포 후 테스트

### 1. 배포 URL 확인

**Vercel Dashboard:**
```
Deployments 탭 → Visit 버튼
또는
Domains 탭 → 도메인 복사
```

예시: `https://exit-system.vercel.app`

### 2. 기본 접속 테스트

```powershell
# 브라우저에서
https://your-domain.vercel.app

# 로그인 테스트
https://your-domain.vercel.app/dashboard
```

### 3. 스포츠 API 테스트

```powershell
# 경기 일정 조회 (ODDS_API_KEY 확인)
Invoke-RestMethod -Uri "https://your-domain.vercel.app/api/sports/schedule"

# 스포츠 동기화 (ODDS_API_KEY 확인)
Invoke-RestMethod -Uri "https://your-domain.vercel.app/api/sync-odds-api"
```

**성공 응답:**
```json
{
  "success": true,
  "stats": {
    "total": 247,
    "leagues": {
      "K리그1": 12,
      "EPL": 38,
      ...
    }
  }
}
```

### 4. OpenAI API 테스트

```powershell
# 텍스트 요약 (OPENAI_API_KEY 확인)
Invoke-RestMethod -Uri "https://your-domain.vercel.app/api/summarize" `
  -Method POST `
  -Body '{"text":"긴 텍스트"}' `
  -ContentType "application/json"
```

### 5. 배팅 화면 테스트

```
브라우저:
https://your-domain.vercel.app/dashboard/sports

1. "경기 일정" 탭 클릭
2. "전체 일정 불러오기" 버튼 클릭
3. 20개 리그 경기 목록 확인
4. 리그 필터 드롭다운 확인
```

---

## 🐛 문제 해결

### 오류 1: "OPENAI_API_KEY가 설정되지 않았습니다"

**원인:** Vercel에 환경 변수 미설정

**해결:**
```
Vercel Dashboard
→ Settings → Environment Variables
→ Add: OPENAI_API_KEY
→ Redeploy
```

### 오류 2: "ODDS_API_KEY가 설정되지 않았습니다"

**원인:** The Odds API 키 없음

**해결:**
```
1. https://the-odds-api.com/ 회원가입
2. API 키 발급
3. Vercel에 추가
4. Redeploy
```

### 오류 3: "경기 일정이 비어있습니다"

**원인:** 아직 동기화 안 됨 또는 API 키 문제

**해결:**
```powershell
# 수동 동기화
Invoke-RestMethod -Uri "https://your-domain.vercel.app/api/sync-odds-api"

# 로그 확인
vercel logs --follow
```

### 오류 4: "Build failed"

**원인:** TypeScript 오류

**해결:**
```bash
# 로컬에서 빌드 테스트
npm run build

# 오류 수정 후
git add .
git commit -m "fix: Build errors"
git push origin master
```

---

## 📊 Vercel Cron Jobs 설정

### Pro 플랜 이상에서만 가능

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/sync-odds-api",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

**확인:**
```
Settings → Cron Jobs 탭
→ Cron jobs 목록 확인
```

**무료 플랜:**
- Cron Jobs 사용 불가
- 수동 동기화만 가능

---

## 🎯 최종 확인 체크리스트

### Vercel 설정

```
□ Settings → Environment Variables
  □ NEXT_PUBLIC_SUPABASE_URL ✅
  □ NEXT_PUBLIC_SUPABASE_ANON_KEY ✅
  □ SUPABASE_SERVICE_ROLE_KEY ✅
  □ OPENAI_API_KEY ✅
  □ ODDS_API_KEY ✅
  □ AI_GATEWAY_API_KEY ✅

□ Deployments
  □ 최신 배포 상태: Ready ✅
  □ Build 성공 ✅

□ Domains
  □ 도메인 확인 ✅
```

### 기능 테스트

```
□ 로그인 가능 ✅
□ /dashboard/sports 접속 ✅
□ 경기 일정 불러오기 ✅
□ 20개 리그 표시 ✅
□ 리그 필터 작동 ✅
□ OpenAI 기능 (요약, OCR) ✅
```

---

## 🎉 완료!

모든 설정이 끝났습니다!

### 주요 URL

**GitHub:**
```
https://github.com/wodnr990921-cloud/exit-system
```

**Vercel:**
```
https://vercel.com/dashboard
https://exit-system.vercel.app (실제 도메인)
```

**Supabase:**
```
https://ijokjxmzyvonjpiosffu.supabase.co
```

### 일일 운영

**자동:**
- ✅ GitHub push → Vercel 자동 배포
- ✅ Cron Jobs (Pro 플랜)

**수동:**
- 경기 일정 불러오기: Dashboard → Sports → 경기 일정 탭
- 배당 동기화: `/api/sync-odds-api` 수동 호출
- 환경 변수 관리: Vercel Dashboard

---

## 📞 도움말

**문제 발생 시:**
1. Vercel Logs 확인: `vercel logs --follow`
2. 브라우저 콘솔 확인: F12
3. 환경 변수 재확인: Vercel Dashboard
4. Redeploy 시도: Deployments → Redeploy

**문서 참고:**
- `OPENAI_USAGE_REPORT.md` - OpenAI 사용 현황
- `ODDS_TRACKING_README.md` - 배당 추적 가이드
- `VERCEL_DEPLOYMENT.md` - Vercel 배포 가이드
- `TROUBLESHOOTING.md` - 문제 해결 가이드

---

**축하합니다! 모든 설정이 완료되었습니다!** 🎊🎉

**Vercel Dashboard에서 환경 변수만 추가하면 완전히 끝입니다!** 🚀✅
