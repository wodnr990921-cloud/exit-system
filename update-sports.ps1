# 스포츠 데이터 자동 업데이트 스크립트
# 사용법: .\update-sports.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n=== 스포츠 데이터 업데이트 시작 ===" -ForegroundColor Cyan

# 로컬 서버 URL (필요시 수정)
$baseUrl = "http://localhost:3000"
$url = "$baseUrl/api/update-sports"

Write-Host "서버: $baseUrl" -ForegroundColor Gray
Write-Host "엔드포인트: /api/update-sports" -ForegroundColor Gray
Write-Host ""

try {
    Write-Host "API 호출 중..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri $url -Method Get
    
    if ($response.success) {
        Write-Host "`n✓ 스포츠 데이터 업데이트 완료!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  총 업데이트: $($response.updated)개 경기" -ForegroundColor White
        Write-Host "  - 예정 경기: $($response.scheduled)개" -ForegroundColor Cyan
        Write-Host "  - 완료 경기: $($response.completed)개" -ForegroundColor Magenta
        Write-Host ""
        
        if ($response.message) {
            Write-Host "  메시지: $($response.message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "`n✗ 업데이트 실패" -ForegroundColor Red
        Write-Host "  $($response.error)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n✗ API 호출 실패" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  HTTP 상태 코드: $statusCode" -ForegroundColor Yellow
        
        if ($statusCode -eq 500) {
            Write-Host "  서버 오류: 로그를 확인하세요" -ForegroundColor Red
        }
    } else {
        Write-Host "  오류: $_" -ForegroundColor Red
        Write-Host "`n  서버가 실행 중인지 확인하세요:" -ForegroundColor Yellow
        Write-Host "  npm run dev" -ForegroundColor Cyan
    }
    
    exit 1
}

Write-Host "=== 완료 ===" -ForegroundColor Cyan
Write-Host ""
