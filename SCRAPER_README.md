# 🎰 베트맨/라이브스코어 크롤링 스크립트

Python + Playwright를 사용한 스포츠 배팅 데이터 자동 수집 시스템

## 📋 기능

- ✅ **베트맨(betman.co.kr)** 프로토 승부식 경기 데이터 수집
  - 경기 시간, 종목, 팀명
  - 승/무/패 배당률
  - 핸디캡 정보
  
- ✅ **라이브스코어(livescore.co.kr)** 경기 일정 및 결과
  - 오늘의 경기 일정
  - 실시간 점수
  - 경기 상태 (예정/진행중/종료)

- ✅ **자동 팀명 매칭** (fuzzywuzzy)
  - 토트넘 ↔ 토트넘홋스퍼 자동 매칭
  - 유사도 기반 스마트 매칭

- ✅ **Supabase 자동 저장**
  - Upsert 로직으로 중복 방지
  - 실시간 데이터 업데이트

---

## 🚀 설치 및 실행

### 1️⃣ 자동 설치 (PowerShell)

```powershell
.\setup-scraper.ps1
```

### 2️⃣ 수동 설치

```bash
# 1. 가상환경 생성
python -m venv venv

# 2. 가상환경 활성화 (Windows)
.\venv\Scripts\Activate.ps1

# 3. 의존성 설치
pip install -r requirements-scraper.txt

# 4. Playwright 브라우저 설치
playwright install chromium
```

### 3️⃣ Supabase 테이블 생성

Supabase SQL Editor에서 실행:

\`\`\`sql
CREATE TABLE IF NOT EXISTS sports_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_time TEXT,
    sport TEXT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    odds_home FLOAT,
    odds_draw FLOAT,
    odds_away FLOAT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'scheduled',
    source TEXT DEFAULT 'betman',
    match_score FLOAT DEFAULT 0,
    scraped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(home_team, away_team, match_time)
);

CREATE INDEX IF NOT EXISTS idx_sports_matches_teams ON sports_matches(home_team, away_team);
CREATE INDEX IF NOT EXISTS idx_sports_matches_status ON sports_matches(status);
CREATE INDEX IF NOT EXISTS idx_sports_matches_time ON sports_matches(match_time);
\`\`\`

### 4️⃣ 환경 변수 확인

`.env.local` 파일에 다음 변수가 있는지 확인:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5️⃣ 실행

```bash
# 가상환경 활성화 (이미 활성화되어 있다면 생략)
.\venv\Scripts\Activate.ps1

# 스크립트 실행
python scraper.py
```

---

## 🔧 설정

### `scraper.py` 상단 설정

```python
HEADLESS = False  # True: 백그라운드, False: 브라우저 보임
BETMAN_URL = "https://www.betman.co.kr/main.do"
LIVESCORE_URL = "https://www.livescore.co.kr/"
```

### 팀명 매칭 임계값

```python
def match_team_names(name1: str, name2: str, threshold: int = 80):
    # threshold 값 조정 (70-90 권장)
```

---

## 📊 출력 예시

```
============================================================
🚀 베트맨/라이브스코어 크롤링 시작
============================================================
✅ Supabase 클라이언트 초기화 완료
🎰 베트맨 크롤링 시작...
✅ 15개 경기 발견 (셀렉터: .game-list tr.game-row)
  📋 1. 맨체스터시티 vs 리버풀
  📋 2. 토트넘 vs 첼시
✅ 베트맨 크롤링 완료: 15개 경기
⚽ 라이브스코어 크롤링 시작...
✅ 22개 경기 발견 (셀렉터: .match-row)
✅ 라이브스코어 크롤링 완료: 22개 경기
🔗 경기 데이터 매칭 시작...
  ✅ 매칭: 맨체스터시티 vs 리버풀 (유사도: 95.0%)
  ✅ 매칭: 토트넘 vs 첼시 (유사도: 88.5%)
✅ 매칭 완료: 15개 경기
💾 Supabase 저장 시작...
✅ Supabase 저장 완료: 15개 성공, 0개 실패
============================================================
✅ 크롤링 완료!
  • 베트맨: 15개
  • 라이브스코어: 22개
  • 저장: 15개 성공, 0개 실패
  • 소요 시간: 45.3초
============================================================
```

---

## 🤖 자동화 (선택사항)

### Windows 작업 스케줄러

1. **작업 스케줄러** 열기 (Win + R → `taskschd.msc`)
2. **작업 만들기**
3. **트리거**: 매일 오전 9시, 오후 3시
4. **작업**: 
   ```
   Program: C:\Users\User\exit system\venv\Scripts\python.exe
   Arguments: C:\Users\User\exit system\scraper.py
   Start in: C:\Users\User\exit system
   ```

---

## 🐛 트러블슈팅

### 1. "Module not found" 에러

```bash
# 가상환경이 활성화되었는지 확인
.\venv\Scripts\Activate.ps1

# 의존성 재설치
pip install -r requirements-scraper.txt
```

### 2. "Supabase 환경 변수가 설정되지 않았습니다"

`.env.local` 파일을 확인하고, 프로젝트 루트에 있는지 확인

### 3. "경기를 찾지 못했습니다"

- `betman_debug.png` / `livescore_debug.png` 스크린샷 확인
- 사이트 구조가 변경되었을 수 있음 → 셀렉터 업데이트 필요
- `HEADLESS = False`로 설정하고 직접 확인

### 4. Playwright 브라우저 설치 오류

```bash
playwright install chromium --force
```

---

## 📝 로그 확인

크롤링 로그는 `scraper.log` 파일에 저장됩니다:

```bash
cat scraper.log
# 또는
type scraper.log
```

---

## ⚠️ 주의사항

1. **법적 책임**: 크롤링은 사이트 이용약관을 준수해야 합니다
2. **Rate Limiting**: 과도한 요청은 IP 차단될 수 있습니다
3. **사이트 변경**: 사이트 구조가 변경되면 셀렉터 업데이트 필요
4. **개인정보**: 크롤링 데이터는 개인적 용도로만 사용하세요

---

## 🔗 관련 문서

- [Playwright 문서](https://playwright.dev/python/)
- [Supabase Python 문서](https://supabase.com/docs/reference/python/introduction)
- [FuzzyWuzzy 문서](https://github.com/seatgeek/fuzzywuzzy)

---

## 📞 문의

문제가 발생하면 `scraper.log` 파일과 함께 문의하세요.
