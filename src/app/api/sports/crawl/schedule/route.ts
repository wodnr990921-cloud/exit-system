import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import * as cheerio from "cheerio"

interface CrawledSchedule {
  league: string
  homeTeam: string
  awayTeam: string
  gameDate: string
  gameTime: string
  location?: string
}

/**
 * 네이버 스포츠에서 경기 일정 크롤링
 */
async function crawlNaverSchedule(sport: string = "baseball"): Promise<CrawledSchedule[]> {
  try {
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

    const schedules: CrawledSchedule[] = []

    // 네이버 스포츠 일정 테이블 파싱
    $(".tb_wrap table tbody tr").each((_, element) => {
      const $row = $(element)
      const $cells = $row.find("td")

      if ($cells.length >= 5) {
        const timeText = $cells.eq(0).text().trim()
        const homeTeam = $cells.eq(1).text().trim()
        const awayTeam = $cells.eq(3).text().trim()
        const locationText = $cells.eq(4).text().trim()
        const scoreOrStatus = $cells.eq(2).text().trim()

        // 점수가 없으면 예정된 경기로 판단
        const isScheduled = !scoreOrStatus.match(/\d+\s*:\s*\d+/)

        if (homeTeam && awayTeam && isScheduled && timeText) {
          const today = new Date()
          const [hours, minutes] = timeText.split(":").map((s) => parseInt(s) || 0)

          const gameDate = new Date(today)
          gameDate.setHours(hours, minutes, 0, 0)

          schedules.push({
            league: sport === "baseball" ? "KBO" : sport === "soccer" ? "K-League" : "KBL",
            homeTeam,
            awayTeam,
            gameDate: gameDate.toISOString(),
            gameTime: timeText,
            location: locationText || undefined,
          })
        }
      }
    })

    return schedules
  } catch (error) {
    console.error("Error crawling Naver schedule:", error)
    return []
  }
}

/**
 * 다음 스포츠에서 경기 일정 크롤링
 */
async function crawlDaumSchedule(sport: string = "baseball"): Promise<CrawledSchedule[]> {
  try {
    const sportCode = sport === "baseball" ? "baseball" : sport === "soccer" ? "football" : "basketball"
    const url = `https://sports.daum.net/${sportCode}/schedule`

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

    const schedules: CrawledSchedule[] = []

    // 다음 스포츠 일정 파싱
    $(".game_list .game_item").each((_, element) => {
      const $game = $(element)
      const homeTeam = $game.find(".team_home .txt_team").text().trim()
      const awayTeam = $game.find(".team_away .txt_team").text().trim()
      const timeText = $game.find(".info_time").text().trim()
      const locationText = $game.find(".info_place").text().trim()

      if (homeTeam && awayTeam && timeText) {
        const today = new Date()
        const timeMatch = timeText.match(/(\d{2}):(\d{2})/)

        if (timeMatch) {
          const hours = parseInt(timeMatch[1])
          const minutes = parseInt(timeMatch[2])

          const gameDate = new Date(today)
          gameDate.setHours(hours, minutes, 0, 0)

          schedules.push({
            league: sport === "baseball" ? "KBO" : sport === "soccer" ? "K-League" : "KBL",
            homeTeam,
            awayTeam,
            gameDate: gameDate.toISOString(),
            gameTime: timeText,
            location: locationText || undefined,
          })
        }
      }
    })

    return schedules
  } catch (error) {
    console.error("Error crawling Daum schedule:", error)
    return []
  }
}

/**
 * POST /api/sports/crawl/schedule
 * 스포츠 포털에서 경기 일정을 크롤링하고 DB에 저장
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sport = "baseball", source = "naver", daysAhead = 7 } = body

    // 크롤링 실행
    let crawledSchedules: CrawledSchedule[] = []

    if (source === "naver") {
      crawledSchedules = await crawlNaverSchedule(sport)
    } else if (source === "daum") {
      crawledSchedules = await crawlDaumSchedule(sport)
    } else {
      // 두 곳 모두 시도
      const naverSchedules = await crawlNaverSchedule(sport)
      const daumSchedules = await crawlDaumSchedule(sport)
      crawledSchedules = [...naverSchedules, ...daumSchedules]
    }

    if (crawledSchedules.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "크롤링된 경기 일정이 없습니다.",
        },
        { status: 404 }
      )
    }

    // 중복 제거 (같은 날 같은 팀 경기)
    const uniqueSchedules = crawledSchedules.filter(
      (schedule, index, self) =>
        index ===
        self.findIndex(
          (s) =>
            s.homeTeam === schedule.homeTeam &&
            s.awayTeam === schedule.awayTeam &&
            s.gameDate.split("T")[0] === schedule.gameDate.split("T")[0]
        )
    )

    // Supabase에 저장
    const supabase = await createClient()

    const insertedSchedules = []

    for (const schedule of uniqueSchedules) {
      // 중복 체크 (같은 날 같은 팀)
      const { data: existingGames, error: searchError } = await supabase
        .from("games")
        .select("*")
        .ilike("home_team", `%${schedule.homeTeam}%`)
        .ilike("away_team", `%${schedule.awayTeam}%`)
        .gte("game_date", new Date(schedule.gameDate).toISOString().split("T")[0])
        .lt("game_date", new Date(new Date(schedule.gameDate).getTime() + 86400000).toISOString().split("T")[0])

      if (searchError) {
        console.error("Search error:", searchError)
        continue
      }

      // 이미 존재하면 스킵
      if (existingGames && existingGames.length > 0) {
        continue
      }

      // 새 일정 삽입
      const { data: newGame, error: insertError } = await supabase
        .from("games")
        .insert({
          league: schedule.league,
          home_team: schedule.homeTeam,
          away_team: schedule.awayTeam,
          game_date: schedule.gameDate,
          status: "scheduled",
          location: schedule.location,
        })
        .select()
        .single()

      if (!insertError && newGame) {
        insertedSchedules.push({
          ...schedule,
          id: newGame.id,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${insertedSchedules.length}개의 경기 일정을 가져왔습니다.`,
      schedules: insertedSchedules,
      totalCrawled: uniqueSchedules.length,
    })
  } catch (error) {
    console.error("Crawl schedule error:", error)
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
 * GET /api/sports/crawl/schedule
 * 예정된 경기 일정 조회
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date().toISOString()

    const { data: scheduledGames, error } = await supabase
      .from("games")
      .select("*")
      .eq("status", "scheduled")
      .gte("game_date", now)
      .order("game_date", { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      schedules: scheduledGames || [],
      count: scheduledGames?.length || 0,
    })
  } catch (error) {
    console.error("Get scheduled games error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    )
  }
}
