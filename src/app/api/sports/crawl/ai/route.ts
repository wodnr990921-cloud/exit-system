import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * AI 기반 경기 일정 크롤링
 * HTML을 AI가 분석해서 경기 정보를 추출
 */
export async function POST(request: NextRequest) {
  try {
    const { url, league } = await request.json()

    console.log(`AI 크롤링 시작: ${league} - ${url}`)

    // 1. HTML 가져오기
    const htmlResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })
    const html = await htmlResponse.text()

    // 2. AI에게 HTML 분석 요청
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 스포츠 경기 일정을 추출하는 전문가입니다. 
HTML에서 경기 정보를 찾아서 JSON 형식으로 반환하세요.
각 경기는 다음 정보를 포함해야 합니다:
- date: 경기 날짜 (YYYY-MM-DD 형식)
- time: 경기 시간 (HH:MM 형식, 24시간제)
- home_team: 홈 팀 이름
- away_team: 원정 팀 이름
- venue: 경기장 (선택사항)
- status: 경기 상태 ("scheduled", "live", "finished")

결과는 반드시 다음 형식의 JSON으로 반환하세요:
{
  "games": [
    {
      "date": "2026-01-15",
      "time": "19:00",
      "home_team": "한화",
      "away_team": "삼성",
      "venue": "대전",
      "status": "scheduled"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `다음 HTML에서 ${league} 경기 일정을 추출하세요:\n\n${html.substring(0, 50000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")
    console.log(`AI가 추출한 경기 수: ${result.games?.length || 0}`)

    if (!result.games || result.games.length === 0) {
      return NextResponse.json({
        success: false,
        message: "경기 정보를 찾을 수 없습니다.",
        games: [],
      })
    }

    // 3. 데이터베이스에 저장
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    let saved = 0
    let updated = 0
    let errors = 0

    for (const game of result.games) {
      try {
        // 중복 체크
        const { data: existing } = await supabase
          .from("sports_games")
          .select("id")
          .eq("league", league)
          .eq("game_date", game.date)
          .eq("home_team", game.home_team)
          .eq("away_team", game.away_team)
          .single()

        if (existing) {
          // 업데이트
          await supabase
            .from("sports_games")
            .update({
              game_time: game.time,
              venue: game.venue,
              status: game.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
          updated++
        } else {
          // 새로 추가
          await supabase.from("sports_games").insert({
            league,
            game_date: game.date,
            game_time: game.time,
            home_team: game.home_team,
            away_team: game.away_team,
            venue: game.venue,
            status: game.status,
            created_at: new Date().toISOString(),
          })
          saved++
        }
      } catch (error) {
        console.error("경기 저장 실패:", error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `AI 크롤링 완료: ${saved}개 저장, ${updated}개 업데이트, ${errors}개 실패`,
      stats: {
        total: result.games.length,
        saved,
        updated,
        errors,
      },
      games: result.games,
    })
  } catch (error: any) {
    console.error("AI 크롤링 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: "AI 크롤링 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}

/**
 * PUT: 경기 결과 크롤링 (AI 기반)
 */
export async function PUT(request: NextRequest) {
  try {
    const { url, league, gameId } = await request.json()

    console.log(`AI 결과 크롤링 시작: ${league} - ${gameId}`)

    // 1. HTML 가져오기
    const htmlResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })
    const html = await htmlResponse.text()

    // 2. AI에게 결과 분석 요청
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 스포츠 경기 결과를 추출하는 전문가입니다.
HTML에서 경기 결과를 찾아서 JSON 형식으로 반환하세요.

결과는 반드시 다음 형식의 JSON으로 반환하세요:
{
  "game": {
    "home_team": "팀명",
    "away_team": "팀명",
    "home_score": 5,
    "away_score": 3,
    "status": "finished",
    "final_date": "2026-01-15T20:30:00"
  }
}`,
        },
        {
          role: "user",
          content: `다음 HTML에서 경기 결과를 추출하세요:\n\n${html.substring(0, 50000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")
    
    if (!result.game) {
      return NextResponse.json({
        success: false,
        message: "경기 결과를 찾을 수 없습니다.",
      })
    }

    // 3. 데이터베이스 업데이트
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { error } = await supabase
      .from("sports_games")
      .update({
        home_score: result.game.home_score,
        away_score: result.game.away_score,
        status: "finished",
        final_date: result.game.final_date || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", gameId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "경기 결과 업데이트 완료",
      game: result.game,
    })
  } catch (error: any) {
    console.error("AI 결과 크롤링 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET: 여러 사이트에서 크롤링
 */
export async function GET(request: NextRequest) {
  try {
    const results = []

    // 1. KBO (네이버 스포츠)
    const kboResponse = await fetch(`${request.nextUrl.origin}/api/sports/crawl/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://sports.news.naver.com/kbaseball/schedule/index",
        league: "KBO",
      }),
    })
    const kboData = await kboResponse.json()
    results.push({ league: "KBO", ...kboData })

    // 2. K리그 (다음 스포츠 - 대체 소스)
    try {
      const kleagueResponse = await fetch(`${request.nextUrl.origin}/api/sports/crawl/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://sports.daum.net/schedule/kleague",
          league: "K리그",
        }),
      })
      const kleagueData = await kleagueResponse.json()
      results.push({ league: "K리그", ...kleagueData })
    } catch (error) {
      console.error("K리그 크롤링 실패:", error)
    }

    // 3. EPL (ESPN - 영어 소스)
    try {
      const eplResponse = await fetch(`${request.nextUrl.origin}/api/sports/crawl/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://www.espn.com/soccer/schedule/_/league/eng.1",
          league: "EPL",
        }),
      })
      const eplData = await eplResponse.json()
      results.push({ league: "EPL", ...eplData })
    } catch (error) {
      console.error("EPL 크롤링 실패:", error)
    }

    return NextResponse.json({
      success: true,
      message: "다중 사이트 AI 크롤링 완료",
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
