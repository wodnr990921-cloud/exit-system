import { NextRequest, NextResponse } from "next/server"

/**
 * 경기 일정 조회 API
 * - The Odds API에서 예정된 경기 일정 가져오기
 * - 자동으로 sports_matches에 저장 안 함 (sync-sports 사용)
 */
export async function GET(request: NextRequest) {
  try {
    const oddsApiKey = process.env.ODDS_API_KEY

    if (!oddsApiKey) {
      return NextResponse.json(
        { error: "ODDS_API_KEY가 설정되지 않았습니다" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sport = searchParams.get('sport') || 'soccer_korea_kleague_1'
    const daysAhead = searchParams.get('daysAhead') || '7'

    const baseUrl = "https://api.the-odds-api.com/v4/sports"
    const url = `${baseUrl}/${sport}/odds?apiKey=${oddsApiKey}&regions=kr&markets=h2h&oddsFormat=decimal&dateFormat=iso&daysAhead=${daysAhead}`

    console.log(`[Schedule] API 호출: ${sport}, ${daysAhead}일`)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`The Odds API 오류: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // 데이터 변환
    const schedule = data.map((game: any) => {
      let oddsHome, oddsDraw, oddsAway

      if (game.bookmakers && game.bookmakers.length > 0) {
        const h2hMarket = game.bookmakers[0].markets.find((m: any) => m.key === 'h2h')
        if (h2hMarket) {
          const homeOutcome = h2hMarket.outcomes.find((o: any) => o.name === game.home_team)
          const awayOutcome = h2hMarket.outcomes.find((o: any) => o.name === game.away_team)
          const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name === 'Draw')

          oddsHome = homeOutcome?.price
          oddsAway = awayOutcome?.price
          oddsDraw = drawOutcome?.price
        }
      }

      return {
        id: game.id,
        sportKey: game.sport_key,
        sportTitle: game.sport_title,
        commenceTime: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        oddsHome,
        oddsDraw,
        oddsAway
      }
    })

    return NextResponse.json({
      success: true,
      sport,
      count: schedule.length,
      schedule,
      message: `${schedule.length}개의 예정된 경기를 찾았습니다`
    })

  } catch (error) {
    console.error("[Schedule] 오류:", error)
    return NextResponse.json(
      { 
        error: "경기 일정 조회 실패",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
