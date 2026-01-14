# 자동 크롤링 스크립트 (Windows 작업 스케줄러용)
# 매일 오전 9시, 오후 3시, 오후 9시 실행

$baseUrl = "https://www.manager-exit.cloud"  # 프로덕션 URL
$logFile = "c:\Users\User\exit system\crawl-log.txt"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "`n[$timestamp] 크롤링 시작"

try {
    # AI 크롤링 실행
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sports/crawl/ai" -Method Get
    
    if ($response.success) {
        Add-Content -Path $logFile -Value "✅ 성공: $($response.message)"
        
        # 각 리그별 결과 로깅
        foreach ($result in $response.results) {
            $league = $result.league
            $saved = $result.stats.saved
            $updated = $result.stats.updated
            Add-Content -Path $logFile -Value "  - $league: 저장 $saved, 업데이트 $updated"
        }
    } else {
        Add-Content -Path $logFile -Value "⚠️ 실패: $($response.message)"
    }
} catch {
    Add-Content -Path $logFile -Value "❌ 에러: $_"
}

Add-Content -Path $logFile -Value "[$timestamp] 크롤링 종료"
