# The Odds API 멀티 리그 동기화 테스트 스크립트
# 사용법: .\sync-odds-api.ps1

$ErrorActionPreference = "Stop"

Write-Host "⚽ The Odds API 멀티 리그 동기화 테스트..." -ForegroundColor Cyan
Write-Host ""

# API 엔드포인트
$baseUrl = "http://localhost:3000"
if ($env:VERCEL_URL) {
    $baseUrl = "https://$env:VERCEL_URL"
}

$endpoint = "$baseUrl/api/sync-odds-api"

Write-Host "📡 API 호출 중: $endpoint" -ForegroundColor Yellow
Write-Host ""

try {
    $startTime = Get-Date
    
    $response = Invoke-RestMethod -Uri $endpoint -Method Get -ContentType "application/json"
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    Write-Host "✅ 동기화 성공!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 통계:" -ForegroundColor Cyan
    Write-Host "  - 총 경기: $($response.stats.total)개" -ForegroundColor White
    
    if ($response.stats.leagues) {
        Write-Host ""
        Write-Host "  리그별 경기 수:" -ForegroundColor Yellow
        foreach ($league in $response.stats.leagues.PSObject.Properties) {
            Write-Host "    • $($league.Name): $($league.Value)개" -ForegroundColor White
        }
    }
    
    Write-Host ""
    Write-Host "  - 저장 성공: $($response.stats.saved)개" -ForegroundColor Green
    Write-Host "  - 저장 실패: $($response.stats.failed)개" -ForegroundColor $(if ($response.stats.failed -gt 0) { "Red" } else { "Gray" })
    Write-Host ""
    Write-Host "⏱️  소요 시간: $([math]::Round($duration, 2))초" -ForegroundColor Yellow
    Write-Host "🕐 타임스탬프: $($response.timestamp) (KST)" -ForegroundColor Gray
    Write-Host "🔑 API 키: $($response.apiKey)" -ForegroundColor Gray
    Write-Host ""
    
    # 전체 응답 출력 (디버깅용)
    Write-Host "📄 전체 응답:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    
} catch {
    Write-Host "❌ 동기화 실패!" -ForegroundColor Red
    Write-Host ""
    Write-Host "오류 메시지:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host ""
    
    if ($_.ErrorDetails) {
        Write-Host "오류 상세:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
    
    exit 1
}

Write-Host ""
Write-Host "✨ 테스트 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 팁:" -ForegroundColor Cyan
Write-Host "  - The Odds API 사용량 확인: https://the-odds-api.com/account/" -ForegroundColor Gray
Write-Host "  - Supabase 데이터 확인: sports_matches 테이블 조회" -ForegroundColor Gray
