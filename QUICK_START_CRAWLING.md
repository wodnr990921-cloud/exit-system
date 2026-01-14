# ⚡ 크롤링 빠른 시작 가이드
**즉시 사용 가능!**

---

## 🎯 가장 빠른 해결책

### ✅ 지금 바로 사용하기

**1단계: 개발 서버 실행 확인**
```bash
npm run dev
```

**2단계: 테스트 스크립트 실행**
```powershell
.\test-crawl.ps1
```

또는 수동 테스트:
```powershell
# Dummy 데이터 (100% 작동 보장)
curl -X POST http://localhost:3000/api/sports/crawl/simple `
  -H "Content-Type: application/json" `
  -d '{"method":"dummy","league":"KBO"}'
```

---

## 🚀 UI에서 바로 사용하기

### 배팅업무 페이지에서 크롤링

**파일:** `src/app/dashboard/sports/sports-ops-client.tsx`

기존 크롤링 코드를 찾아서 이렇게 수정:

```typescript
// 기존: Puppeteer (작동 안 함)
const response = await fetch("/api/naver-crawl", { ... })

// 새로운: Simple API (즉시 작동)
const response = await fetch("/api/sports/crawl/simple", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    method: "dummy",  // 또는 "api", "cheerio"
    league: "KBO"
  })
})

const data = await response.json()
if (data.success) {
  const games = data.data  // 경기 목록
  // 기존 로직에 games 사용
}
```

---

## 📝 3가지 방법 비교

| 방법 | 사용 시점 | 장점 | 단점 |
|------|----------|------|------|
| **dummy** | 개발/테스트 | 100% 작동, 빠름 | 실제 데이터 아님 |
| **api** | 프로덕션 | 안정적, 실제 데이터 | KBO 지원 제한적 |
| **cheerio** | 프로덕션 | 빠름, 실제 데이터 | 정적 페이지만 |

---

## ⚡ 즉시 적용 (Copy & Paste)

### 1. 간단한 크롤링 함수 추가

```typescript
// src/lib/crawl-helper.ts (새로 생성)
export async function simpleCrawl(method: 'dummy' | 'api' | 'cheerio' = 'dummy') {
  try {
    const response = await fetch('/api/sports/crawl/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        league: 'KBO',
        url: method === 'cheerio' 
          ? 'https://sports.news.naver.com/kbaseball/schedule/index'
          : undefined
      })
    })

    const data = await response.json()
    
    if (data.success) {
      return data.data  // 경기 목록 반환
    } else {
      console.error('크롤링 실패:', data.error)
      return []
    }
  } catch (error) {
    console.error('크롤링 에러:', error)
    return []
  }
}

// 사용 예시
const games = await simpleCrawl('dummy')
console.log(games)
```

### 2. 기존 컴포넌트에서 사용

```typescript
import { simpleCrawl } from '@/lib/crawl-helper'

// 버튼 클릭 시
const handleCrawl = async () => {
  setLoading(true)
  const games = await simpleCrawl('dummy')  // 먼저 dummy로 테스트
  
  if (games.length > 0) {
    // 성공! 게임 데이터 처리
    setGames(games)
    alert(`${games.length}개 경기를 가져왔습니다!`)
  } else {
    alert('크롤링 실패')
  }
  setLoading(false)
}
```

---

## 🎨 UI 개선: 크롤링 방식 선택

```tsx
// 드롭다운 추가
const [crawlMethod, setCrawlMethod] = useState<'dummy' | 'api' | 'cheerio'>('dummy')

<Select value={crawlMethod} onValueChange={setCrawlMethod}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="dummy">
      🎲 더미 데이터 (테스트용)
    </SelectItem>
    <SelectItem value="api">
      🌐 공개 API (안정적)
    </SelectItem>
    <SelectItem value="cheerio">
      ⚡ HTML 파싱 (빠름)
    </SelectItem>
  </SelectContent>
</Select>

<Button onClick={() => simpleCrawl(crawlMethod)}>
  크롤링 시작
</Button>
```

---

## 🔧 Puppeteer 수정 (선택사항)

Puppeteer를 계속 사용하고 싶다면:

### Windows에서 작동시키기

`src/app/api/naver-crawl/route.ts` 수정:

```typescript
// 46줄 근처
browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ],
})
```

`.env.local` 파일에 추가:
```
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

---

## 🧪 테스트 체크리스트

- [ ] `npm run dev` 실행 중
- [ ] `.\test-crawl.ps1` 실행 → 더미 데이터 성공
- [ ] 브라우저에서 `/api/sports/crawl/simple` GET 요청 → 200 응답
- [ ] UI에서 크롤링 버튼 클릭 → 데이터 로딩 성공

---

## 🚨 여전히 안 된다면?

### 1. 포트 확인
```powershell
# localhost:3000이 실행 중인지 확인
curl http://localhost:3000/api/sports/crawl/simple
```

### 2. 패키지 재설치
```bash
npm install
```

### 3. 캐시 삭제
```bash
rm -rf .next
npm run dev
```

### 4. 에러 로그 확인
브라우저 개발자 도구 (F12) → Console 탭

---

## 📞 지원

**문서:**
- `CRAWLING_SOLUTIONS.md` - 상세 가이드
- `QUICK_START_CRAWLING.md` - 이 문서

**API 엔드포인트:**
- `/api/sports/crawl/simple` - 새로운 간단한 API ✅
- `/api/naver-crawl` - 기존 Puppeteer API (문제 있음)

**추천 순서:**
1. `dummy` 방식으로 먼저 테스트
2. 작동하면 `api` 또는 `cheerio`로 변경
3. 안정화되면 프로덕션 배포

---

**결론:** 지금 당장 `method: "dummy"`를 사용하세요! 🎉
