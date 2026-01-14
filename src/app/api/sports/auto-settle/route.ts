import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createWinNotification } from "@/lib/.cursorrules/notifications"

/**
 * POST /api/sports/auto-settle
 * 검증된 경기 결과를 기반으로 자동 배팅 정산
 *
 * 이 API는:
 * 1. is_verified=true인 finished 경기들을 조회
 * 2. 각 경기에 대한 task_items (category='game') 찾기
 * 3. 경기 결과(result_score)를 파싱하여 승/패 판단
 * 4. 당첨자에게 포인트 지급 및 알림 생성
 * 5. 패배자 상태 업데이트
 *
 * 권한: operator, admin, ceo
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 및 권한 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "인증이 필요합니다." }, { status: 401 })
    }

    // 사용자 권한 확인
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || !["operator", "admin", "ceo"].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: "권한이 없습니다. operator 이상만 실행 가능합니다." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { gameIds = [], autoMode = true } = body

    // 검증된 경기 조회
    let gamesQuery = supabase
      .from("games")
      .select("*")
      .eq("status", "finished")
      .eq("is_verified", true)
      .order("game_date", { ascending: false })

    // 특정 경기 ID가 지정된 경우
    if (gameIds.length > 0) {
      gamesQuery = gamesQuery.in("id", gameIds)
    }

    const { data: verifiedGames, error: gamesError } = await gamesQuery

    if (gamesError) {
      throw gamesError
    }

    if (!verifiedGames || verifiedGames.length === 0) {
      return NextResponse.json({
        success: false,
        error: "정산할 검증된 경기가 없습니다.",
      })
    }

    const settlementResults = []
    let totalProcessed = 0
    let totalSettled = 0
    let totalSkipped = 0
    let totalErrors = 0

    // 각 경기에 대해 정산 처리
    for (const game of verifiedGames) {
      try {
        totalProcessed++

        // 이미 정산된 경기는 건너뛰기 (settled_at 필드가 있다고 가정)
        if (game.settled_at) {
          console.log(`[AUTO-SETTLE] 이미 정산된 경기 건너뛰기: ${game.id}`)
          totalSkipped++
          continue
        }

        // 해당 경기의 배팅 아이템 조회
        const { data: gameItems, error: itemsError } = await supabase
          .from("task_items")
          .select(
            `
            id,
            amount,
            status,
            description,
            details,
            game_id,
            tasks!task_items_task_id_fkey (
              id,
              member_id,
              customer:customers!tasks_member_id_fkey (
                id,
                name,
                member_number,
                total_point_betting
              )
            )
          `
          )
          .eq("category", "game")
          .eq("game_id", game.id)
          .in("status", ["approved", "pending"])

        if (itemsError) {
          console.error(`[AUTO-SETTLE] 배팅 조회 오류 (경기 ${game.id}):`, itemsError)
          totalErrors++
          continue
        }

        if (!gameItems || gameItems.length === 0) {
          console.log(`[AUTO-SETTLE] 배팅 없음 (경기 ${game.id})`)
          totalSkipped++
          continue
        }

        let totalPayout = 0
        let totalBets = 0
        let winCount = 0
        let loseCount = 0
        const settledItems = []

        // 경기 결과 파싱 (예: "3:2" -> 홈팀 3점, 원정팀 2점)
        const resultScore = game.result_score || ""
        const [homeScore, awayScore] = resultScore.split(":").map((s) => parseInt(s.trim()))

        let winningTeam = null
        if (!isNaN(homeScore) && !isNaN(awayScore)) {
          if (homeScore > awayScore) {
            winningTeam = "home"
          } else if (awayScore > homeScore) {
            winningTeam = "away"
          } else {
            winningTeam = "draw"
          }
        }

        // 각 배팅 아이템 처리
        for (const item of gameItems) {
          const betAmount = item.amount || 0
          totalBets += betAmount

          // details JSON 파싱
          let details: any = {}
          try {
            if (item.details && typeof item.details === "string") {
              details = JSON.parse(item.details)
            } else if (typeof item.details === "object") {
              details = item.details
            }
          } catch (e) {
            console.error("[AUTO-SETTLE] details 파싱 오류:", e)
          }

          const choice = details.choice || details.selected || ""
          const odds = parseFloat(details.odds || "1.0")
          const customerId = item.tasks?.member_id
          const customer = item.tasks?.customer

          // 승패 판단
          let isWin = false

          // choice가 "홈팀 승", "원정팀 승", "무승부" 등의 형태인 경우
          const choiceLower = choice.toLowerCase()
          if (winningTeam === "home" && (choiceLower.includes("홈") || choiceLower.includes(game.home_team?.toLowerCase()))) {
            isWin = true
          } else if (winningTeam === "away" && (choiceLower.includes("원정") || choiceLower.includes("어웨이") || choiceLower.includes(game.away_team?.toLowerCase()))) {
            isWin = true
          } else if (winningTeam === "draw" && choiceLower.includes("무승부")) {
            isWin = true
          }

          // 또는 choice가 정확한 스코어인 경우
          if (choice === resultScore) {
            isWin = true
          }

          if (isWin) {
            // 승리: 배당금 지급
            const payout = Math.round(betAmount * odds)
            totalPayout += payout
            winCount++

            // task_items 상태 업데이트
            await supabase
              .from("task_items")
              .update({
                status: "won",
                settled_at: new Date().toISOString()
              })
              .eq("id", item.id)

            // 회원 포인트 증가
            if (customerId && customer) {
              const currentBalance = customer.total_point_betting || 0
              await supabase
                .from("customers")
                .update({ total_point_betting: currentBalance + payout })
                .eq("id", customerId)

              // 당첨 알림 생성
              const gameName = `${game.home_team} vs ${game.away_team}`
              const gameDate = game.game_date
                ? new Date(game.game_date).toLocaleDateString("ko-KR")
                : new Date().toLocaleDateString("ko-KR")

              await createWinNotification(
                customerId,
                customer.name,
                gameDate,
                gameName,
                odds,
                item.id
              )

              settledItems.push({
                itemId: item.id,
                customerId,
                customerName: customer.name,
                memberNumber: customer.member_number,
                status: "won",
                betAmount,
                payout,
              })
            }
          } else {
            // 패배: 상태만 변경
            loseCount++
            await supabase
              .from("task_items")
              .update({
                status: "lost",
                settled_at: new Date().toISOString()
              })
              .eq("id", item.id)

            settledItems.push({
              itemId: item.id,
              customerId,
              customerName: customer?.name,
              memberNumber: customer?.member_number,
              status: "lost",
              betAmount,
              payout: 0,
            })
          }
        }

        // games 테이블에 정산 완료 표시
        await supabase
          .from("games")
          .update({
            settled_at: new Date().toISOString(),
            settled_by: user.id,
          })
          .eq("id", game.id)

        const profit = totalBets - totalPayout
        const profitRate = totalBets > 0 ? ((profit / totalBets) * 100).toFixed(2) : "0.00"

        settlementResults.push({
          gameId: game.id,
          gameName: `${game.home_team} vs ${game.away_team}`,
          gameDate: game.game_date,
          result: resultScore,
          winningTeam,
          totalBets,
          totalPayout,
          profit,
          profitRate,
          winCount,
          loseCount,
          items: settledItems,
        })

        totalSettled++
      } catch (error) {
        console.error(`[AUTO-SETTLE] 경기 ${game.id} 정산 오류:`, error)
        totalErrors++
        settlementResults.push({
          gameId: game.id,
          gameName: `${game.home_team} vs ${game.away_team}`,
          error: error instanceof Error ? error.message : "정산 오류",
        })
      }
    }

    // 전체 통계 계산
    const totalProfit = settlementResults.reduce((sum, r) => sum + (r.profit || 0), 0)
    const totalBets = settlementResults.reduce((sum, r) => sum + (r.totalBets || 0), 0)
    const totalPayout = settlementResults.reduce((sum, r) => sum + (r.totalPayout || 0), 0)
    const overallProfitRate = totalBets > 0 ? ((totalProfit / totalBets) * 100).toFixed(2) : "0.00"

    return NextResponse.json({
      success: true,
      message: `${totalSettled}개 경기 정산 완료`,
      stats: {
        totalProcessed,
        totalSettled,
        totalSkipped,
        totalErrors,
        totalBets,
        totalPayout,
        totalProfit,
        overallProfitRate,
      },
      results: settlementResults,
    })
  } catch (error) {
    console.error("[AUTO-SETTLE] 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "자동 정산 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports/auto-settle
 * 자동 정산 가능한 경기 목록 조회
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 검증되었지만 아직 정산되지 않은 경기 조회
    const { data: games, error } = await supabase
      .from("games")
      .select(
        `
        id,
        league,
        home_team,
        away_team,
        game_date,
        status,
        result_score,
        is_verified,
        settled_at
      `
      )
      .eq("status", "finished")
      .eq("is_verified", true)
      .is("settled_at", null)
      .order("game_date", { ascending: false })

    if (error) {
      throw error
    }

    // 각 경기의 배팅 수 조회
    const gamesWithBets = await Promise.all(
      (games || []).map(async (game) => {
        const { count } = await supabase
          .from("task_items")
          .select("*", { count: "exact", head: true })
          .eq("category", "game")
          .eq("game_id", game.id)
          .in("status", ["approved", "pending"])

        return {
          ...game,
          betCount: count || 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      games: gamesWithBets,
      count: gamesWithBets.length,
    })
  } catch (error) {
    console.error("[AUTO-SETTLE] GET 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}
