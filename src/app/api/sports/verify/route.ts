import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/sports/verify
 * 크롤링된 경기 결과를 관리자가 확인하고 승인
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gameId, verified = true } = body

    if (!gameId) {
      return NextResponse.json(
        {
          success: false,
          error: "gameId가 필요합니다.",
        },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 현재 사용자 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "인증이 필요합니다.",
        },
        { status: 401 }
      )
    }

    // 사용자 권한 확인
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: "사용자 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      )
    }

    // operator, admin, ceo만 승인 가능
    if (!["operator", "admin", "ceo"].includes(userData.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "권한이 없습니다. 관리자만 승인할 수 있습니다.",
        },
        { status: 403 }
      )
    }

    // 경기 결과 확인
    const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", gameId).single()

    if (gameError || !game) {
      return NextResponse.json(
        {
          success: false,
          error: "경기를 찾을 수 없습니다.",
        },
        { status: 404 }
      )
    }

    // 이미 확인된 경기인지 체크
    if (game.is_verified) {
      return NextResponse.json(
        {
          success: false,
          error: "이미 확인된 경기입니다.",
        },
        { status: 400 }
      )
    }

    // 경기 상태가 finished가 아니면 오류
    if (game.status !== "finished") {
      return NextResponse.json(
        {
          success: false,
          error: "종료된 경기만 승인할 수 있습니다.",
        },
        { status: 400 }
      )
    }

    // 경기 승인 처리
    const { error: updateError } = await supabase
      .from("games")
      .update({
        is_verified: verified,
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq("id", gameId)

    if (updateError) {
      throw updateError
    }

    // 승인된 경우, 정산 로직 실행 (기존 settle API 호출)
    if (verified) {
      try {
        // 정산 API 호출
        const settleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/sports/settle`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gameId: game.id,
            gameName: game.home_team && game.away_team ? `${game.home_team} vs ${game.away_team}` : game.game_name,
            result: game.result_score,
          }),
        })

        const settleData = await settleResponse.json()

        return NextResponse.json({
          success: true,
          message: "경기 결과가 승인되고 정산이 완료되었습니다.",
          game: {
            id: game.id,
            home_team: game.home_team,
            away_team: game.away_team,
            result_score: game.result_score,
            is_verified: true,
          },
          settlement: settleData.success ? settleData.result : null,
        })
      } catch (settleError) {
        console.error("Settlement error:", settleError)
        // 정산 실패해도 승인은 완료됨
        return NextResponse.json({
          success: true,
          message: "경기 결과가 승인되었으나 정산 중 오류가 발생했습니다.",
          game: {
            id: game.id,
            home_team: game.home_team,
            away_team: game.away_team,
            result_score: game.result_score,
            is_verified: true,
          },
          settlementError: settleError instanceof Error ? settleError.message : "정산 오류",
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "경기 결과가 승인되었습니다.",
      game: {
        id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        result_score: game.result_score,
        is_verified: verified,
      },
    })
  } catch (error) {
    console.error("Verify game error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "승인 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports/verify
 * 미확인 경기 목록 조회
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: unverifiedGames, error } = await supabase
      .from("games")
      .select("*")
      .eq("status", "finished")
      .eq("is_verified", false)
      .order("game_date", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      games: unverifiedGames || [],
      count: unverifiedGames?.length || 0,
    })
  } catch (error) {
    console.error("Get unverified games error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}
