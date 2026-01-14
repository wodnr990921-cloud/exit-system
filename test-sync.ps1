# 스포츠 데이터 동기화 테스트
Write-Host "=== 스포츠 데이터 동기화 테스트 ===" -ForegroundColor Cyan
Write-Host ""

$url = "http://localhost:3000/api/sync-sports"

try {
    Write-Host "API 호출 중..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $url -Method Get
    
    if ($response.success) {
        Write-Host "✓ 동기화 성공!" -ForegroundColor Green
        Write-Host "  총 경기: $($response.data.total)개" -ForegroundColor White
        Write-Host "  예정: $($response.data.scheduled)개" -ForegroundColor Cyan
        Write-Host "  완료: $($response.data.completed)개" -ForegroundColor Magenta
    } else {
        Write-Host "✗ 실패: $($response.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 오류: $_" -ForegroundColor Red
}

Write-Host ""
