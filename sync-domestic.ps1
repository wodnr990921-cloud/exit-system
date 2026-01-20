# 국내 리그 통합 동기화 API 테스트 스크립트
# 사용법: .\sync-domestic.ps1

$ErrorActionPreference = "Stop"

Write-Host "🏀 국내 리그 동기화 API 테스트 시작..." -ForegroundColor Cyan
Write-Host ""

# API 엔드포인트
$baseUrl = "http://localhost:3000"
if ($env:VERCEL_URL) {
    $baseUrl = "https://$env:VERCEL_URL"
}

$endpoint = "$baseUrl/api/sync-domestic"

Write-Host "📡 API 호출 중: $endpoint" -ForegroundColor Yellow
Write-Host ""

try {
    $startTime = Get-Date
    
    $response = Invoke-RestMethod -Uri $endpoint -Method Get -ContentType "application/json"
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    Write-Host "✅ 동기화 성공!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 통계:" -ForegroundColor Cyan
    Write-Host "  - 총 경기: $($response.stats.total)개" -ForegroundColor White
    Write-Host "  - K-리그: $($response.stats.kleague)개" -ForegroundColor White
    Write-Host "  - KOVO: $($response.stats.kovo)개" -ForegroundColor White
    Write-Host "  - KBL/WKBL: $($response.stats.kbl)개" -ForegroundColor White
    Write-Host "  - 저장 성공: $($response.stats.saved)개" -ForegroundColor Green
    Write-Host "  - 저장 실패: $($response.stats.failed)개" -ForegroundColor $(if ($response.stats.failed -gt 0) { "Red" } else { "Gray" })
    Write-Host ""
    Write-Host "⏱️  소요 시간: $([math]::Round($duration, 2))ms" -ForegroundColor Yellow
    Write-Host "🕐 타임스탬프: $($response.timestamp)" -ForegroundColor Gray
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
