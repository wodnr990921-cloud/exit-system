# 경기 일정 API 테스트 스크립트

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  경기 일정 API 테스트" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

# 1. 로컬 테스트
Write-Host "[1] 로컬 API 테스트 (http://localhost:3000)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $localResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/sports/schedule" -Method Get -TimeoutSec 10
    Write-Host "✅ 성공!" -ForegroundColor Green
    Write-Host "총 경기 수: $($localResponse.count)" -ForegroundColor Cyan
    
    if ($localResponse.stats) {
        Write-Host "`n리그별 통계:" -ForegroundColor Yellow
        $localResponse.stats.PSObject.Properties | ForEach-Object {
            Write-Host "  - $($_.Name): $($_.Value)개" -ForegroundColor White
        }
    }
    
    Write-Host "`n경기 샘플 (최대 3개):" -ForegroundColor Yellow
    $localResponse.schedule | Select-Object -First 3 | ForEach-Object {
        Write-Host "  📅 $($_.sportTitle): $($_.homeTeam) vs $($_.awayTeam)" -ForegroundColor White
        Write-Host "     ⏰ $($_.commenceTime)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ 로컬 서버 실행 안 됨 (npm run dev 먼저 실행)" -ForegroundColor Red
    Write-Host "   오류: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "`n"

# 2. Vercel 프로덕션 테스트
Write-Host "[2] Vercel 프로덕션 테스트" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
try {
    $prodResponse = Invoke-RestMethod -Uri "https://exit-system.vercel.app/api/sports/schedule" -Method Get -TimeoutSec 15
    Write-Host "✅ 성공!" -ForegroundColor Green
    Write-Host "총 경기 수: $($prodResponse.count)" -ForegroundColor Cyan
    
    if ($prodResponse.stats) {
        Write-Host "`n리그별 통계:" -ForegroundColor Yellow
        $prodResponse.stats.PSObject.Properties | ForEach-Object {
            Write-Host "  - $($_.Name): $($_.Value)개" -ForegroundColor White
        }
    }
    
    Write-Host "`n경기 샘플 (최대 3개):" -ForegroundColor Yellow
    $prodResponse.schedule | Select-Object -First 3 | ForEach-Object {
        Write-Host "  📅 $($_.sportTitle): $($_.homeTeam) vs $($_.awayTeam)" -ForegroundColor White
        Write-Host "     ⏰ $($_.commenceTime)" -ForegroundColor Gray
        if ($_.bettingClosed) {
            Write-Host "     🔒 배팅 마감됨" -ForegroundColor Red
        }
    }
    
    if ($prodResponse.count -eq 0) {
        Write-Host "`n⚠️  경기 데이터가 없습니다!" -ForegroundColor Yellow
        Write-Host "   → GitHub Actions가 아직 실행되지 않았거나" -ForegroundColor Gray
        Write-Host "   → sports_matches 테이블이 비어있을 수 있습니다" -ForegroundColor Gray
        Write-Host "`n💡 해결 방법:" -ForegroundColor Cyan
        Write-Host "   1. GitHub → Actions 탭에서 수동 실행" -ForegroundColor White
        Write-Host "   2. 또는 PowerShell에서:" -ForegroundColor White
        Write-Host "      curl https://exit-system.vercel.app/api/sync-odds-api" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Vercel API 호출 실패" -ForegroundColor Red
    Write-Host "   오류: $($_.Exception.Message)" -ForegroundColor Gray
    
    # 상세 오류 정보
    if ($_.ErrorDetails) {
        Write-Host "   상세: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "테스트 완료" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan
