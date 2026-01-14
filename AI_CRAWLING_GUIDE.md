# 🤖 AI 기반 스포츠 경기 크롤링

## 개요

OpenAI GPT를 사용해서 HTML을 분석하고 경기 정보를 자동으로 추출합니다.

### 장점 ✅
- **유연함**: 사이트 구조가 바뀌어도 AI가 자동으로 적응
- **다중 소스**: 여러 사이트에서 동시에 크롤링 가능
- **언어 무관**: 한국어, 영어, 일본어 등 모든 언어 지원
- **유지보수 최소화**: CSS 선택자나 DOM 구조를 신경 쓸 필요 없음

### 단점 ⚠️
- **비용**: API 호출마다 비용 발생 (하지만 매우 저렴)
- **속도**: 기존 크롤링보다 약간 느림 (하지만 충분히 빠름)

---

## 사용 방법

### 1️⃣ 단일 사이트 크롤링

```bash
POST /api/sports/crawl/ai
Content-Type: application/json

{
  "url": "https://sports.news.naver.com/kbaseball/schedule/index",
  "league": "KBO"
}
```

**응답:**
```json
{
  "success": true,
  "message": "AI 크롤링 완료: 15개 저장, 3개 업데이트, 0개 실패",
  "stats": {
    "total": 18,
    "saved": 15,
    "updated": 3,
    "errors": 0
  },
  "games": [...]
}
```

### 2️⃣ 다중 사이트 자동 크롤링

```bash
GET /api/sports/crawl/ai
```

**자동으로 크롤링하는 사이트:**
- 네이버 스포츠 (KBO)
- 다음 스포츠 (K리그)
- ESPN (EPL)

---

## 지원 사이트 추가

### 새로운 리그 추가하기

`route.ts`의 `GET` 메서드에 추가:

```typescript
// MLB 추가 예시
try {
  const mlbResponse = await fetch(`${request.nextUrl.origin}/api/sports/crawl/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://www.mlb.com/schedule",
      league: "MLB",
    }),
  })
  const mlbData = await mlbResponse.json()
  results.push({ league: "MLB", ...mlbData })
} catch (error) {
  console.error("MLB 크롤링 실패:", error)
}
```

---

## 테스트

### PowerShell 스크립트

```powershell
# 단일 크롤링 테스트
$body = @{
    url = "https://sports.news.naver.com/kbaseball/schedule/index"
    league = "KBO"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/sports/crawl/ai" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

# 다중 크롤링 테스트
Invoke-RestMethod -Uri "http://localhost:3000/api/sports/crawl/ai" `
    -Method Get
```

---

## 비용 추정

### OpenAI API 비용

- 모델: `gpt-4o-mini`
- HTML 50,000자 처리 기준
- 비용: 약 **$0.0001 ~ $0.0005 per request** (매우 저렴!)

### 예상 월 비용

- 하루 3번 크롤링 (KBO, K리그, EPL)
- 월 90회 크롤링
- **월 비용: 약 $0.05 ~ $0.50** (50원 ~ 500원)

---

## 기존 크롤링과 비교

| 항목 | 기존 (Puppeteer) | AI 크롤링 |
|------|------------------|-----------|
| **성공률** | 낮음 (봇 감지) | 높음 ✅ |
| **유지보수** | 어려움 | 쉬움 ✅ |
| **속도** | 빠름 | 중간 |
| **비용** | 무료 | 매우 저렴 ($0.0005) |
| **유연성** | 낮음 | 높음 ✅ |
| **다중 소스** | 어려움 | 쉬움 ✅ |

---

## 트러블슈팅

### 1. "경기 정보를 찾을 수 없습니다"

**원인**: HTML 구조가 예상과 다름
**해결**: 다른 URL 시도 또는 AI 프롬프트 조정

### 2. "API 호출 실패"

**원인**: OpenAI API 키 문제
**해결**: `.env.local`에서 `OPENAI_API_KEY` 확인

### 3. 느린 응답 속도

**원인**: HTML이 너무 큼 (50KB 초과)
**해결**: `html.substring(0, 50000)` 값 조정

---

## 자동화 설정

### 매일 자동 크롤링

`cron` 또는 Vercel Cron Jobs 사용:

```typescript
// api/cron/sports-crawl/route.ts
export async function GET() {
  const response = await fetch("https://your-domain.com/api/sports/crawl/ai")
  return Response.json(await response.json())
}
```

**Vercel에서 설정:**
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/sports-crawl",
    "schedule": "0 9,15,21 * * *"  // 매일 오전 9시, 오후 3시, 9시
  }]
}
```

---

## 결론

AI 크롤링은 **가장 실용적이고 안정적인 해결책**입니다:

✅ 높은 성공률  
✅ 낮은 유지보수 비용  
✅ 매우 저렴한 운영 비용  
✅ 여러 사이트 지원  
✅ 언어 무관  

**추천**: 기존 크롤링이 실패하면 AI 크롤링으로 대체하세요!
