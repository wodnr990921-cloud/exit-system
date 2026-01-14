# 베트맨/라이브스코어 크롤링 스크립트 설정

Write-Host "=== 베트맨/라이브스코어 크롤링 스크립트 설정 ===" -ForegroundColor Cyan

# 1. Python 설치 확인
Write-Host "`n[1] Python 버전 확인..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version
    Write-Host "✅ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python이 설치되지 않았습니다!" -ForegroundColor Red
    Write-Host "Python 3.8 이상을 설치하세요: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# 2. 가상환경 생성
Write-Host "`n[2] 가상환경 생성..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "✅ 가상환경이 이미 존재합니다." -ForegroundColor Green
} else {
    python -m venv venv
    Write-Host "✅ 가상환경 생성 완료" -ForegroundColor Green
}

# 3. 가상환경 활성화
Write-Host "`n[3] 가상환경 활성화..." -ForegroundColor Yellow
.\venv\Scripts\Activate.ps1
Write-Host "✅ 가상환경 활성화됨" -ForegroundColor Green

# 4. 의존성 설치
Write-Host "`n[4] 의존성 설치 중..." -ForegroundColor Yellow
pip install -r requirements-scraper.txt
Write-Host "✅ 의존성 설치 완료" -ForegroundColor Green

# 5. Playwright 브라우저 설치
Write-Host "`n[5] Playwright 브라우저 설치 중..." -ForegroundColor Yellow
playwright install chromium
Write-Host "✅ Chromium 브라우저 설치 완료" -ForegroundColor Green

# 6. Supabase 테이블 생성 SQL 출력
Write-Host "`n[6] Supabase 테이블 생성 SQL:" -ForegroundColor Yellow
Write-Host @"

-- Supabase SQL Editor에서 실행하세요:

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

"@ -ForegroundColor Cyan

Write-Host "`n=== 설정 완료! ===" -ForegroundColor Green
Write-Host "`n실행 방법:" -ForegroundColor Yellow
Write-Host "  1. 가상환경 활성화: .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  2. 스크립트 실행: python scraper.py" -ForegroundColor White
Write-Host "`n주의사항:" -ForegroundColor Yellow
Write-Host "  • .env.local 파일에 Supabase 정보가 있는지 확인하세요" -ForegroundColor White
Write-Host "  • 위의 SQL을 Supabase에서 실행하세요" -ForegroundColor White
