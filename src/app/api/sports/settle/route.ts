import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createWinNotification } from "@/lib/.cursorrules/notifications"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { gameId, gameName, result } = await request.json()

    if (!result) {
      return NextResponse.json({ error: "경기 결과가 필요합니다." }, { status: 400 })
    }

    if (!gameId && !gameName) {
      return NextResponse.json({ error: "경기 ID 또는 경기명이 필요합니다." }, { status: 400 })
    }

    // 해당 경기의 모든 배팅 아이템 조회
    let query = supabase
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
            total_point_betting
          )
        ),
        game:games!task_items_game_id_fkey (
          id,
          home_team,
          away_team,
          game_date
        )
      `
      )
      .eq("category", "game")
      .in("status", ["approved", "pending"])

    // game_id가 있으면 game_id로, 없으면 description으로 필터링
    if (gameId) {
      query = query.eq("game_id", gameId)
    } else {
      query = query.eq("description", gameName)
    }

    const { data: gameItems, error: fetchError } = await query

    if (fetchError) {
      console.error("Error fetching game items:", fetchError)
      return NextResponse.json({ error: "배팅 목록을 불러오는데 실패했습니다." }, { status: 500 })
    }

    if (!gameItems || gameItems.length === 0) {
      return NextResponse.json({ error: "해당 경기의 배팅이 없습니다." }, { status: 404 })
    }

    let totalPayout = 0
    let totalBets = 0
    let winCount = 0
    let loseCount = 0

    // 각 아이템 처리
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
        console.error("Error parsing details:", e)
      }

      const choice = details.choice || ""
      const odds = details.odds || 1.0
      const customerId = item.tasks?.member_id
      const customer = item.tasks?.customer

      // 승패 판단
      const isWin = choice === result

      if (isWin) {
        // 승리: 배당금 지급
        const payout = Math.round(betAmount * odds)
        totalPayout += payout
        winCount++

        // task_items 상태 업데이트
        await supabase
          .from("task_items")
          .update({ status: "won" })
          .eq("id", item.id)

        // 회원 포인트 증가
        if (customerId) {
          const currentBalance = customer?.total_point_betting || 0
          await supabase
            .from("customers")
            .update({ total_point_betting: currentBalance + payout })
            .eq("id", customerId)
        }

        // 당첨 알림 생성
        if (customerId && customer?.name) {
          const game = item.game
          const gameName = game ? `${game.home_team} vs ${game.away_team}` : item.description || "경기"
          const gameDate = game?.game_date
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
        }
      } else {
        // 패배: 상태만 변경
        loseCount++
        await supabase
          .from("task_items")
          .update({ status: "lost" })
          .eq("id", item.id)
      }
    }

    // games 테이블 업데이트 (game_id가 있는 경우)
    if (gameId) {
      await supabase
        .from("games")
        .update({
          status: "finished",
          result: result,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId)
    }

    const profit = totalBets - totalPayout
    const profitRate = totalBets > 0 ? ((profit / totalBets) * 100).toFixed(2) : "0.00"

    return NextResponse.json({
      success: true,
      result: {
        gameName: gameName || "알 수 없는 경기",
        result,
        totalBets,
        totalPayout,
        profit,
        profitRate,
        winCount,
        loseCount,
      },
    })
  } catch (error: any) {
    console.error("Settle API error:", error)
    return NextResponse.json(
      { error: "정산 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
