import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import * as cheerio from "cheerio"
import {
  fetchWithRetry,
  parseGameDate,
  parseScore,
  normalizeTeamName,
  getLeagueName,
  getSportCode,
  getGameStatus,
  globalRateLimiter,
} from "@/lib/crawling/utils"

/**
 * 크롤링된 경기 데이터 인터페이스
 */
interface CrawledGame {
  league: string
  homeTeam: string
  awayTeam: string
  homeScore?: number
  awayScore?: number
  gameDate: string
  gameTime?: string
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled"
  location?: string
  resultScore?: string
}

/**
 * 리그별 설정
 */
interface LeagueConfig {
  code: string
  name: string
  sport: string
  urlPath: string
}

const LEAGUE_CONFIGS: Record<string, LeagueConfig> = {
  kbo: {
    code: "kbo",
    name: "KBO",
    sport: "baseball",
    urlPath: "kbaseball",
  },
  mlb: {
    code: "mlb",
    name: "MLB",
    sport: "baseball",
    urlPath: "baseball",
  },
  kleague: {
    code: "kleague",
    name: "K리그",
    sport: "soccer",
    urlPath: "wfootball",
  },
  epl: {
    code: "epl",
    name: "프리미어리그",
    sport: "soccer",
    urlPath: "wfootball",
  },
  kbl: {
    code: "kbl",
    name: "KBL",
    sport: "basketball",
    urlPath: "basketball",
  },
  nba: {
    code: "nba",
    name: "NBA",
    sport: "basketball",
    urlPath: "basketball",
  },
}

/**
 * 네이버 스포츠에서 경기 일정/결과 크롤링
 */
async function crawlNaverSports(
  league: string,
  type: "schedule" | "result" = "schedule"
): Promise<CrawledGame[]> {
  const config = LEAGUE_CONFIGS[league.toLowerCase()]
  if (!config) {
    throw new Error(`지원하지 않는 리그입니다: ${league}`)
  }

  // 네이버 스포츠 URL 구성
  const baseUrl = `https://sports.news.naver.com/${config.urlPath}`
  const url = type === "schedule" ? `${baseUrl}/schedule/index` : `${baseUrl}/schedule/index`

  console.log(`[CRAWL] ${config.name} ${type} 크롤링 시작: ${url}`)

  // Rate limiter를 사용하여 요청
  const result = await globalRateLimiter.execute(() =>
    fetchWithRetry(url, {
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 15000,
    })
  )

  if (!result.success || !result.data) {
    throw new Error(result.error || "크롤링 실패")
  }

  const html = result.data
  const $ = cheerio.load(html)
  const games: CrawledGame[] = []

  try {
    // 네이버 스포츠 일정 페이지 파싱
    // 각 스포츠마다 HTML 구조가 다를 수 있으므로 여러 셀렉터 시도
    const selectors = [
      ".sch_tb tbody tr",
      ".tb_wrap table tbody tr",
      ".schedule_table tbody tr",
      ".game_list .game_item",
    ]

    for (const selector of selectors) {
      const rows = $(selector)
      if (rows.length > 0) {
        console.log(`[CRAWL] ${selector} 셀렉터로 ${rows.length}개 행 발견`)

        rows.each((_, element) => {
          try {
            const $row = $(element)

            // 테이블 형식 파싱
            const $cells = $row.find("td")
            if ($cells.length >= 3) {
              const dateText = $cells.eq(0).text().trim()
              const timeText = $cells.eq(1).text().trim() || dateText
              const homeTeam = normalizeTeamName($cells.eq(2).text().trim())
              const scoreOrStatus = $cells.eq(3).text().trim()
              const awayTeam = normalizeTeamName($cells.eq(4).text().trim())
              const locationText = $cells.eq(5).text().trim()

              if (!homeTeam || !awayTeam) {
                return // 계속
              }

              // 점수가 있으면 종료된 경기
              const parsedScore = parseScore(scoreOrStatus)
              const gameStatus = getGameStatus(scoreOrStatus)

              const gameDate = parseGameDate(dateText, timeText)

              const game: CrawledGame = {
                league: config.name,
                homeTeam,
                awayTeam,
                gameDate: gameDate.toISOString(),
                gameTime: timeText,
                status: parsedScore.isValid ? "finished" : gameStatus.status,
                location: locationText || undefined,
              }

              if (parsedScore.isValid) {
                game.homeScore = parsedScore.home
                game.awayScore = parsedScore.away
                game.resultScore = `${parsedScore.home}:${parsedScore.away}`
              }

              games.push(game)
            }

            // 카드 형식 파싱 (다음 스포츠 스타일)
            const homeTeamCard = $row.find(".team_home .name, .team_home .txt_team").text().trim()
            const awayTeamCard = $row.find(".team_away .name, .team_away .txt_team").text().trim()

            if (homeTeamCard && awayTeamCard) {
              const homeScore = parseInt($row.find(".team_home .score, .team_home .txt_score").text().trim())
              const awayScore = parseInt($row.find(".team_away .score, .team_away .txt_score").text().trim())
              const statusText = $row.find(".game_state, .info_state, .game_time").text().trim()
              const locationText = $row.find(".game_place, .info_place").text().trim()

              const gameStatus = getGameStatus(statusText)
              const gameDate = parseGameDate("", statusText)

              const game: CrawledGame = {
                league: config.name,
                homeTeam: normalizeTeamName(homeTeamCard),
                awayTeam: normalizeTeamName(awayTeamCard),
                gameDate: gameDate.toISOString(),
                status: gameStatus.status,
                location: locationText || undefined,
              }

              if (!isNaN(homeScore) && !isNaN(awayScore)) {
                game.homeScore = homeScore
                game.awayScore = awayScore
                game.resultScore = `${homeScore}:${awayScore}`
                game.status = "finished"
              }

              // 중복 체크
              const isDuplicate = games.some(
                (g) =>
                  g.homeTeam === game.homeTeam &&
                  g.awayTeam === game.awayTeam &&
                  g.gameDate.split("T")[0] === game.gameDate.split("T")[0]
              )

              if (!isDuplicate) {
                games.push(game)
              }
            }
          } catch (error) {
            console.error("[CRAWL] 행 파싱 오류:", error)
          }
        })

        if (games.length > 0) {
          break // 성공적으로 파싱했으면 다른 셀렉터 시도 안 함
        }
      }
    }
  } catch (error) {
    console.error("[CRAWL] 파싱 오류:", error)
    throw new Error("HTML 파싱 중 오류가 발생했습니다.")
  }

  console.log(`[CRAWL] ${config.name} ${games.length}개 경기 크롤링 완료`)
  return games
}

