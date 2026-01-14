/**
 * API 클라이언트 사용 예제
 *
 * 프론트엔드에서 새로 구현된 API를 호출하는 방법을 보여줍니다.
 */

import type {
  ImpersonateRequest,
  ImpersonateResponse,
  StopImpersonateResponse,
  CreateNoticeRequest,
  CreateNoticeResponse,
  DismissNoticeRequest,
  CleanupRequest,
  CleanupResponse,
  PointLiabilityResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  CrawlNaverRequest,
  CrawlNaverResponse,
  ApiResponse,
} from "@/lib/types/api-types"

// ============================================
// 1. Impersonation API Examples
// ============================================

/**
 * 다른 직원으로 로그인
 */
export async function impersonateUser(
  targetUserId: string
): Promise<ApiResponse<ImpersonateResponse>> {
  const response = await fetch("/api/admin/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId } as ImpersonateRequest),
  })

  return response.json()
}

/**
 * 현재 Impersonate 상태 확인
 */
export async function getImpersonateStatus() {
  const response = await fetch("/api/admin/impersonate")
  return response.json()
}

/**
 * 원래 계정으로 복귀
 */
export async function stopImpersonate(): Promise<
  ApiResponse<StopImpersonateResponse>
> {
  const response = await fetch("/api/admin/impersonate/stop", {
    method: "POST",
  })

  return response.json()
}

// ============================================
// 2. Notice Popup API Examples
// ============================================

/**
 * 활성 팝업 공지사항 조회
 */
export async function getActivePopupNotices() {
  const response = await fetch("/api/notices/popup")
  return response.json()
}

/**
 * 팝업 공지사항 생성
 */
export async function createPopupNotice(
  notice: CreateNoticeRequest
): Promise<ApiResponse<CreateNoticeResponse>> {
  const response = await fetch("/api/notices/popup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(notice),
  })

  return response.json()
}

/**
 * "다시 보지 않기" 처리
 */
export async function dismissNotice(noticeId: string) {
  const response = await fetch("/api/notices/popup", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ noticeId } as DismissNoticeRequest),
  })

  return response.json()
}

// ============================================
// 3. Cleanup API Examples
// ============================================

/**
 * 데이터 청소 실행
 */
