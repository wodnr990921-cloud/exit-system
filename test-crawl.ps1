# 크롤링 테스트 스크립트 (PowerShell)
# 사용법: .\test-crawl.ps1

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "크롤링 테스트 스크립트" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"

# 1. Dummy 방식 테스트 (가장 간단)
Write-Host "[1/3] Dummy 데이터 생성 테스트..." -ForegroundColor Yellow
try {
    $body = @{
        method = "dummy"
        league = "KBO"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/sports/crawl/simple" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    if ($response.success) {
        Write-Host "✅ 성공! $($response.data.Count)개 경기 생성" -ForegroundColor Green
        $response.data | ForEach-Object {
            Write-Host "  - $($_.awayTeam) vs $($_.homeTeam) ($($_.status))"
        }
    } else {
        Write-Host "❌ 실패: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 에러: $_" -ForegroundColor Red
}

Write-Host ""

# 2. API 방식 테스트
Write-Host "[2/3] 공개 API 테스트..." -ForegroundColor Yellow
try {
    $body = @{
        method = "api"
        league = "KBO"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/sports/crawl/simple" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    if ($response.success) {
        Write-Host "✅ 성공! $($response.data.Count)개 경기 가져옴" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 경고: $($response.error)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ API 연결 실패 (정상일 수 있음)" -ForegroundColor Yellow
}

Write-Host ""

# 3. Cheerio 방식 테스트
Write-Host "[3/3] Cheerio HTML 파싱 테스트..." -ForegroundColor Yellow
try {
    $body = @{
        method = "cheerio"
        url = "https://sports.news.naver.com/kbaseball/schedule/index"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/sports/crawl/simple" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body

    if ($response.success) {
        Write-Host "✅ 성공! $($response.data.Count)개 경기 크롤링" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 경고: $($response.error)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ 네이버 접속 실패 (정상일 수 있음)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "테스트 완료!" -ForegroundColor Cyan
Write-Host "권장: Dummy 방식부터 사용하세요" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