/**
 * POST /api/sports/crawl/naver
 * 네이버 스포츠에서 경기 데이터 크롤링
 *
 * Request Body:
 * - league: "kbo" | "mlb" | "kleague" | "epl" | "kbl" | "nba"
 * - type: "schedule" | "result" (기본값: "schedule")
 * - saveToDb: boolean (기본값: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      league = "kbo",
      type = "schedule",
      saveToDb = true,
    } = body as {
      league?: string
      type?: "schedule" | "result"
      saveToDb?: boolean
    }

    // 크롤링 실행
    const games = await crawlNaverSports(league, type)

    if (games.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "크롤링된 경기가 없습니다.",
        },
        { status: 404 }
      )
    }

    let savedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    // DB에 저장
    if (saveToDb) {
      const supabase = await createClient()

      for (const game of games) {
        try {
          // 중복 체크
          const { data: existingGames } = await supabase
            .from("games")
            .select("id, status, result_score")
            .eq("league", game.league)
            .ilike("home_team", `%${game.homeTeam}%`)
            .ilike("away_team", `%${game.awayTeam}%`)
            .gte("game_date", new Date(game.gameDate).toISOString().split("T")[0])
            .lt(
              "game_date",
              new Date(new Date(game.gameDate).getTime() + 86400000).toISOString().split("T")[0]
            )
            .limit(1)

          if (existingGames && existingGames.length > 0) {
            const existing = existingGames[0]

            // 경기 결과가 있고, 기존에 없었으면 업데이트
            if (game.status === "finished" && game.resultScore && !existing.result_score) {
              const { error: updateError } = await supabase
                .from("games")
                .update({
                  result_score: game.resultScore,
                  status: "finished",
                  is_verified: false, // 관리자 확인 필요
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existing.id)

              if (!updateError) {
                updatedCount++
              }
            } else {
              skippedCount++
            }
          } else {
            // 새 경기 삽입
            const insertData: any = {
              league: game.league,
              home_team: game.homeTeam,
              away_team: game.awayTeam,
              game_date: game.gameDate,
              status: game.status,
              location: game.location,
            }

            if (game.resultScore) {
              insertData.result_score = game.resultScore
              insertData.is_verified = false // 관리자 확인 필요
            }

            const { error: insertError } = await supabase.from("games").insert(insertData)

            if (!insertError) {
              savedCount++
            }
          }
        } catch (error) {
          console.error("[CRAWL] DB 저장 오류:", error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${games.length}개의 경기를 크롤링했습니다.`,
      stats: {
        total: games.length,
        saved: savedCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
      games: games.slice(0, 10), // 처음 10개만 반환
    })
  } catch (error) {
    console.error("[CRAWL] 크롤링 오류:", error)
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
 * GET /api/sports/crawl/naver
 * 지원되는 리그 목록 조회
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    leagues: Object.entries(LEAGUE_CONFIGS).map(([key, config]) => ({
      code: key,
      name: config.name,
      sport: config.sport,
    })),
  })
}
