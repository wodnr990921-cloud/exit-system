# 경기 일정 API 테스트 스크립트

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  경기 일정 API 테스트" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. 로컬 테스트
Write-Host "[1] 로컬 API 테스트 (http://localhost:3000)" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $localResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/sports/schedule" -Method Get -TimeoutSec 10
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "Total Matches: $($localResponse.count)" -ForegroundColor Cyan
    
    if ($localResponse.stats) {
        Write-Host "`nLeague Stats:" -ForegroundColor Yellow
        $localResponse.stats.PSObject.Properties | ForEach-Object {
            Write-Host "  - $($_.Name): $($_.Value)" -ForegroundColor White
        }
    }
    
    Write-Host "`nSample Matches (Top 3):" -ForegroundColor Yellow
    $localResponse.schedule | Select-Object -First 3 | ForEach-Object {
        Write-Host "  $($_.sportTitle): $($_.homeTeam) vs $($_.awayTeam)" -ForegroundColor White
        Write-Host "     Time: $($_.commenceTime)" -ForegroundColor Gray
    }
} catch {
    Write-Host "ERROR: Local server not running (run 'npm run dev' first)" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host "`n"

# 2. Vercel 프로덕션 테스트
Write-Host "[2] Vercel Production Test" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray
try {
    $prodResponse = Invoke-RestMethod -Uri "https://exit-system.vercel.app/api/sports/schedule" -Method Get -TimeoutSec 15
    Write-Host "Success!" -ForegroundColor Green
    Write-Host "Total Matches: $($prodResponse.count)" -ForegroundColor Cyan
    
    if ($prodResponse.stats) {
        Write-Host "`nLeague Stats:" -ForegroundColor Yellow
        $prodResponse.stats.PSObject.Properties | ForEach-Object {
            Write-Host "  - $($_.Name): $($_.Value)" -ForegroundColor White
        }
    }
    
    Write-Host "`nSample Matches (Top 3):" -ForegroundColor Yellow
    $prodResponse.schedule | Select-Object -First 3 | ForEach-Object {
        Write-Host "  $($_.sportTitle): $($_.homeTeam) vs $($_.awayTeam)" -ForegroundColor White
        Write-Host "     Time: $($_.commenceTime)" -ForegroundColor Gray
        if ($_.bettingClosed) {
            Write-Host "     [BETTING CLOSED]" -ForegroundColor Red
        }
    }
    
    if ($prodResponse.count -eq 0) {
        Write-Host "`nWARNING: No match data found!" -ForegroundColor Yellow
        Write-Host "   Possible reasons:" -ForegroundColor Gray
        Write-Host "   - GitHub Actions not executed yet" -ForegroundColor Gray
        Write-Host "   - sports_matches table is empty" -ForegroundColor Gray
        Write-Host "`nSolution:" -ForegroundColor Cyan
        Write-Host "   1. Go to GitHub > Actions tab and run workflow manually" -ForegroundColor White
        Write-Host "   2. Or run in PowerShell:" -ForegroundColor White
        Write-Host "      curl https://exit-system.vercel.app/api/sync-odds-api" -ForegroundColor Gray
    }
} catch {
    Write-Host "ERROR: Vercel API call failed" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Gray
    
    if ($_.ErrorDetails) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan
