# 스포츠 데이터 자동 업데이트 API 가이드

## API 엔드포인트

`GET /api/update-sports`

## 기능

K리그1 경기 데이터를 The Odds API에서 가져와 자동으로 업데이트합니다.

### 가져오는 데이터

1. **예정된 경기 (Odds)**
   - 경기 일정
   - 배당률 (홈승, 무승부, 원정승)

2. **완료된 경기 (Scores)**
   - 최근 3일간의 경기 결과
   - 최종 스코어

## 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```bash
# The Odds API 키
ODDS_API_KEY=your-odds-api-key-here
```

## 사용 방법

### cURL로 호출

```bash
curl -X GET "http://localhost:3000/api/update-sports"
```

### JavaScript/TypeScript에서 사용

```typescript
const response = await fetch('/api/update-sports')
const result = await response.json()
console.log(result)
```

## 응답 예시

### 성공 시

```json
{
  "success": true,
  "message": "스포츠 데이터가 성공적으로 업데이트되었습니다",
  "updated": 15,
  "scheduled": 10,
  "completed": 5
}
```

- `updated`: 총 업데이트된 경기 수
- `scheduled`: 예정된 경기 수
- `completed`: 완료된 경기 수

### 실패 시

```json
{
  "error": "ODDS_API_KEY가 설정되지 않았습니다"
}
```

## 자동화 설정

### 🚀 Vercel Cron Jobs (추천 - 프로덕션)

`vercel.json` 파일에 이미 설정되어 있습니다:

```json
{
  "crons": [
    {
      "path": "/api/update-sports",
      "schedule": "0 0,5,12 * * *"
    }
  ]
}
```

**스케줄**: 매일 오전 0시, 5시, 정오 12시(KST 기준)
- Vercel에 배포하면 자동으로 작동합니다
- 별도 설정 불필요
- 무료 플랜에서도 사용 가능

### Windows PowerShell (작업 스케줄러)

제공된 `update-sports.ps1` 스크립트 사용:

```powershell
.\update-sports.ps1
```

### Linux/Mac (Cron)

```bash
# 매일 오전 6시, 정오, 오후 6시에 실행
0 6,12,18 * * * curl -X GET "http://localhost:3000/api/update-sports" >> /var/log/sports-update.log 2>&1
```

### Node.js 스케줄러

```javascript
// scripts/schedule-sports-update.js
const cron = require('node-cron')

// 매 6시간마다 실행
cron.schedule('0 */6 * * *', async () => {
  console.log('스포츠 데이터 업데이트 시작...')
  
  const response = await fetch('http://localhost:3000/api/update-sports')
  
  const result = await response.json()
  console.log('업데이트 완료:', result)
})
```

## 데이터베이스 스키마

업데이트되는 `sports_matches` 테이블 구조:

```sql
CREATE TABLE sports_matches (
  id TEXT PRIMARY KEY,               -- API에서 제공하는 고유 경기 ID
  sport_key TEXT,                    -- 종목 (예: soccer_korea_kleague_1)
  commence_time TIMESTAMP WITH TIME ZONE, -- 경기 시작 시간
  home_team TEXT,                    -- 홈팀 이름
  away_team TEXT,                    -- 원정팀 이름
  
  -- 배당률 (가장 대표적인 업체 1곳 기준)
  odds_home FLOAT,                   -- 홈팀 승 배당
  odds_draw FLOAT,                   -- 무승부 배당
  odds_away FLOAT,                   -- 원정팀 승 배당
  
  -- 경기 결과 (결과가 나오면 업데이트)
  home_score INTEGER DEFAULT NULL,
  away_score INTEGER DEFAULT NULL,
  is_finished BOOLEAN DEFAULT FALSE, -- 경기 종료 여부
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 주요 필드 설명
- `id`: The Odds API에서 제공하는 고유 경기 ID (자동 중복 방지)
- `is_finished`: `false` = 예정된 경기, `true` = 완료된 경기
- `commence_time`: ISO 8601 형식의 경기 시작 시간 (타임존 포함)

## 주의사항

1. **API 사용량 제한**: The Odds API는 무료 플랜에서 월 500회 요청 제한이 있습니다.
   - 현재 설정: 하루 3회 × 30일 = 월 90회 (충분히 안전)
   - 너무 자주 호출하지 마세요

2. **Vercel Cron Jobs**: 
   - Vercel에 배포 후 자동으로 작동
   - Vercel 대시보드 → Settings → Cron에서 실행 로그 확인 가능
   - `ODDS_API_KEY` 환경 변수를 Vercel에도 추가해야 함

3. **보안**: `ODDS_API_KEY`는 절대 공개 저장소에 커밋하지 마세요. `.env.local`은 `.gitignore`에 포함되어 있습니다.

4. **데이터 중복**: API에서 제공하는 고유 `id`를 PRIMARY KEY로 사용하여 자동으로 중복 방지됩니다.

5. **데이터 병합**: 같은 경기의 배당률과 결과를 자동으로 병합하여 저장합니다.

6. **에러 처리**: API 호출 실패 시 로그를 확인하고 재시도하세요.

## The Odds API 정보

- 공식 사이트: https://the-odds-api.com/
- 무료 플랜: 월 500 요청
- 지원 스포츠: `soccer_korea_kleague_1` (K리그1)
- API 문서: https://the-odds-api.com/liveapi/guides/v4/

## 문제 해결

### "ODDS_API_KEY가 설정되지 않았습니다"
- 로컬: `.env.local` 파일에 `ODDS_API_KEY`가 있는지 확인 후 서버 재시작
- Vercel: Settings → Environment Variables에 `ODDS_API_KEY` 추가 필요

### Vercel Cron이 작동하지 않음
- Vercel 대시보드 → Settings → Cron에서 활성화 상태 확인
- 환경 변수 `ODDS_API_KEY`가 Vercel에 추가되었는지 확인
- Logs 탭에서 에러 메시지 확인
- 무료 플랜은 일일 실행 횟수 제한 있음 (현재 설정은 하루 3회로 안전)

### 데이터가 업데이트되지 않음
- The Odds API 할당량이 남아있는지 확인
- API 키가 유효한지 확인
- 네트워크 연결 확인

### API 응답이 없음
- 서버가 실행 중인지 확인 (`npm run dev`)
- 포트가 올바른지 확인 (기본: 3000)
