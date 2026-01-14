import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import * as cheerio from "cheerio"

interface CrawledGame {
  league: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  gameDate: string
  status: string
}

/**
 * 네이버 스포츠에서 경기 결과 크롤링
 */
async function crawlNaverSports(sport: string = "baseball"): Promise<CrawledGame[]> {
  try {
    // 네이버 스포츠 URL (야구 기준)
    const sportCode = sport === "baseball" ? "baseball" : sport === "soccer" ? "soccer" : "basketball"
    const url = `https://sports.news.naver.com/${sportCode}/schedule/index.nhn`

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const games: CrawledGame[] = []

    // 네이버 스포츠 일정 페이지 파싱
    $(".tb_wrap table tbody tr").each((_, element) => {
      const $row = $(element)
      const $cells = $row.find("td")

      if ($cells.length >= 5) {
        const homeTeam = $cells.eq(1).text().trim()
        const awayTeam = $cells.eq(3).text().trim()
        const scoreText = $cells.eq(2).text().trim()
        const timeText = $cells.eq(0).text().trim()

        // 점수 파싱 (예: "3:2" 형태)
        const scoreMatch = scoreText.match(/(\d+)\s*:\s*(\d+)/)

        if (homeTeam && awayTeam && scoreMatch) {
          games.push({
            league: sport === "baseball" ? "KBO" : sport === "soccer" ? "K-League" : "KBL",
            homeTeam,
            awayTeam,
            homeScore: parseInt(scoreMatch[1]),
            awayScore: parseInt(scoreMatch[2]),
            gameDate: new Date().toISOString(),
            status: "finished",
          })
        }
      }
    })

    return games
  } catch (error) {
    console.error("Error crawling Naver Sports:", error)
    return []
  }
}

/**
 * 다음 스포츠에서 경기 결과 크롤링 (백업)
 */
async function crawlDaumSports(sport: string = "baseball"): Promise<CrawledGame[]> {
  try {
    const sportCode = sport === "baseball" ? "baseball" : sport === "soccer" ? "football" : "basketball"
    const url = `https://sports.daum.net/${sportCode}`

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const games: CrawledGame[] = []

    // 다음 스포츠 페이지 파싱
    $(".game_score").each((_, element) => {
      const $game = $(element)
      const homeTeam = $game.find(".team_home .txt_team").text().trim()
      const awayTeam = $game.find(".team_away .txt_team").text().trim()
      const homeScore = parseInt($game.find(".team_home .txt_score").text().trim() || "0")
      const awayScore = parseInt($game.find(".team_away .txt_score").text().trim() || "0")

      if (homeTeam && awayTeam) {
        games.push({
          league: sport === "baseball" ? "KBO" : sport === "soccer" ? "K-League" : "KBL",
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          gameDate: new Date().toISOString(),
          status: "finished",
        })
      }
    })

    return games
  } catch (error) {
    console.error("Error crawling Daum Sports:", error)
    return []
  }
}

/**
 * POST /api/sports/crawl/results
 * 스포츠 포털에서 경기 결과를 크롤링하고 DB에 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sport = "baseball", source = "naver" } = body

    // 크롤링 실행
    let crawledGames: CrawledGame[] = []

    if (source === "naver") {
      crawledGames = await crawlNaverSports(sport)
    } else if (source === "daum") {
      crawledGames = await crawlDaumSports(sport)
    } else {
      // 두 곳 모두 시도
      const naverGames = await crawlNaverSports(sport)
      const daumGames = await crawlDaumSports(sport)
      crawledGames = [...naverGames, ...daumGames]
    }

    if (crawledGames.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "크롤링된 경기 결과가 없습니다.",
        },
        { status: 404 }
      )
    }

    // Supabase에 저장
    const supabase = await createClient()

    // 기존 DB에 있는지 확인하고 업데이트
    const insertedGames = []

    for (const game of crawledGames) {
      // games 테이블에 해당 경기가 있는지 확인
      const { data: existingGames, error: searchError } = await supabase
        .from("games")
        .select("*")
        .ilike("home_team", `%${game.homeTeam}%`)
        .ilike("away_team", `%${game.awayTeam}%`)
        .eq("status", "scheduled")
        .order("game_date", { ascending: false })
        .limit(1)

      if (searchError) {
        console.error("Search error:", searchError)
        continue
      }

      if (existingGames && existingGames.length > 0) {
        // 기존 경기 업데이트
        const existingGame = existingGames[0]
        const { error: updateError } = await supabase
          .from("games")
          .update({
            result_score: `${game.homeScore}:${game.awayScore}`,
            status: "finished",
            is_verified: false, // 관리자 확인 필요
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingGame.id)

        if (!updateError) {
          insertedGames.push({
            id: existingGame.id,
            ...game,
            updated: true,
          })
        }
      } else {
        // 새 경기 삽입 (DB에 없던 경기)
        const { data: newGame, error: insertError } = await supabase
          .from("games")
          .insert({
            league: game.league,
            home_team: game.homeTeam,
            away_team: game.awayTeam,
            result_score: `${game.homeScore}:${game.awayScore}`,
            game_date: game.gameDate,
            status: "finished",
            is_verified: false, // 관리자 확인 필요
          })
          .select()
          .single()

        if (!insertError && newGame) {
          insertedGames.push({
            ...game,
            id: newGame.id,
            updated: false,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${insertedGames.length}개의 경기 결과를 가져왔습니다.`,
      games: insertedGames,
      totalCrawled: crawledGames.length,
    })
  } catch (error) {
    console.error("Crawl results error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "크롤링 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sports/crawl/results
 * 미확인 경기 결과 조회
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
