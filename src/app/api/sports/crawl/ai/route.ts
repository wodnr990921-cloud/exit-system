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
 * GET: 여러 사이트에서 크롤링 - 전체 리그 자동 크롤링
 */
export async function GET(request: NextRequest) {
  try {
    const results = []
    // 우선순위: 라이브스코어 > 배트맨 > 플래시스코어
    const leagues = [
      // 국내 리그 (라이브스코어 우선)
      { 
        name: "KBO", 
        urls: [
          "https://www.livescore.com/en/baseball/south-korea/kbo/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=6001",
          "https://www.flashscore.com/baseball/south-korea/kbo/"
        ]
      },
      { 
        name: "K리그", 
        urls: [
          "https://www.livescore.com/en/football/south-korea/k-league-1/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=1001",
          "https://www.flashscore.com/football/south-korea/k-league-1/"
        ]
      },
      { 
        name: "KBL", 
        urls: [
          "https://www.livescore.com/en/basketball/south-korea/kbl/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=5001",
          "https://www.flashscore.com/basketball/south-korea/kbl/"
        ]
      },
      { 
        name: "WKBL", 
        urls: [
          "https://www.livescore.com/en/basketball/south-korea/wkbl/",
          "https://www.flashscore.com/basketball/south-korea/wkbl/"
        ]
      },
      { 
        name: "V-리그(남)", 
        urls: [
          "https://www.livescore.com/en/volleyball/south-korea/v-league-men/",
          "https://www.flashscore.com/volleyball/south-korea/v-league-men/"
        ]
      },
      { 
        name: "V-리그(여)", 
        urls: [
          "https://www.livescore.com/en/volleyball/south-korea/v-league-women/",
          "https://www.flashscore.com/volleyball/south-korea/v-league-women/"
        ]
      },
      
      // 해외 축구 (라이브스코어 우선)
      { 
        name: "EPL", 
        urls: [
          "https://www.livescore.com/en/football/england/premier-league/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=1002",
          "https://www.flashscore.com/football/england/premier-league/"
        ]
      },
      { 
        name: "라리가", 
        urls: [
          "https://www.livescore.com/en/football/spain/laliga/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=1003",
          "https://www.flashscore.com/football/spain/laliga/"
        ]
      },
      { 
        name: "분데스리가", 
        urls: [
          "https://www.livescore.com/en/football/germany/bundesliga/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=1004",
          "https://www.flashscore.com/football/germany/bundesliga/"
        ]
      },
      { 
        name: "세리에A", 
        urls: [
          "https://www.livescore.com/en/football/italy/serie-a/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=1005",
          "https://www.flashscore.com/football/italy/serie-a/"
        ]
      },
      { 
        name: "리그앙", 
        urls: [
          "https://www.livescore.com/en/football/france/ligue-1/",
          "https://www.flashscore.com/football/france/ligue-1/"
        ]
      },
      
      // 해외 야구 (라이브스코어 우선)
      { 
        name: "MLB", 
        urls: [
          "https://www.livescore.com/en/baseball/usa/mlb/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=6002",
          "https://www.flashscore.com/baseball/usa/mlb/"
        ]
      },
      { 
        name: "NPB", 
        urls: [
          "https://www.livescore.com/en/baseball/japan/npb/",
          "https://www.flashscore.com/baseball/japan/npb/"
        ]
      },
      
      // 해외 농구 (라이브스코어 우선)
      { 
        name: "NBA", 
        urls: [
          "https://www.livescore.com/en/basketball/usa/nba/",
          "https://www.betman.co.kr/sports/schedule.do?sports_id=5002",
          "https://www.flashscore.com/basketball/usa/nba/"
        ]
      },
    ]

    console.log(`🚀 전체 리그 크롤링 시작: ${leagues.length}개 리그 (국내 6개 + 해외 9개)`)
    console.log(`📡 우선순위: 라이브스코어 → 배트맨 → 플래시스코어`)

    // 병렬 크롤링으로 속도 향상 (폴백 로직 포함)
    const promises = leagues.map(async ({ name, urls }) => {
      let lastError = null
      
      // 각 URL을 순서대로 시도 (라이브스코어 → 배트맨 → 플래시스코어)
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const source = url.includes("livescore") ? "라이브스코어" : 
                      url.includes("betman") ? "배트맨" : 
                      url.includes("flashscore") ? "플래시스코어" : "기타"
        
        try {
          console.log(`🔍 ${name} 크롤링 시도 (${source})...`)
          
          const response = await fetch(`${request.nextUrl.origin}/api/sports/crawl/ai`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, league: name }),
          })
          
          const data = await response.json()
          
          if (data.success && (data.saved > 0 || data.updated > 0)) {
            console.log(`✅ ${name} 크롤링 완료 (${source}): ${data.saved || 0}건 저장`)
            return { league: name, source, ...data }
          } else {
            console.log(`⚠️ ${name} (${source}): 데이터 없음, 다음 소스 시도...`)
            lastError = data.message || "데이터 없음"
          }
        } catch (error: any) {
          console.error(`❌ ${name} (${source}) 실패:`, error.message)
          lastError = error.message
          
          // 마지막 URL이 아니면 다음 URL 시도
          if (i < urls.length - 1) {
            console.log(`🔄 ${name}: 다음 소스로 재시도...`)
            continue
          }
        }
      }
      
      // 모든 URL 시도 실패
      console.error(`💥 ${name} 전체 크롤링 실패 (모든 소스 시도 완료)`)
      return { 
        league: name, 
        success: false, 
        error: lastError || "모든 크롤링 소스 실패",
        sources_tried: urls.length
      }
    })

    const allResults = await Promise.all(promises)
    results.push(...allResults)

    // 성공/실패 집계
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0)
    
    // 소스별 통계
    const sourceStats = {
      livescore: results.filter((r) => r.source === "라이브스코어").length,
      betman: results.filter((r) => r.source === "배트맨").length,
      flashscore: results.filter((r) => r.source === "플래시스코어").length,
    }

    console.log(`\n📊 크롤링 완료 통계:`)
    console.log(`  ✅ 성공: ${successful}개`)
    console.log(`  ❌ 실패: ${failed}개`)
    console.log(`  💾 총 저장: ${totalSaved}건`)
    console.log(`  📡 라이브스코어: ${sourceStats.livescore}개`)
    console.log(`  📡 배트맨: ${sourceStats.betman}개`)
    console.log(`  📡 플래시스코어: ${sourceStats.flashscore}개`)

    return NextResponse.json({
      success: true,
      message: `전체 크롤링 완료: ${successful}개 성공 (라이브스코어 ${sourceStats.livescore}, 배트맨 ${sourceStats.betman}, 플래시 ${sourceStats.flashscore}), 총 ${totalSaved}건 저장`,
      stats: { 
        successful, 
        failed, 
        totalSaved, 
        total: leagues.length,
        sources: sourceStats
      },
      results,
    })
  } catch (error: any) {
    console.error("전체 크롤링 오류:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
