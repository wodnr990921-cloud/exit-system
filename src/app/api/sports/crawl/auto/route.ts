import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * 자동 크롤링 스케줄러
 *
 * 이 API는 다음 작업을 자동으로 수행합니다:
 * 1. 매일 오전 9시: 당일 경기 일정 크롤링
 * 2. 매일 자정: 종료된 경기 결과 크롤링
 * 3. 실시간: 진행 중인 경기 스코어 업데이트 (5분마다)
 *
 * 크롤링된 결과는 is_verified=false로 저장되어 operator가 검증 후 승인
 */

interface AutoCrawlResult {
  schedulesCrawled: number
  resultsCrawled: number
  livesUpdated: number
  errors: string[]
}

/**
 * 모든 리그의 경기 일정 크롤링
 */
async function crawlAllSchedules(): Promise<{ count: number; errors: string[] }> {
  const leagues = ["kbo", "mlb", "kleague", "epl", "kbl", "nba"]
  let totalCount = 0
  const errors: string[] = []

  for (const league of leagues) {
    try {
      const response = await fetch(`${getBaseUrl()}/api/sports/crawl/naver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league,
          type: "schedule",
          saveToDb: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        totalCount += data.stats?.saved || 0
        console.log(`[AUTO-CRAWL] ${league} 일정: ${data.stats?.saved || 0}개 저장`)
      } else {
        errors.push(`${league} 일정 크롤링 실패: ${data.error}`)
      }
    } catch (error) {
      const errorMsg = `${league} 일정 크롤링 오류: ${error instanceof Error ? error.message : "Unknown"}`
      errors.push(errorMsg)
      console.error(`[AUTO-CRAWL] ${errorMsg}`)
    }

    // Rate limiting: 리그 간 2초 대기
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return { count: totalCount, errors }
}

/**
 * 모든 리그의 경기 결과 크롤링
 */
async function crawlAllResults(): Promise<{ count: number; errors: string[] }> {
  const leagues = ["kbo", "mlb", "kleague", "epl", "kbl", "nba"]
  let totalCount = 0
  const errors: string[] = []

  for (const league of leagues) {
    try {
      const response = await fetch(`${getBaseUrl()}/api/sports/crawl/naver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league,
          type: "result",
          saveToDb: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        totalCount += data.stats?.updated || 0
        console.log(`[AUTO-CRAWL] ${league} 결과: ${data.stats?.updated || 0}개 업데이트`)
      } else {
        errors.push(`${league} 결과 크롤링 실패: ${data.error}`)
      }
    } catch (error) {
      const errorMsg = `${league} 결과 크롤링 오류: ${error instanceof Error ? error.message : "Unknown"}`
      errors.push(errorMsg)
      console.error(`[AUTO-CRAWL] ${errorMsg}`)
    }

    // Rate limiting: 리그 간 2초 대기
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return { count: totalCount, errors }
}

/**
 * 진행 중인 경기 실시간 스코어 업데이트
 */
async function updateLiveGames(): Promise<{ count: number; errors: string[] }> {
  const supabase = await createClient()
  let updatedCount = 0
  const errors: string[] = []

  try {
    // DB에서 진행 중인 경기 조회
    const { data: liveGames, error: fetchError } = await supabase
      .from("games")
      .select("*")
      .eq("status", "live")
      .limit(50)

    if (fetchError) {
      throw fetchError
    }

    if (!liveGames || liveGames.length === 0) {
      return { count: 0, errors: [] }
    }

    console.log(`[AUTO-CRAWL] ${liveGames.length}개 진행 중 경기 발견`)

    // 각 경기별로 최신 스코어 크롤링
    // (실제로는 리그별로 묶어서 크롤링하는 것이 효율적)
    const leagueGroups = new Map<string, typeof liveGames>()
    for (const game of liveGames) {
      const league = game.league || "kbo"
      if (!leagueGroups.has(league)) {
        leagueGroups.set(league, [])
      }
      leagueGroups.get(league)!.push(game)
    }

    for (const [league, games] of leagueGroups) {
      try {
        // 해당 리그의 현재 경기 크롤링
        const response = await fetch(`${getBaseUrl()}/api/sports/crawl/naver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            league,
            type: "result",
            saveToDb: false, // DB 저장은 직접 처리
          }),
        })

        const data = await response.json()

        if (data.success && data.games) {
          // 크롤링된 결과와 DB의 진행 중 경기 매칭
          for (const game of games) {
            const crawledGame = data.games.find(
              (cg: any) =>
                cg.homeTeam === game.home_team &&
                cg.awayTeam === game.away_team &&
                cg.status === "live"
            )

            if (crawledGame && crawledGame.resultScore) {
              // 실시간 스코어 업데이트
              const { error: updateError } = await supabase
                .from("games")
                .update({
                  result_score: crawledGame.resultScore,
                  status: crawledGame.status,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", game.id)

              if (!updateError) {
                updatedCount++
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = `${league} 실시간 업데이트 오류: ${error instanceof Error ? error.message : "Unknown"}`
        errors.push(errorMsg)
        console.error(`[AUTO-CRAWL] ${errorMsg}`)
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  } catch (error) {
    const errorMsg = `실시간 경기 업데이트 오류: ${error instanceof Error ? error.message : "Unknown"}`
    errors.push(errorMsg)
    console.error(`[AUTO-CRAWL] ${errorMsg}`)
  }

  return { count: updatedCount, errors }
}

/**
 * 크롤링 로그 저장
 */
async function saveCrawlLog(
  type: "schedule" | "result" | "live" | "auto",
  result: AutoCrawlResult
) {
  const supabase = await createClient()

  try {
    await supabase.from("crawl_logs").insert({
      type,
      schedules_crawled: result.schedulesCrawled,
      results_crawled: result.resultsCrawled,
      lives_updated: result.livesUpdated,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[AUTO-CRAWL] 로그 저장 실패:", error)
  }
}

/**
 * Base URL 가져오기
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}

/**
 * POST /api/sports/crawl/auto
 * 자동 크롤링 실행
 *
 * Request Body:
 * - mode: "schedule" | "result" | "live" | "all" (기본값: "all")
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { mode = "all" } = body as { mode?: "schedule" | "result" | "live" | "all" }

    console.log(`[AUTO-CRAWL] 자동 크롤링 시작 (모드: ${mode})`)

    const result: AutoCrawlResult = {
      schedulesCrawled: 0,
      resultsCrawled: 0,
      livesUpdated: 0,
      errors: [],
    }

    // 일정 크롤링
    if (mode === "schedule" || mode === "all") {
      const scheduleResult = await crawlAllSchedules()
      result.schedulesCrawled = scheduleResult.count
      result.errors.push(...scheduleResult.errors)
    }

    // 결과 크롤링
    if (mode === "result" || mode === "all") {
      const resultResult = await crawlAllResults()
      result.resultsCrawled = resultResult.count
      result.errors.push(...resultResult.errors)
    }

    // 실시간 업데이트
    if (mode === "live" || mode === "all") {
      const liveResult = await updateLiveGames()
      result.livesUpdated = liveResult.count
      result.errors.push(...liveResult.errors)
    }

    // 로그 저장
    await saveCrawlLog(mode === "all" ? "auto" : mode, result)

    console.log(`[AUTO-CRAWL] 자동 크롤링 완료`, result)

    return NextResponse.json({
      success: true,
      message: "자동 크롤링이 완료되었습니다.",
      result,
    })
  } catch (error) {
    console.error("[AUTO-CRAWL] 자동 크롤링 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "자동 크롤링 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports/crawl/auto
 * 자동 크롤링 상태 및 로그 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")

    // 최근 크롤링 로그 조회
    const { data: logs, error } = await supabase
      .from("crawl_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    // 현재 진행 중인 경기 수
    const { count: liveCount } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("status", "live")

    // 미확인 경기 수
    const { count: unverifiedCount } = await supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("status", "finished")
      .eq("is_verified", false)

    return NextResponse.json({
      success: true,
      status: {
        liveGames: liveCount || 0,
        unverifiedGames: unverifiedCount || 0,
      },
      logs: logs || [],
    })
  } catch (error) {
    console.error("[AUTO-CRAWL] 상태 조회 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}
