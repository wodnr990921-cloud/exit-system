import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 활성 경기 조회 (games 테이블)
    const { data: activeGames, error: gamesError } = await supabase
      .from("games")
      .select("*")
      .eq("status", "active")
      .order("game_date", { ascending: true })

    if (gamesError) {
      console.error("Error fetching games:", gamesError)
      // games 테이블이 없을 수도 있으므로 기존 방식으로 폴백
    }

    // 진행 중인 배팅 조회 (category='game'인 task_items)
    const { data: gameItems, error: itemsError } = await supabase
      .from("task_items")
      .select(
        `
        id,
        description,
        amount,
        status,
        details,
        game_id,
        created_at,
        tasks!task_items_task_id_fkey (
          id,
          ticket_no,
          member_id,
          customer:customers!tasks_member_id_fkey (
            id,
            member_number,
            name
          )
        ),
        game:games!task_items_game_id_fkey (
          id,
          home_team,
          away_team,
          status,
          result
        )
      `
      )
      .eq("category", "game")
      .in("status", ["approved", "pending", "won", "lost"])

    if (itemsError) {
      console.error("Error fetching game items:", itemsError)
      return NextResponse.json({ error: "경기 목록을 불러오는데 실패했습니다." }, { status: 500 })
    }

    // games 테이블이 있는 경우: games 기반으로 그룹화
    if (activeGames && activeGames.length > 0) {
      const gamesMap = new Map<string, any>()

      activeGames.forEach((game: any) => {
        gamesMap.set(game.id, {
          game_id: game.id,
          game_name: `${game.home_team} vs ${game.away_team}`,
          home_team: game.home_team,
          away_team: game.away_team,
          game_date: game.game_date,
          status: game.status,
          total_bets: 0,
          total_risk: 0,
          bet_count: 0,
          items: [],
        })
      })

      // task_items를 games에 매핑
      gameItems?.forEach((item: any) => {
        const gameId = item.game_id
        let targetGame: any = null

        if (gameId && gamesMap.has(gameId)) {
          // game_id로 매핑
          targetGame = gamesMap.get(gameId)!
        } else {
          // description으로 폴백 (기존 방식)
          const gameName = item.description || "알 수 없는 경기"
          if (!gamesMap.has(gameName)) {
            gamesMap.set(gameName, {
              game_name: gameName,
              total_bets: 0,
              total_risk: 0,
              bet_count: 0,
              items: [],
            })
          }
          targetGame = gamesMap.get(gameName)!
        }

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

        const odds = details.odds || 1.0
        const betAmount = item.amount || 0
        const risk = betAmount * odds

        targetGame.total_bets += betAmount
        targetGame.total_risk += risk
        targetGame.bet_count++
        targetGame.items.push({
          id: item.id,
          amount: betAmount,
          odds: odds,
          choice: details.choice || "",
          status: item.status,
          ticket_no: item.tasks?.ticket_no,
          customer: item.tasks?.customer,
        })
      })

      const games = Array.from(gamesMap.values()).filter((game) => game.bet_count > 0 || game.game_id)
      return NextResponse.json({ success: true, games })
    }

    // games 테이블이 없는 경우: 기존 방식 (description 기반 그룹화)
    const gamesMap = new Map<string, any>()

    gameItems?.forEach((item: any) => {
      const gameName = item.description || "알 수 없는 경기"

      if (!gamesMap.has(gameName)) {
        gamesMap.set(gameName, {
          game_name: gameName,
          total_bets: 0,
          total_risk: 0,
          bet_count: 0,
          items: [],
        })
      }

      const game = gamesMap.get(gameName)!

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

      const odds = details.odds || 1.0
      const betAmount = item.amount || 0
      const risk = betAmount * odds

      game.total_bets += betAmount
      game.total_risk += risk
      game.bet_count++
      game.items.push({
        id: item.id,
        amount: betAmount,
        odds: odds,
        choice: details.choice || "",
        status: item.status,
        ticket_no: item.tasks?.ticket_no,
        customer: item.tasks?.customer,
      })
    })

    const games = Array.from(gamesMap.values())

    return NextResponse.json({ success: true, games })
  } catch (error: any) {
    console.error("Sports games API error:", error)
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    )
  }
}
