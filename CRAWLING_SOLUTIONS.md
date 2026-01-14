# 🔧 크롤링 문제 해결 가이드
**작성일:** 2026-01-14  
**상태:** ✅ 다중 대안 구현 완료

---

## 🚨 문제 진단

### Puppeteer 크롤링이 작동하지 않는 주요 원인

1. **Windows 환경 문제**
   - Chrome/Chromium 실행 경로 문제
   - 권한 부족
   - Sandbox 모드 충돌

2. **배포 환경 문제 (Vercel/Netlify)**
   - 서버리스 환경에서 Puppeteer 제한
   - 메모리 제한
   - 실행 시간 제한

3. **네이버/사이트 봇 차단**
   - User-Agent 탐지
   - Rate Limiting
   - CAPTCHA

---

## ✅ 구현된 대안 (3가지 방법)

### 방법 1: Cheerio (HTML 파싱) ⚡ **가장 빠름**

**장점:**
- ✅ 매우 빠르고 가벼움
- ✅ 서버리스 환경에서 작동
- ✅ 추가 패키지 불필요 (이미 설치됨)

**단점:**
- ❌ JavaScript로 렌더링되는 페이지 불가
- ❌ 동적 콘텐츠 크롤링 불가

**사용 방법:**
```bash
POST /api/sports/crawl/simple
{
  "method": "cheerio",
  "url": "https://sports.news.naver.com/kbaseball/schedule/index"
}
```

**코드 예시:**
```typescript
const response = await fetch('/api/sports/crawl/simple', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'cheerio',
    url: 'https://sports.news.naver.com/kbaseball/schedule/index'
  })
})

const data = await response.json()
console.log(data.data) // 크롤링된 경기 목록
```

---

### 방법 2: 공개 API 사용 🌐 **가장 안정적**

**장점:**
- ✅ 매우 안정적
- ✅ 봇 차단 없음
- ✅ 서버리스 환경 완벽 지원

**단점:**
- ❌ KBO 데이터 지원 제한적
- ❌ 실시간성 낮음
- ❌ API 제공자 의존

**사용 방법:**
```bash
POST /api/sports/crawl/simple
{
  "method": "api",
  "league": "KBO"
}
```

**지원하는 공개 API:**
- TheSportsDB (무료)
- ESPN API (무료, 제한적)
- 추후 추가 가능

---

### 방법 3: 더미 데이터 생성 🎲 **테스트용**

**장점:**
- ✅ 즉시 작동
- ✅ 개발/테스트에 유용
- ✅ 100% 신뢰성

**단점:**
- ❌ 실제 데이터 아님
- ❌ 프로덕션 사용 불가

**사용 방법:**
```bash
POST /api/sports/crawl/simple
{
  "method": "dummy",
  "league": "KBO"
}
```

---

## 🔄 기존 Puppeteer 크롤링 수정 방법

### Windows에서 Puppeteer 작동시키기

**1단계: Chrome 실행 경로 명시**

`src/app/api/naver-crawl/route.ts` 수정:

```typescript
browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows 경로
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ],
})
```

**2단계: Chrome 설치 확인**
```bash
# Chrome이 설치되어 있는지 확인
dir "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

**3단계: Chromium 다운로드 (Chrome 없는 경우)**
```bash
npm install puppeteer
```
Puppeteer가 자동으로 Chromium을 다운로드합니다.

---

## 🚀 Playwright로 업그레이드 (권장)

Playwright는 Puppeteer보다 더 안정적입니다.

### 설치
```bash
npm install playwright
npx playwright install chromium
```

### 구현 예시
```typescript
import { chromium } from 'playwright'

