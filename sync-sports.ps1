# K리그1 스포츠 데이터 동기화 스크립트
# 사용법: .\sync-sports.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n=== K리그1 데이터 동기화 ===" -ForegroundColor Cyan
Write-Host "시작 시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# 로컬 서버 URL (필요시 수정)
$baseUrl = "http://localhost:3000"
$url = "$baseUrl/api/sync-sports"

try {
    Write-Host "🔄 API 호출 중..." -ForegroundColor Yellow
    $startTime = Get-Date
    
    $response = Invoke-RestMethod -Uri $url -Method Get
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds
    
    if ($response.success) {
        Write-Host "`n✓ 동기화 완료!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 동기화 결과:" -ForegroundColor White
        Write-Host "  총 경기 수: $($response.data.total)개" -ForegroundColor White
        Write-Host "  - 예정 경기: $($response.data.scheduled)개" -ForegroundColor Cyan
        Write-Host "  - 완료 경기: $($response.data.completed)개" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "⏱️  소요 시간: $([math]::Round($duration, 0))ms" -ForegroundColor Gray
        
        if ($response.timestamp) {
            Write-Host "🕐 동기화 시각: $($response.timestamp) (KST)" -ForegroundColor Gray
        }
    } else {
        Write-Host "`n✗ 동기화 실패" -ForegroundColor Red
        Write-Host "  오류: $($response.error)" -ForegroundColor Red
        if ($response.details) {
            Write-Host "  상세: $($response.details)" -ForegroundColor Yellow
        }
        exit 1
    }
    
} catch {
    Write-Host "`n✗ API 호출 실패" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  HTTP 상태 코드: $statusCode" -ForegroundColor Yellow
        
        if ($statusCode -eq 500) {
            Write-Host "  서버 오류가 발생했습니다" -ForegroundColor Red
            Write-Host "  - ODDS_API_KEY가 .env.local에 있는지 확인하세요" -ForegroundColor Yellow
            Write-Host "  - 서버 로그를 확인하세요" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  오류: $_" -ForegroundColor Red
        Write-Host "`n  서버가 실행 중인지 확인하세요:" -ForegroundColor Yellow
        Write-Host "    npm run dev" -ForegroundColor Cyan
    }
    
    exit 1
}

Write-Host "`n=== 완료 ===" -ForegroundColor Cyan
Write-Host "종료 시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""
