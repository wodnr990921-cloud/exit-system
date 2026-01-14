# AI 크롤링 테스트 스크립트
# 사용법: .\test-ai-crawl.ps1

$baseUrl = "http://localhost:3000"  # 로컬 테스트용
# $baseUrl = "https://www.manager-exit.cloud"  # 프로덕션용 (주석 해제)

Write-Host "=== AI 스포츠 크롤링 테스트 ===" -ForegroundColor Cyan

# 1. 다중 사이트 자동 크롤링 (추천)
Write-Host "`n[1] 다중 사이트 자동 크롤링 (KBO, K리그, EPL)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sports/crawl/ai" -Method Get
    Write-Host "✅ 성공!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ 실패: $_" -ForegroundColor Red
}

# 2. 단일 사이트 크롤링 (KBO)
Write-Host "`n[2] KBO 경기 일정 크롤링..." -ForegroundColor Yellow
$body = @{
    url = "https://sports.news.naver.com/kbaseball/schedule/index"
    league = "KBO"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sports/crawl/ai" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    Write-Host "✅ 성공!" -ForegroundColor Green
    Write-Host "저장: $($response.stats.saved)개, 업데이트: $($response.stats.updated)개"
} catch {
    Write-Host "❌ 실패: $_" -ForegroundColor Red
}

Write-Host "`n=== 테스트 완료 ===" -ForegroundColor Cyan
Write-Host "`n데이터베이스를 확인하세요: Supabase > sports_games 테이블" -ForegroundColor Green