export async function cleanupData(
  request: CleanupRequest
): Promise<ApiResponse<CleanupResponse>> {
  const response = await fetch("/api/admin/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  return response.json()
}

/**
 * 정리 가능한 데이터 통계 조회
 */
export async function getCleanupStats(daysOld: number = 30) {
  const response = await fetch(`/api/admin/cleanup?daysOld=${daysOld}`)
  return response.json()
}

// ============================================
// 4. Point Liability API Examples
// ============================================

/**
 * 포인트 부채 현황 조회
 */
export async function getPointLiability(): Promise<
  ApiResponse<PointLiabilityResponse>
> {
  const response = await fetch("/api/finance/point-liability")
  return response.json()
}

/**
 * 포인트 부채 리포트 생성
 */
export async function generatePointLiabilityReport(
  request: GenerateReportRequest = {}
): Promise<ApiResponse<GenerateReportResponse>> {
  const response = await fetch("/api/finance/point-liability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  return response.json()
}

// ============================================
// 5. Sports Crawling API Examples
// ============================================

/**
 * 네이버 스포츠 크롤링
 */
export async function crawlNaverSports(
  request: CrawlNaverRequest
): Promise<ApiResponse<CrawlNaverResponse>> {
  const response = await fetch("/api/sports/crawl/naver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  return response.json()
}

/**
 * 지원 리그 목록 조회
 */
export async function getSupportedLeagues() {
  const response = await fetch("/api/sports/crawl/naver")
  return response.json()
}

// ============================================
// Usage Examples
// ============================================

/**
 * Example 1: Impersonate 워크플로우
 */
export async function exampleImpersonateWorkflow() {
  try {
    // 1. 다른 사용자로 전환
    const impersonateResult = await impersonateUser("target-user-id")
    console.log("Impersonated:", impersonateResult)

    // 2. 상태 확인
    const status = await getImpersonateStatus()
    console.log("Current status:", status)

    // 3. 작업 수행...
    // ...

    // 4. 원래 계정으로 복귀
    const stopResult = await stopImpersonate()
    console.log("Stopped:", stopResult)
  } catch (error) {
    console.error("Impersonate workflow error:", error)
  }
}

/**
 * Example 2: 공지사항 팝업 표시
 */
export async function exampleShowPopupNotices() {
  try {
    const { notices } = await getActivePopupNotices()

    for (const notice of notices) {
      // 팝업 표시
      const shouldDismiss = await showPopupDialog(notice)

      if (shouldDismiss) {
        await dismissNotice(notice.id)
      }
    }
  } catch (error) {
    console.error("Show popup notices error:", error)
  }
}

// 가상의 팝업 다이얼로그 함수
async function showPopupDialog(notice: any): Promise<boolean> {
  // 실제 구현에서는 Dialog 컴포넌트 사용
  return confirm(`${notice.title}\n\n${notice.content}\n\n다시 보지 않으시겠습니까?`)
}

/**
 * Example 3: 데이터 청소
 */
export async function exampleCleanupOldData() {
  try {
    // 1. 먼저 통계 확인
    const stats = await getCleanupStats(30)
    console.log("Cleanup stats:", stats)

    // 2. 사용자 확인
    if (!confirm(`${stats.stats.old_logs_count}개의 오래된 로그를 삭제하시겠습니까?`)) {
      return
    }

    // 3. 청소 실행
    const result = await cleanupData({
      cleanupType: "old_logs",
      daysOld: 30,
    })

    if (result && 'result' in result) {
      console.log("Cleanup result:", result)
      alert(
        `삭제 완료: ${result.result.deletedCount}개 항목, ${result.result.freedSpace}bytes`
      )
    }
  } catch (error) {
    console.error("Cleanup error:", error)
  }
}

/**
 * Example 4: 포인트 부채 대시보드
 */
export async function examplePointLiabilityDashboard() {
  try {
    const data = await getPointLiability()

    console.log("=== 포인트 부채 현황 ===")
    console.log(`총 부채: ${data.liability.total.toLocaleString()}원`)
    console.log(`일반 포인트: ${data.liability.general.toLocaleString()}원`)
    console.log(`베팅 포인트: ${data.liability.betting.toLocaleString()}원`)
    console.log(`고객 수: ${data.liability.customerCount}명`)
    console.log(`평균: ${data.liability.averagePerCustomer.toLocaleString()}원/명`)

    console.log("\n=== 상위 고객 ===")
    data.topCustomers.forEach((customer, index) => {
      console.log(
        `${index + 1}. ${customer.name}: ${customer.totalPoints.toLocaleString()}원`
      )
    })

    // 리포트 생성
    const report = await generatePointLiabilityReport({
      format: "json",
      includeCustomers: true,
    })

    console.log("Report generated:", report.report.generatedAt)
  } catch (error) {
    console.error("Point liability dashboard error:", error)
  }
}

/**
 * Example 5: 스포츠 경기 크롤링
 */
export async function exampleCrawlSportsGames() {
  try {
    // 1. 지원 리그 확인
    const leagues = await getSupportedLeagues()
    console.log("Supported leagues:", leagues)

    // 2. KBO 일정 크롤링
    const kboSchedule = await crawlNaverSports({
      league: "kbo",
      type: "schedule",
      saveToDb: true,
    })

    console.log("KBO 크롤링 결과:", kboSchedule)
    console.log(`총 ${kboSchedule.stats.total}개 경기 발견`)
    console.log(`${kboSchedule.stats.saved}개 저장`)
    console.log(`${kboSchedule.stats.updated}개 업데이트`)

    // 3. MLB 결과 크롤링
    const mlbResults = await crawlNaverSports({
      league: "mlb",
      type: "result",
      saveToDb: true,
    })

    console.log("MLB 크롤링 결과:", mlbResults)
  } catch (error) {
    console.error("Sports crawl error:", error)
  }
}

/**
 * Example 6: React 컴포넌트에서 사용
 */
export function ExampleReactComponent() {
  // React 훅 사용 예시는 주석으로 표시
  /*
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadNotices()
  }, [])

  async function loadNotices() {
    setLoading(true)
    try {
      const data = await getActivePopupNotices()
      setNotices(data.notices)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDismiss(noticeId: string) {
    await dismissNotice(noticeId)
    setNotices(prev => prev.filter(n => n.id !== noticeId))
  }

  return (
    <div>
      {notices.map(notice => (
        <NoticePopup
          key={notice.id}
          notice={notice}
          onDismiss={() => handleDismiss(notice.id)}
        />
      ))}
    </div>
  )
  */
}

// ============================================
// Error Handling Helper
// ============================================

/**
 * API 응답 에러 처리 헬퍼
 */
export function handleApiError(error: any): string {
  if (error.error) {
    return error.error
  }

  if (error.message) {
    return error.message
  }

  return "알 수 없는 오류가 발생했습니다."
}

/**
 * API 호출 래퍼 (에러 처리 포함)
 */
export async function safeApiCall<T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  errorCallback?: (error: string) => void
): Promise<T | null> {
  try {
    const result = await apiFunction()

    if ("error" in result) {
      const errorMessage = handleApiError(result)
      errorCallback?.(errorMessage)
      return null
    }

    return result as T
  } catch (error) {
    const errorMessage = handleApiError(error)
    errorCallback?.(errorMessage)
    return null
  }
}

/**
 * Usage example:
 */
export async function exampleSafeApiCall() {
  const liability = await safeApiCall(
    () => getPointLiability(),
    (error) => alert(`에러: ${error}`)
  )

  if (liability) {
    console.log("포인트 부채:", liability.liability.total)
  }
}
