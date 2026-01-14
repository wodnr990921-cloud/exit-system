# K리그1 스포츠 데이터 동기화 시스템

The Odds API를 사용하여 K리그1 경기 데이터를 자동으로 Supabase와 동기화합니다.

## 🚀 빠른 시작

### 1. 환경 변수 설정

`.env.local` 파일에 The Odds API 키를 추가하세요:

```bash
ODDS_API_KEY=your-api-key-here
```

### 2. 데이터베이스 마이그레이션

Supabase SQL Editor에서 `schema_migration_sports_v2.sql` 파일을 실행하세요.

### 3. 동기화 실행

#### 로컬 테스트 (PowerShell)
```powershell
.\sync-sports.ps1
```

#### 수동 API 호출
```bash
curl http://localhost:3000/api/sync-sports
```

#### 브라우저에서
```
http://localhost:3000/api/sync-sports
```

## 📊 동기화 내용

### 가져오는 데이터

1. **배당률 (Odds)**
   - 경기 ID, 팀명, 시작 시간
   - 홈승/무승부/원정승 배당률
   - 예정된 경기 목록

2. **경기 결과 (Scores)**
   - 최근 3일간 완료된 경기
   - 최종 스코어
   - 경기 종료 상태

### 데이터 병합 방식

- **신규 경기**: 모든 정보를 새로 추가
- **기존 경기**: 배당률과 스코어만 업데이트
- **중복 방지**: API의 고유 ID를 사용하여 자동 처리

## ⏰ 자동화 설정

### Vercel Cron Jobs (프로덕션)

`vercel.json`에 이미 설정되어 있습니다:

```json
{
  "crons": [
    {
      "path": "/api/sync-sports",
      "schedule": "0 0,5,12 * * *"
    }
  ]
}
```

**실행 시간**: 매일 0시, 5시, 12시 (KST 기준)
- Vercel 배포 후 자동 작동
- 별도 설정 불필요

### Windows 작업 스케줄러

1. 작업 스케줄러 열기
2. "기본 작업 만들기" 선택
3. 트리거: 매일 특정 시간
4. 작업: 프로그램 시작
   - 프로그램: `powershell.exe`
   - 인수: `-File "C:\path\to\project\sync-sports.ps1"`

## 📋 API 응답 예시

### 성공 응답

```json
{
  "success": true,
  "message": "스포츠 데이터 동기화 완료",
  "data": {
    "total": 15,
    "scheduled": 10,
    "completed": 5,
    "duration": 1234
  },
  "timestamp": "2026-01-14 15:30:45"
}
```

### 실패 응답

```json
{
  "error": "ODDS_API_KEY가 설정되지 않았습니다"
}
```

## 🗂️ 데이터베이스 구조

### sports_matches 테이블

| 필드 | 타입 | 설명 |
|------|------|------|
| id | TEXT | API 고유 경기 ID (PRIMARY KEY) |
| sport_key | TEXT | 종목 키 (soccer_korea_kleague_1) |
| commence_time | TIMESTAMPTZ | 경기 시작 시간 (KST) |
| home_team | TEXT | 홈팀 이름 |
| away_team | TEXT | 원정팀 이름 |
| odds_home | FLOAT | 홈승 배당률 |
| odds_draw | FLOAT | 무승부 배당률 |
| odds_away | FLOAT | 원정승 배당률 |
| home_score | INTEGER | 홈팀 득점 |
| away_score | INTEGER | 원정팀 득점 |
| is_finished | BOOLEAN | 경기 종료 여부 |
| updated_at | TIMESTAMPTZ | 최종 업데이트 시간 |

### 데이터 예시

```sql
-- 예정된 경기
SELECT * FROM sports_matches 
WHERE is_finished = false 
ORDER BY commence_time;

-- 완료된 경기
SELECT * FROM sports_matches 
WHERE is_finished = true 
ORDER BY commence_time DESC;

-- 오늘 경기
SELECT * FROM sports_matches 
WHERE DATE(commence_time AT TIME ZONE 'Asia/Seoul') = CURRENT_DATE
ORDER BY commence_time;
```

## 🔍 로그 및 디버깅

### 콘솔 로그

API는 다음과 같은 로그를 출력합니다:

```
[Sync Sports] 동기화 시작: soccer_korea_kleague_1
[Sync Sports] 배당률 API 호출...
[Sync Sports] 배당률 데이터: 10개 경기
[Sync Sports] 결과 API 호출...
[Sync Sports] 결과 데이터: 5개 경기
[Sync Sports] Supabase에 15개 경기 저장 중...
[Sync Sports] 완료! (1234ms)
```

### Vercel 로그 확인

1. Vercel 대시보드 접속
2. 프로젝트 선택
3. **Logs** 탭 클릭
4. 함수 실행 로그 확인

## ⚠️ 주의사항

### API 사용량 제한

**The Odds API 무료 플랜**
- 월 500회 요청 제한
- 현재 설정: 하루 3회 × 30일 = 월 90회
- 여유 있음 ✅

**초과 방지 팁**
- 불필요한 수동 호출 자제
- 스케줄 간격 조정 고려
- API 사용량 대시보드 정기 확인

### 시간대 처리

- API는 UTC 시간으로 제공
- 데이터베이스는 TIMESTAMPTZ로 저장
- 조회 시 `AT TIME ZONE 'Asia/Seoul'` 사용

```sql
-- KST로 조회
SELECT 
  home_team,
  away_team,
  commence_time AT TIME ZONE 'Asia/Seoul' as 경기시간_KST
FROM sports_matches;
```

### 환경 변수 (Vercel)

배포 전 Vercel 환경 변수 추가 필수:

1. Settings → Environment Variables
2. `ODDS_API_KEY` 추가
3. All Environments 선택

## 🛠️ 문제 해결

### "ODDS_API_KEY가 설정되지 않았습니다"

✅ **해결 방법**
- 로컬: `.env.local` 파일 확인 후 서버 재시작
- Vercel: Environment Variables에 키 추가

### "Odds API 오류: 401"

✅ **해결 방법**
- API 키가 유효한지 확인
- The Odds API 계정 상태 확인

### "데이터베이스 저장 실패"

✅ **해결 방법**
- Supabase 테이블이 존재하는지 확인
- RLS 정책이 올바른지 확인
- 서버 로그에서 상세 에러 확인

### Cron이 실행되지 않음

✅ **해결 방법**
- Vercel Hobby 플랜 이상 필요
- Settings → Cron에서 활성화 상태 확인
- 로그에서 에러 메시지 확인

## 📚 관련 문서

- [The Odds API 공식 문서](https://the-odds-api.com/liveapi/guides/v4/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Supabase PostgreSQL](https://supabase.com/docs/guides/database)

## 📞 지원

문제가 발생하면:
1. 로그 확인 (콘솔 또는 Vercel)
2. 환경 변수 확인
3. API 할당량 확인
4. 데이터베이스 연결 확인

---

**마지막 업데이트**: 2026-01-14
