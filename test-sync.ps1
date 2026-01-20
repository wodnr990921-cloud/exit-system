# 스포츠 동기화 테스트 스크립트
# 사용법: .\test-sync.ps1

$ErrorActionPreference = "Stop"

Write-Host "🔍 스포츠 동기화 테스트 시작..." -ForegroundColor Cyan
Write-Host ""

# 1. 개발 서버 확인
Write-Host "1️⃣ 개발 서버 확인 중..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ 개발 서버 실행 중 (localhost:3000)" -ForegroundColor Green
} catch {
    Write-Host "❌ 개발 서버가 실행되지 않았습니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "해결 방법:" -ForegroundColor Yellow
    Write-Host "  1. 새 터미널 열기" -ForegroundColor White
    Write-Host "  2. 실행: npm run dev" -ForegroundColor White
    Write-Host "  3. 이 스크립트 다시 실행" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""

# 2. 환경 변수 확인
Write-Host "2️⃣ 환경 변수 확인 중..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw
    
    if ($envContent -match "ODDS_API_KEY=(.+)") {
        $apiKey = $matches[1].Trim()
        if ($apiKey -and $apiKey -ne "your_odds_api_key") {
            Write-Host "✅ ODDS_API_KEY 설정됨" -ForegroundColor Green
        } else {
            Write-Host "⚠️  ODDS_API_KEY가 설정되지 않았습니다!" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "해결 방법:" -ForegroundColor Yellow
            Write-Host "  1. https://the-odds-api.com/ 회원가입" -ForegroundColor White
            Write-Host "  2. API 키 발급" -ForegroundColor White
            Write-Host "  3. .env.local 파일에 추가:" -ForegroundColor White
            Write-Host "     ODDS_API_KEY=your_actual_api_key" -ForegroundColor Gray
            Write-Host ""
        }
    } else {
        Write-Host "⚠️  .env.local에 ODDS_API_KEY가 없습니다!" -ForegroundColor Yellow
    }
    
    if ($envContent -match "NEXT_PUBLIC_SUPABASE_URL=(.+)") {
        Write-Host "✅ Supabase URL 설정됨" -ForegroundColor Green
    } else {
        Write-Host "❌ Supabase URL이 설정되지 않았습니다!" -ForegroundColor Red
    }
    
    if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY=(.+)") {
        Write-Host "✅ Supabase Service Role Key 설정됨" -ForegroundColor Green
    } else {
        Write-Host "❌ Supabase Service Role Key가 설정되지 않았습니다!" -ForegroundColor Red
    }
} else {
    Write-Host "❌ .env.local 파일이 없습니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "해결 방법:" -ForegroundColor Yellow
    Write-Host "  1. 프로젝트 루트에 .env.local 파일 생성" -ForegroundColor White
    Write-Host "  2. 다음 내용 추가:" -ForegroundColor White
    Write-Host ""
    Write-Host @"
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ODDS_API_KEY=your_odds_api_key
"@ -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""

# 3. API 테스트
Write-Host "3️⃣ 동기화 API 테스트 중..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/sync-odds-api" -Method Get -TimeoutSec 60
    
    if ($response.success) {
        Write-Host "✅ 동기화 성공!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 결과:" -ForegroundColor Cyan
        Write-Host "  총 경기: $($response.stats.total)개" -ForegroundColor White
        
        if ($response.stats.leagues) {
            Write-Host ""
            Write-Host "  리그별 경기 수:" -ForegroundColor Yellow
            foreach ($league in $response.stats.leagues.PSObject.Properties) {
                Write-Host "    • $($league.Name): $($league.Value)개" -ForegroundColor White
            }
        }
        
        Write-Host ""
        Write-Host "  배당 변동: $($response.stats.oddsChanges)건" -ForegroundColor Magenta
        Write-Host "  소요 시간: $($response.duration)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "✨ 이제 /dashboard/sports 에서 경기 일정을 확인할 수 있습니다!" -ForegroundColor Green
    } else {
        Write-Host "❌ 동기화 실패: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ API 호출 실패!" -ForegroundColor Red
    Write-Host ""
    Write-Host "오류 내용:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.ErrorDetails) {
        Write-Host "상세 오류:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "가능한 원인:" -ForegroundColor Yellow
    Write-Host "  1. ODDS_API_KEY가 유효하지 않음" -ForegroundColor White
    Write-Host "  2. Supabase 연결 실패" -ForegroundColor White
    Write-Host "  3. sports_matches 테이블 없음" -ForegroundColor White
    Write-Host ""
    Write-Host "해결 방법:" -ForegroundColor Yellow
    Write-Host "  1. .env.local 파일의 API 키 확인" -ForegroundColor White
    Write-Host "  2. Supabase에서 schema_sports_matches.sql 실행" -ForegroundColor White
    Write-Host "  3. 브라우저 콘솔 확인 (F12)" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
