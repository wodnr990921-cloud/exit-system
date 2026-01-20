# 🔧 크롤링/동기화 문제 해결 가이드

## 🚨 문제: "크롤링이 안돼네"

### 📋 체크리스트

#### 1️⃣ 개발 서버 실행 확인

```powershell
# 터미널에서 확인
Get-Process -Name node -ErrorAction SilentlyContinue
```

**서버가 실행되지 않았다면:**
```bash
# 새 터미널 열기
npm run dev

# 또는
npm run dev -- --port 3000
```

---

#### 2️⃣ 환경 변수 확인

**`.env.local` 파일 확인:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ODDS_API_KEY=your_odds_api_key  # ⚠️ 필수!
```

**The Odds API 키 발급:**
1. https://the-odds-api.com/ 회원가입
2. Account → API Keys 메뉴
3. API 키 복사
4. `.env.local`에 붙여넣기
5. **서버 재시작 필수!**

---

#### 3️⃣ Supabase 테이블 확인

**필수 테이블:**
- ✅ `sports_matches` - 경기 데이터
- ✅ `odds_history` - 배당 변동 이력 (선택)
- ✅ `team_mapping` - 팀 이름 매핑 (국내 리그용)

**실행 순서:**
```sql
-- Supabase SQL Editor에서 실행
1. schema_sports_matches.sql      -- 경기 테이블
2. schema_odds_history.sql        -- 배당 히스토리
3. schema_team_mapping.sql        -- 팀 매핑 (국내 리그)
```

---

#### 4️⃣ API 테스트

**PowerShell로 테스트:**
```powershell
# 자동 진단 스크립트
.\test-sync.ps1

# 또는 수동 테스트
Invoke-RestMethod -Uri "http://localhost:3000/api/sync-odds-api"
```

**curl로 테스트:**
```bash
curl http://localhost:3000/api/sync-odds-api
```

---

## 🐛 일반적인 오류 및 해결

### ❌ 오류 1: "ODDS_API_KEY가 설정되지 않았습니다"

```json
{
  "success": false,
  "error": "ODDS_API_KEY가 설정되지 않았습니다."
}
```

**해결:**
1. `.env.local` 파일에 `ODDS_API_KEY` 추가
2. **서버 재시작** (`Ctrl+C` 후 `npm run dev`)
3. 다시 테스트

---

### ❌ 오류 2: "relation sports_matches does not exist"

```json
{
  "error": "relation \"sports_matches\" does not exist"
}
```

**해결:**
```sql
-- Supabase SQL Editor에서 실행
-- 파일: schema_sports_matches.sql
DROP TABLE IF EXISTS sports_matches CASCADE;
CREATE TABLE sports_matches (...);
```

---

### ❌ 오류 3: "The Odds API 오류: 401"

```json
{
  "error": "The Odds API 오류: 401 Unauthorized"
}
```

**원인:**
- API 키가 잘못됨
- API 키가 만료됨
- 사용량 초과

**해결:**
1. https://the-odds-api.com/account/ 접속
2. API 키 상태 확인
3. 새 API 키 발급
4. `.env.local` 업데이트

---

### ❌ 오류 4: "Failed to fetch"

```
Error: Failed to fetch
```

**원인:**
- 개발 서버가 실행되지 않음
- 포트 충돌

**해결:**
```bash
# 포트 사용 확인
netstat -ano | findstr :3000

# 다른 포트로 실행
npm run dev -- --port 3001
```

---

### ❌ 오류 5: "배당 데이터 로딩 오류"

**배팅 업무 화면에서:**
```
배팅 데이터 로딩 오류: {}
```

**해결:**
```sql
-- Supabase SQL Editor에서 실행
-- 파일: schema_migration_complete.sql
-- 배팅 관련 컬럼 추가
ALTER TABLE task_items ADD COLUMN match_id TEXT;
ALTER TABLE task_items ADD COLUMN betting_choice TEXT;
...
```

---

## 🔍 로그 확인 방법

### 1. 브라우저 콘솔
```
F12 → Console 탭
```

### 2. 서버 로그
```bash
# 터미널에서 npm run dev 실행 중인 곳에서 확인
```

### 3. Vercel Logs (프로덕션)
```bash
vercel logs --follow
```

---

## ✅ 정상 작동 확인

### 1. API 응답
```json
{
  "success": true,
  "message": "멀티 리그 동기화 완료",
  "stats": {
    "total": 247,
    "leagues": {
      "K리그1": 12,
      "EPL": 38,
      "라리가": 32,
      "NBA": 45
    },
    "oddsChanges": 18
  },
  "duration": "3421ms"
}
```

### 2. Supabase 데이터 확인
```sql
SELECT COUNT(*) FROM sports_matches;
-- 결과: 247 (또는 0 이상의 숫자)

SELECT sport_key, COUNT(*) 
FROM sports_matches 
WHERE is_finished = false
GROUP BY sport_key;
-- 리그별 경기 수 확인
```

### 3. 배팅 업무 화면
1. `/dashboard/sports` 접속
2. "경기 일정" 탭 클릭
3. "전체 일정 불러오기" 버튼 클릭
4. 경기 목록이 표시되는지 확인

---

## 🆘 그래도 안 되면?

### 단계별 완전 초기화

#### 1. 서버 완전 종료
```bash
# 모든 Node 프로세스 종료
taskkill /F /IM node.exe

# 또는 Ctrl+C 여러 번
```

#### 2. 캐시 삭제
```bash
# .next 폴더 삭제
Remove-Item -Recurse -Force .next

# node_modules 재설치 (선택)
Remove-Item -Recurse -Force node_modules
npm install
```

#### 3. 환경 변수 재확인
```bash
# .env.local 파일 확인
Get-Content .env.local
```

#### 4. 데이터베이스 재생성
```sql
-- Supabase SQL Editor
DROP TABLE IF EXISTS sports_matches CASCADE;
DROP TABLE IF EXISTS odds_history CASCADE;

-- 다시 생성
-- schema_sports_matches.sql 실행
-- schema_odds_history.sql 실행
```

#### 5. 서버 재시작
```bash
npm run dev
```

#### 6. 테스트
```powershell
.\test-sync.ps1
```

---

## 📞 추가 지원

### 로그 수집
문제가 계속되면 다음 정보를 수집하세요:

1. **브라우저 콘솔 로그** (F12)
2. **서버 터미널 로그**
3. **API 응답**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/sync-odds-api" | ConvertTo-Json -Depth 10
```

4. **환경 확인**:
```powershell
node --version
npm --version
```

5. **Supabase 테이블 확인**:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

---

## 💡 팁

### API 사용량 절약
```typescript
// 7일 필터를 3일로 줄이기
function shouldSkipOldMatch(commenceTime: string): boolean {
  return daysDiff > 3; // 7 → 3
}
```

### 특정 리그만 동기화
```typescript
// src/app/api/sync-odds-api/route.ts
const LEAGUES = [
  { key: 'soccer_korea_kleague_1', name: 'K리그1' },
  { key: 'soccer_epl', name: 'EPL' },
  // 나머지 주석 처리
];
```

### 수동 동기화 (Cron 없이)
```bash
# 개발 중에는 수동으로 호출
curl http://localhost:3000/api/sync-odds-api
```

---

**문제가 해결되지 않으면 위의 로그들을 함께 공유해주세요!** 🙏