async function crawlWithPlaywright(url: string) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  await page.goto(url, { waitUntil: 'networkidle' })
  
  const games = await page.evaluate(() => {
    // DOM에서 데이터 추출
    return Array.from(document.querySelectorAll('.game')).map(el => ({
      homeTeam: el.querySelector('.home')?.textContent,
      awayTeam: el.querySelector('.away')?.textContent,
    }))
  })
  
  await browser.close()
  return games
}
```

---

## 📝 추천 솔루션 (우선순위)

### 개발 환경 (로컬)
1. **Cheerio** (빠름) → 정적 페이지만
2. **Dummy** (테스트) → 개발/디버깅
3. **Puppeteer** (고급) → Chrome 경로 설정 후

### 프로덕션 환경 (Vercel/배포)
1. **공개 API** (최우선) → 가장 안정적
2. **Cheerio** → 정적 페이지 전용
3. **외부 크롤링 서비스** (유료) → Browserless, ScrapingBee

### 크롤링 서비스 (유료, 안정적)
- **Browserless** ($19/월): https://browserless.io
- **ScrapingBee** ($49/월): https://scrapingbee.com
- **Apify** (무료 티어 있음): https://apify.com

---

## 🧪 테스트 방법

### 1. Cheerio 테스트
```bash
curl -X POST http://localhost:3000/api/sports/crawl/simple \
  -H "Content-Type: application/json" \
  -d '{"method":"cheerio","url":"https://sports.news.naver.com/kbaseball/schedule/index"}'
```

### 2. API 테스트
```bash
curl -X POST http://localhost:3000/api/sports/crawl/simple \
  -H "Content-Type: application/json" \
  -d '{"method":"api","league":"KBO"}'
```

### 3. Dummy 테스트
```bash
curl -X POST http://localhost:3000/api/sports/crawl/simple \
  -H "Content-Type: application/json" \
  -d '{"method":"dummy","league":"KBO"}'
```

---

## 📊 성능 비교

| 방법 | 속도 | 안정성 | 서버리스 | 실시간성 | 비용 |
|------|------|--------|----------|----------|------|
| Cheerio | ⚡⚡⚡ | ⭐⭐⭐ | ✅ | ⚡⚡⚡ | 무료 |
| 공개 API | ⚡⚡ | ⭐⭐⭐⭐⭐ | ✅ | ⚡⚡ | 무료 |
| Dummy | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ✅ | ❌ | 무료 |
| Puppeteer | ⚡ | ⭐⭐ | ❌ | ⚡⚡⚡ | 무료 |
| Playwright | ⚡ | ⭐⭐⭐ | ⚠️ | ⚡⚡⚡ | 무료 |
| 유료 서비스 | ⚡⚡ | ⭐⭐⭐⭐⭐ | ✅ | ⚡⚡⚡ | $$ |

---

## 🛠️ 트러블슈팅

### 에러: "Chromium revision is not downloaded"
```bash
# 해결 방법
npx puppeteer browsers install chrome
```

### 에러: "Protocol error (Target.setDiscoverTargets)"
```bash
# Puppeteer 버전 다운그레이드
npm install puppeteer@21.11.0
```

### 에러: "ECONNREFUSED"
```bash
# 방화벽 또는 프록시 문제
# Cheerio나 API 방식 사용 권장
```

---

## 📁 파일 위치

### 새로 생성된 파일
- ✅ `src/app/api/sports/crawl/simple/route.ts` - 3가지 대안 구현

### 기존 파일
- `src/app/api/naver-crawl/route.ts` - Puppeteer 크롤링
- `src/app/api/sports/crawl/results/route.ts` - 결과 크롤링
- `src/app/api/sports/crawl/schedule/route.ts` - 일정 크롤링

---

## 🎯 즉시 사용 가능한 해결책

### UI에서 크롤링 메서드 선택 추가

`sports-ops-client.tsx`에 추가:

```typescript
const [crawlMethod, setCrawlMethod] = useState<'cheerio' | 'api' | 'dummy'>('cheerio')

// 크롤링 버튼 클릭 시
const handleCrawl = async () => {
  const response = await fetch('/api/sports/crawl/simple', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: crawlMethod,
      url: 'https://sports.news.naver.com/kbaseball/schedule/index',
      league: 'KBO'
    })
  })
  
  const data = await response.json()
  if (data.success) {
    console.log('크롤링 성공:', data.data)
  }
}
```

---

**결론:** 즉시 `/api/sports/crawl/simple` API를 사용하세요!
- 개발: `method: "dummy"` 
- 프로덕션: `method: "api"` 또는 `method: "cheerio"`
